"""
System settings endpoints (super admin only).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator

import sys

sys.path.append("..")
from auth.admin import get_current_admin, get_db, require_super_admin  # noqa: E402
from middleware.audit_log import audit_log  # noqa: E402

router = APIRouter(prefix="/admin/settings", tags=["admin"])

SETTINGS_DOC_ID = "core"


class SystemSettingsUpdate(BaseModel):
    app_env: str = Field(default="development", min_length=3, max_length=32)
    enforce_https: bool = False
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    ws_require_ephemeral_token: bool = True
    ws_max_per_ip: int = Field(default=3, ge=1, le=20)
    ws_max_per_hour: int = Field(default=20, ge=1, le=500)
    login_max_attempts: int = Field(default=5, ge=1, le=20)
    login_lockout_minutes: int = Field(default=15, ge=1, le=240)

    @field_validator("allowed_origins")
    @classmethod
    def validate_allowed_origins(cls, v: list[str]) -> list[str]:
        cleaned = [x.strip() for x in v if x and x.strip()]
        if not cleaned:
            raise ValueError("allowed_origins cannot be empty")
        return cleaned


def _default_settings() -> dict[str, Any]:
    import os

    return {
        "app_env": os.getenv("APP_ENV", os.getenv("ENV", "development")).lower(),
        "enforce_https": os.getenv("ENFORCE_HTTPS", "false").lower() == "true",
        "allowed_origins": [x.strip() for x in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if x.strip()],
        "ws_require_ephemeral_token": os.getenv("WS_REQUIRE_EPHEMERAL_TOKEN", "true").lower() == "true",
        "ws_max_per_ip": int(os.getenv("WS_MAX_PER_IP", "3")),
        "ws_max_per_hour": int(os.getenv("WS_MAX_PER_HOUR", "20")),
        "login_max_attempts": int(os.getenv("LOGIN_MAX_ATTEMPTS", "5")),
        "login_lockout_minutes": int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15")),
    }


@router.get("/system")
async def get_system_settings(admin=Depends(get_current_admin)):
    require_super_admin(admin)
    db = get_db()
    ref = db.collection("system_settings").document(SETTINGS_DOC_ID)
    doc = await ref.get()
    persisted = doc.to_dict() if doc.exists else {}
    return {
        "settings": {**_default_settings(), **(persisted or {})},
        "persisted": bool(doc.exists),
        "note": "Env values apply at process startup. Persisted values are CMS-level config.",
    }


@router.put("/system")
async def update_system_settings(body: SystemSettingsUpdate, admin=Depends(get_current_admin)):
    require_super_admin(admin)
    db = get_db()
    payload = body.model_dump()
    payload["updated_at"] = firestore.SERVER_TIMESTAMP
    payload["updated_by"] = admin.get("uid")

    ref = db.collection("system_settings").document(SETTINGS_DOC_ID)
    await ref.set(payload, merge=True)
    await audit_log(
        event="system_settings_updated",
        actor=str(admin.get("username", admin.get("uid", "super_admin"))),
        details={"keys": list(payload.keys())},
    )
    return {"success": True, "settings": payload}
