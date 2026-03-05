"""
Admin user management endpoints (super admin only).
"""

from __future__ import annotations

import re
import secrets
import string
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from pydantic import BaseModel, Field

import sys

sys.path.append("..")
from auth.admin import generate_uid, get_db, get_super_admin, hash_password  # noqa: E402
from middleware.audit_log import audit_log  # noqa: E402

router = APIRouter(prefix="/admin/users", tags=["admin"])


def _valid_username(username: str) -> bool:
    return bool(re.fullmatch(r"[a-zA-Z0-9_]{4,64}", username))


async def _find_one_by_field(field: str, value: str) -> dict[str, Any] | None:
    db = get_db()
    query = db.collection("admin_users").where(field, "==", value).limit(1)
    async for doc in query.stream():
        data = doc.to_dict() or {}
        data["uid"] = data.get("uid") or doc.id
        return data
    return None


async def _active_admin_for_museum(museum_id: str) -> dict[str, Any] | None:
    db = get_db()
    query = (
        db.collection("admin_users")
        .where("museum_id", "==", museum_id)
        .where("role", "==", "museum_admin")
        .where("status", "==", "active")
        .limit(1)
    )
    async for doc in query.stream():
        data = doc.to_dict() or {}
        data["uid"] = data.get("uid") or doc.id
        return data
    return None


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=4, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    museum_id: str = Field(min_length=1)
    email: str | None = None

    @classmethod
    def _validate_password_strength(cls, password: str) -> str:
        if not re.search(r"[A-Z]", password):
            raise ValueError("Cần ít nhất 1 chữ hoa")
        if not re.search(r"[0-9]", password):
            raise ValueError("Cần ít nhất 1 chữ số")
        return password

    @classmethod
    def _validate_email(cls, email: str | None) -> str | None:
        if email and "@" not in email:
            raise ValueError("Email không hợp lệ")
        return email

    def model_post_init(self, __context):
        self.password = self._validate_password_strength(self.password)
        self.email = self._validate_email(self.email)


class UpdateUserRequest(BaseModel):
    new_password: str | None = Field(default=None, min_length=8, max_length=128)
    email: str | None = None
    status: Literal["active", "suspended"] | None = None

    def model_post_init(self, __context):
        if self.new_password:
            if not re.search(r"[A-Z]", self.new_password):
                raise ValueError("Cần ít nhất 1 chữ hoa")
            if not re.search(r"[0-9]", self.new_password):
                raise ValueError("Cần ít nhất 1 chữ số")
        if self.email and "@" not in self.email:
            raise ValueError("Email không hợp lệ")


@router.get("/")
async def list_users(_: dict = Depends(get_super_admin)):
    db = get_db()
    users: list[dict[str, Any]] = []
    async for doc in db.collection("admin_users").stream():
        data = doc.to_dict() or {}
        data["uid"] = data.get("uid") or doc.id
        data.pop("password_hash", None)
        users.append(data)
    users.sort(key=lambda u: (u.get("role") != "super_admin", u.get("username", "")))
    return {"users": users}


@router.post("/")
async def create_museum_admin(body: CreateUserRequest, admin: dict = Depends(get_super_admin)):
    if not _valid_username(body.username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 4-64 chars and contain only letters, numbers, underscore",
        )

    if await _find_one_by_field("username", body.username):
        raise HTTPException(status_code=400, detail=f"Username '{body.username}' đã tồn tại")

    if await _active_admin_for_museum(body.museum_id):
        raise HTTPException(status_code=400, detail="Bảo tàng này đã có admin account")

    db = get_db()
    museum_doc = await db.collection("museums").document(body.museum_id).get()
    if not museum_doc.exists:
        raise HTTPException(status_code=404, detail="Bảo tàng không tồn tại")
    museum_data = museum_doc.to_dict() or {}
    museum_name = museum_data.get("name", body.museum_id)

    uid = generate_uid()
    user_data = {
        "uid": uid,
        "username": body.username,
        "password_hash": hash_password(body.password),
        "email": body.email or "",
        "role": "museum_admin",
        "museum_id": body.museum_id,
        "museum_name": museum_name,
        "status": "active",
        "created_at": firestore.SERVER_TIMESTAMP,
        "created_by": admin.get("uid", "super_admin"),
        "last_login": None,
        "login_count": 0,
    }
    await db.collection("admin_users").document(uid).set(user_data)
    await db.collection("museums").document(body.museum_id).set(
        {"museum_admin_uid": uid},
        merge=True,
    )
    await audit_log(
        event="user_created",
        actor=str(admin.get("username", admin.get("uid", "super_admin"))),
        details={"new_username": body.username, "museum_id": body.museum_id},
    )

    return {
        "uid": uid,
        "username": body.username,
        "password": body.password,
        "museum_id": body.museum_id,
        "museum_name": museum_name,
        "message": "Lưu mật khẩu ngay — sẽ không hiển thị lại",
    }


@router.put("/{uid}")
async def update_user(uid: str, body: UpdateUserRequest, _: dict = Depends(get_super_admin)):
    db = get_db()
    ref = db.collection("admin_users").document(uid)
    doc = await ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    existing = doc.to_dict() or {}
    if existing.get("role") == "super_admin" and body.status == "suspended":
        raise HTTPException(status_code=400, detail="Không thể suspend super admin")

    updates: dict[str, Any] = {}
    if body.new_password:
        updates["password_hash"] = hash_password(body.new_password)
    if body.status is not None:
        updates["status"] = body.status
    if body.email is not None:
        updates["email"] = body.email
    if not updates:
        return {"message": "No changes"}

    await ref.update(updates)
    return {"message": "Updated successfully"}


@router.delete("/{uid}")
async def suspend_user(uid: str, admin: dict = Depends(get_super_admin)):
    if uid == admin.get("uid"):
        raise HTTPException(status_code=400, detail="Không thể suspend chính mình")

    db = get_db()
    ref = db.collection("admin_users").document(uid)
    doc = await ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    data = doc.to_dict() or {}
    if data.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Không thể suspend super admin")

    await ref.update({"status": "suspended"})
    await audit_log(
        event="user_suspended",
        actor=str(admin.get("username", admin.get("uid", "super_admin"))),
        details={"target_uid": uid},
    )
    return {"message": "Account suspended"}


@router.post("/{uid}/reset-password")
async def reset_password(uid: str, _: dict = Depends(get_super_admin)):
    db = get_db()
    ref = db.collection("admin_users").document(uid)
    doc = await ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    await ref.update({"password_hash": hash_password(new_password)})
    await audit_log(event="password_reset", actor="super_admin", details={"target_uid": uid})
    return {
        "new_password": new_password,
        "message": "Gửi mật khẩu này cho museum admin",
    }
