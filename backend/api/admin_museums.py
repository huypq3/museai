"""
Admin museum management endpoints (2-tier ACL).
"""

from __future__ import annotations

import re
import secrets
import string
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator

import sys

sys.path.append("..")
from auth.admin import (  # noqa: E402
    ensure_museum_scope,
    generate_uid,
    get_current_admin,
    get_db,
    hash_password,
    require_super_admin,
)
from middleware.audit_log import audit_log  # noqa: E402

router = APIRouter(prefix="/admin/museums", tags=["admin"])


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "museum"


MUSEUM_REQUIRED_FIELDS = [
    "name",
    "name_en",
    "address",
    "city",
    "phone",
    "email",
    "logo_url",
    "cover_image_url",
    "opening_hours",
    "ticket_price",
    "supported_languages",
    "ai_persona",
]


def _get_by_path(obj: dict[str, Any], path: str):
    cur: Any = obj
    for part in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _missing_required(data: dict[str, Any], fields: list[str]) -> list[str]:
    missing: list[str] = []
    for field in fields:
        value = _get_by_path(data, field)
        if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
            missing.append(field)
    return missing


def _generate_strong_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if re.search(r"[A-Z]", candidate) and re.search(r"[0-9]", candidate):
            return candidate


class MuseumCreate(BaseModel):
    name: str
    name_en: str
    slug: str | None = None
    address: str = ""
    city: str = ""
    country: str = "Vietnam"
    coordinates: dict[str, float] | None = None
    phone: str = ""
    email: str = ""
    website: str = ""
    logo_url: str = ""
    cover_image_url: str = ""
    opening_hours: dict[str, str] = Field(default_factory=dict)
    ticket_price: dict[str, Any] = Field(default_factory=dict)
    supported_languages: list[str] = Field(default_factory=lambda: ["vi", "en"])
    default_language: str = "vi"
    ai_persona: str = "Hướng dẫn viên thân thiện, am hiểu lịch sử"
    welcome_message: dict[str, str] = Field(default_factory=dict)
    status: Literal["active", "inactive", "demo"] = "active"
    admin_username: str | None = None
    admin_password: str | None = None
    admin_email: str | None = None

    @field_validator("admin_password")
    @classmethod
    def validate_admin_password(cls, v: str | None):
        if not v:
            return v
        if len(v) < 8:
            raise ValueError("admin_password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("admin_password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("admin_password must contain at least one number")
        return v


class MuseumUpdate(BaseModel):
    name: str | None = None
    name_en: str | None = None
    slug: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    coordinates: dict[str, float] | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    logo_url: str | None = None
    cover_image_url: str | None = None
    opening_hours: dict[str, str] | None = None
    ticket_price: dict[str, Any] | None = None
    supported_languages: list[str] | None = None
    default_language: str | None = None
    ai_persona: str | None = None
    welcome_message: dict[str, str] | None = None
    status: Literal["active", "inactive", "demo"] | None = None


async def _museum_stats(museum_id: str) -> dict[str, int]:
    db = get_db()
    artifacts = db.collection("exhibits").where("museum_id", "==", museum_id)
    artifact_count = 0
    async for _ in artifacts.stream():
        artifact_count += 1
    if artifact_count == 0:
        artifacts = db.collection("artifacts").where("museum_id", "==", museum_id)
        async for _ in artifacts.stream():
            artifact_count += 1
    return {"artifact_count": artifact_count}


@router.get("/")
async def list_museums(
    include_inactive: bool = Query(default=False),
    admin=Depends(get_current_admin),
):
    db = get_db()
    museums: list[dict[str, Any]] = []
    async for doc in db.collection("museums").stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        if admin["role"] == "museum_admin" and admin.get("museum_id") != doc.id:
            continue
        if not include_inactive and str(data.get("status", "active")).lower() == "inactive":
            continue
        stats = await _museum_stats(doc.id)
        data.update(stats)
        museums.append(data)
    return museums


@router.post("/")
async def create_museum(body: MuseumCreate, admin=Depends(get_current_admin)):
    require_super_admin(admin)
    db = get_db()

    museum_id = _slugify(body.slug or body.name_en or body.name)
    museum_ref = db.collection("museums").document(museum_id)
    if (await museum_ref.get()).exists:
        raise HTTPException(status_code=409, detail="Museum already exists")

    admin_username = body.admin_username or _slugify(body.slug or body.name_en or body.name)
    admin_password = body.admin_password or _generate_strong_password()
    admin_uid = generate_uid()

    # username unique across admin_users
    username_q = db.collection("admin_users").where("username", "==", admin_username).limit(1)
    async for _ in username_q.stream():
        raise HTTPException(status_code=409, detail="Admin username already exists")

    museum_data = {
        "id": museum_id,
        "name": body.name,
        "name_en": body.name_en,
        "slug": body.slug or museum_id,
        "address": body.address,
        "city": body.city,
        "country": body.country,
        "coordinates": body.coordinates or {},
        "phone": body.phone,
        "email": body.email,
        "website": body.website,
        "logo_url": body.logo_url,
        "cover_image_url": body.cover_image_url,
        "opening_hours": body.opening_hours,
        "ticket_price": body.ticket_price,
        "supported_languages": body.supported_languages,
        "default_language": body.default_language,
        "ai_persona": body.ai_persona,
        "welcome_message": body.welcome_message or {},
        "status": body.status,
        "artifact_count": 0,
        "total_visits": 0,
        "museum_admin_uid": admin_uid,
        "created_by": admin.get("uid"),
        "created_at": firestore.SERVER_TIMESTAMP,
    }
    if museum_data["status"] == "active":
        missing = _missing_required(museum_data, MUSEUM_REQUIRED_FIELDS)
        if missing:
            raise HTTPException(
                status_code=400,
                detail={"message": "Museum missing required fields for active status", "missing": missing},
            )
    await museum_ref.set(museum_data)

    await db.collection("admin_users").document(admin_uid).set(
        {
            "uid": admin_uid,
            "role": "museum_admin",
            "museum_id": museum_id,
            "museum_name": body.name,
            "username": admin_username,
            "password_hash": hash_password(admin_password),
            "email": body.admin_email or "",
            "status": "active",
            "created_at": firestore.SERVER_TIMESTAMP,
            "created_by": admin.get("uid"),
            "last_login": None,
            "login_count": 0,
        }
    )
    await audit_log(
        event="museum_created",
        actor=str(admin.get("username", admin.get("uid", "super_admin"))),
        details={"museum_id": museum_id},
    )

    return {
        "museum_id": museum_id,
        "admin_credentials": {
            "username": admin_username,
            "password": admin_password,
        },
    }


@router.get("/{museum_id}")
async def get_museum(museum_id: str, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, museum_id)
    db = get_db()
    doc = await db.collection("museums").document(museum_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Museum not found")
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return data


@router.put("/{museum_id}")
async def update_museum(museum_id: str, body: MuseumUpdate, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, museum_id)
    db = get_db()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        return {"success": True}
    if update_data.get("status") == "active":
        current_doc = await db.collection("museums").document(museum_id).get()
        current_data = current_doc.to_dict() or {}
        merged = {**current_data, **update_data}
        missing = _missing_required(merged, MUSEUM_REQUIRED_FIELDS)
        if missing:
            raise HTTPException(
                status_code=400,
                detail={"message": "Museum missing required fields for active status", "missing": missing},
            )
    await db.collection("museums").document(museum_id).update(update_data)
    return {"success": True}


@router.delete("/{museum_id}")
async def delete_museum(museum_id: str, admin=Depends(get_current_admin)):
    require_super_admin(admin)
    db = get_db()
    await db.collection("museums").document(museum_id).set(
        {"status": "inactive"}, merge=True
    )
    await audit_log(
        event="museum_deleted",
        actor=str(admin.get("username", admin.get("uid", "super_admin"))),
        details={"museum_id": museum_id},
    )
    return {"success": True}
