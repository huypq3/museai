"""
Admin authentication endpoints
"""
import re
import time

from fastapi import APIRouter, HTTPException, Request
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
import sys
sys.path.append('..')
from auth.admin import authenticate_admin, create_token, get_current_admin, get_db, hash_password
from fastapi import Depends
from middleware.audit_log import audit_log
from security.login_protection import (
    apply_progressive_delay,
    clear_failed_login,
    normalize_login_timing,
    precheck_login,
    record_failed_login,
)
from security.request_validator import get_real_ip

router = APIRouter(prefix="/admin/auth", tags=["admin"])

class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str):
        if not re.fullmatch(r"[a-zA-Z0-9_]+", v):
            raise ValueError("Username format invalid")
        return v


class ChangePasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str):
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must include at least 1 uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must include at least 1 number")
        return v

@router.post("/login")
async def login(request: Request, body: LoginRequest):
    """Login with username/password and return JWT token + role."""
    started_at = time.monotonic()
    ip = get_real_ip(request)
    signals = await precheck_login(body.username, ip)
    await apply_progressive_delay(signals.suggested_delay_seconds)

    admin = await authenticate_admin(body.username, body.password)
    if not admin:
        await record_failed_login(body.username, ip, password_hint=body.password[:3])
        if (signals.username_failures + 1) >= 3 or (signals.ip_failures + 1) >= 10:
            await audit_log(
                "login_bruteforce_signal",
                body.username,
                {"ip": ip, "username_failures": signals.username_failures + 1, "ip_failures": signals.ip_failures + 1},
            )
        await normalize_login_timing(started_at)
        await audit_log("login_failed", body.username, {"ip": ip})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if admin.get("status") == "suspended":
        await normalize_login_timing(started_at)
        await audit_log("login_failed", body.username, {"ip": ip, "reason": "suspended"})
        raise HTTPException(status_code=403, detail="Account is suspended")

    await clear_failed_login(body.username, ip)
    db = get_db()
    await db.collection("admin_users").document(str(admin["uid"])).set(
        {
            "last_login": firestore.SERVER_TIMESTAMP,
            "login_count": firestore.Increment(1),
        },
        merge=True,
    )
    token = create_token(
        uid=admin["uid"],
        username=admin.get("username", body.username),
        role=admin.get("role", "museum_admin"),
        museum_id=admin.get("museum_id"),
        museum_name=admin.get("museum_name"),
    )
    await normalize_login_timing(started_at)
    await audit_log("login_success", admin.get("username", body.username), {"ip": ip})
    return {
        "token": token,
        "username": admin.get("username", body.username),
        "uid": admin.get("uid"),
        "role": admin.get("role", "museum_admin"),
        "museum_id": admin.get("museum_id"),
        "museum_name": admin.get("museum_name"),
        "expires_in_hours": 24,
    }


@router.post("/logout")
async def logout(_: dict = Depends(get_current_admin)):
    # Stateless JWT logout on client-side. Blacklist can be added later.
    return {"success": True}


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, admin: dict = Depends(get_current_admin)):
    db = get_db()
    uid = admin.get("uid")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid token payload")
    await db.collection("admin_users").document(str(uid)).set(
        {"password_hash": hash_password(body.password)},
        merge=True,
    )
    return {"success": True}
