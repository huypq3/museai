"""
Admin authentication + authorization utilities (2-tier).
Roles:
- super_admin
- museum_admin
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import bcrypt
from fastapi import Depends, Header, HTTPException, Request
from google.cloud import firestore
from jose import ExpiredSignatureError, JWTError, jwt

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_EXPIRE_HOURS = int(os.getenv("ADMIN_JWT_EXPIRE_HOURS", "24"))
DEFAULT_SUPER_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

Role = Literal["super_admin", "museum_admin"]
_db: firestore.AsyncClient | None = None

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable not set!")
if len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be at least 32 characters")


def get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
        _db = firestore.AsyncClient(project=project_id)
    return _db


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _legacy_sha256(password: str) -> str:
    import hashlib

    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify password against bcrypt hash.
    Backward-compatible fallback for legacy SHA256 hashes.
    """
    if not hashed:
        return False
    if hashed.startswith("$2a$") or hashed.startswith("$2b$") or hashed.startswith("$2y$"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False
    return _legacy_sha256(password) == hashed


def generate_uid() -> str:
    return str(uuid.uuid4())


def _now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


async def ensure_super_admin_seed() -> None:
    """Ensure there is always a super admin account in Firestore."""
    db = get_db()
    ref = db.collection("admin_users").document("super_admin")
    doc = await ref.get()
    if doc.exists:
        return

    if not ADMIN_PASSWORD_HASH and not DEFAULT_SUPER_ADMIN_PASSWORD:
        raise RuntimeError("Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD to seed super admin account")
    pwd_hash = ADMIN_PASSWORD_HASH or hash_password(DEFAULT_SUPER_ADMIN_PASSWORD)
    await ref.set(
        {
            "uid": "super_admin",
            "role": "super_admin",
            "museum_id": None,
            "museum_name": None,
            "username": ADMIN_USERNAME,
            "password_hash": pwd_hash,
            "email": "",
            "status": "active",
            "created_at": firestore.SERVER_TIMESTAMP,
            "created_by": "system",
            "last_login": None,
            "login_count": 0,
        }
    )


async def authenticate_admin(username: str, password: str) -> dict[str, Any] | None:
    await ensure_super_admin_seed()
    db = get_db()
    query = db.collection("admin_users").where("username", "==", username).limit(1)
    async for doc in query.stream():
        data = doc.to_dict() or {}
        if verify_password(password, str(data.get("password_hash", ""))):
            data["uid"] = data.get("uid") or doc.id
            return data
    return None


def create_token(
    *,
    uid: str,
    username: str,
    role: Role,
    museum_id: str | None = None,
    museum_name: str | None = None,
) -> str:
    exp_ts = _now_ts() + JWT_EXPIRE_HOURS * 3600
    iat_ts = _now_ts()
    payload = {
        "sub": username,
        "uid": uid,
        "username": username,
        "role": role,
        "museum_id": museum_id,
        "museum_name": museum_name,
        "iat": iat_ts,
        "exp": exp_ts,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(request: Request, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    from middleware.audit_log import audit_log
    from security.rate_limit import check_rate_limit

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = authorization.replace("Bearer ", "").strip()
    await check_rate_limit(scope="admin_api", key=f"token:{hash(token)}", limit=100, window_seconds=60)
    payload = decode_token(token)
    role = payload.get("role")
    if role not in {"super_admin", "museum_admin"}:
        await audit_log(
            event="forbidden_access",
            actor=str(payload.get("username", "unknown")),
            details={"path": request.url.path, "method": request.method, "ip": request.client.host if request.client else None},
        )
        raise HTTPException(status_code=401, detail="Invalid token role")
    return payload


def require_super_admin(admin: dict[str, Any]) -> None:
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")


async def get_super_admin(admin: dict[str, Any] = Depends(get_current_admin)) -> dict[str, Any]:
    require_super_admin(admin)
    return admin


def ensure_museum_scope(admin: dict[str, Any], museum_id: str) -> None:
    role = admin.get("role")
    if role == "super_admin":
        return
    if role != "museum_admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    if admin.get("museum_id") != museum_id:
        raise HTTPException(status_code=403, detail="Forbidden for this museum")


# Backward-compatible dependency alias used by legacy routers.
async def verify_token(admin: dict[str, Any] = Depends(get_current_admin)) -> str:
    return str(admin.get("sub", ""))
