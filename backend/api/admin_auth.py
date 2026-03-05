"""
Admin authentication endpoints
"""
import asyncio
import re

from fastapi import APIRouter, HTTPException, Request
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
import sys
sys.path.append('..')
from auth.admin import authenticate_admin, create_token, get_current_admin, get_db, hash_password
from fastapi import Depends
from middleware.audit_log import audit_log
from security.rate_limit import (
    check_login_lockout,
    check_rate_limit,
    clear_failed_login,
    record_failed_login,
)

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
            raise ValueError("Cần ít nhất 1 chữ hoa")
        if not re.search(r"[0-9]", v):
            raise ValueError("Cần ít nhất 1 chữ số")
        return v

@router.post("/login")
async def login(request: Request, body: LoginRequest):
    """Login with username/password and return JWT token + role."""
    ip = request.client.host if request.client else "unknown"
    await check_rate_limit(scope="login", key=f"ip:{ip}", limit=5, window_seconds=15 * 60)
    await check_login_lockout(body.username, ip)
    await asyncio.sleep(0.3)

    admin = await authenticate_admin(body.username, body.password)
    if not admin:
        await record_failed_login(body.username, ip)
        await audit_log("login_failed", body.username, {"ip": ip})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if admin.get("status") == "suspended":
        await audit_log("login_failed", body.username, {"ip": ip, "reason": "suspended"})
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

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
