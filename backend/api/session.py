"""
Session token endpoints for protected exhibit entry flow.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from google.cloud import firestore
from pydantic import BaseModel, Field

from security.rate_limit import check_rate_limit, get_real_ip

router = APIRouter(prefix="/api/session", tags=["session"])

# Prefer dedicated secret, fallback to JWT secret to avoid hard failure in existing envs.
SESSION_SECRET = os.getenv("SESSION_SECRET") or os.getenv("JWT_SECRET", "")
if not SESSION_SECRET:
    raise RuntimeError("SESSION_SECRET (or JWT_SECRET fallback) environment variable is required")

TOKEN_EXPIRE_SECONDS = int(os.getenv("TOKEN_EXPIRE_SECONDS", "300"))
TOKEN_LENGTH = 32

# In-memory token store:
# {token: {exhibit_id, museum_id, created_at, used}}
_token_store: dict[str, dict[str, Any]] = {}
_db: firestore.AsyncClient | None = None


def _get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026")
        _db = firestore.AsyncClient(project=project_id)
    return _db


class CreateSessionRequest(BaseModel):
    exhibit_id: str = Field(min_length=1, max_length=100)
    museum_id: str = Field(min_length=1, max_length=100)


class CreateSessionResponse(BaseModel):
    token: str
    expires_in: int
    redirect_url: str


def _validate_id(value: str, field_name: str) -> None:
    if not value.replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} format")


def _generate_token(exhibit_id: str, museum_id: str) -> str:
    random_part = secrets.token_hex(TOKEN_LENGTH)
    timestamp = str(int(time.time()))
    message = f"{exhibit_id}:{museum_id}:{timestamp}:{random_part}"
    signature = hmac.new(
        SESSION_SECRET.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{random_part}{signature}"


def _cleanup_expired() -> None:
    now = time.time()
    expired_tokens = [
        token
        for token, data in _token_store.items()
        if now - float(data["created_at"]) > TOKEN_EXPIRE_SECONDS
    ]
    for token in expired_tokens:
        _token_store.pop(token, None)


@router.post("/create", response_model=CreateSessionResponse)
async def create_session(body: CreateSessionRequest, request: Request):
    client_ip = get_real_ip(request)
    await check_rate_limit(scope="session_create", key=f"ip:{client_ip}", limit=10, window_seconds=60)

    _validate_id(body.exhibit_id, "exhibit_id")
    _validate_id(body.museum_id, "museum_id")

    # Validate exhibit + museum pair exists.
    db = _get_db()
    museum_doc = await db.collection("museums").document(body.museum_id).get()
    if not museum_doc.exists:
        raise HTTPException(status_code=404, detail="Museum not found")

    exhibit_doc = await db.collection("exhibits").document(body.exhibit_id).get()
    if not exhibit_doc.exists:
        raise HTTPException(status_code=404, detail="Exhibit not found")
    exhibit = exhibit_doc.to_dict() or {}
    exhibit_museum_id = str(exhibit.get("museum_id") or "")
    if exhibit_museum_id and exhibit_museum_id != body.museum_id:
        raise HTTPException(status_code=403, detail="Exhibit does not belong to museum")

    _cleanup_expired()
    token = _generate_token(body.exhibit_id, body.museum_id)
    _token_store[token] = {
        "exhibit_id": body.exhibit_id,
        "museum_id": body.museum_id,
        "created_at": time.time(),
        "used": False,
    }

    redirect_url = (
        f"/exhibit/{body.exhibit_id}"
        f"?museum={body.museum_id}"
        f"&token={token}"
    )
    return CreateSessionResponse(
        token=token,
        expires_in=TOKEN_EXPIRE_SECONDS,
        redirect_url=redirect_url,
    )


@router.post("/validate")
async def validate_session(
    request: Request,
    token: str = Query(..., min_length=8),
    exhibit_id: str = Query(..., min_length=1, max_length=100),
):
    client_ip = get_real_ip(request)
    await check_rate_limit(scope="session_validate", key=f"ip:{client_ip}", limit=60, window_seconds=60)
    _validate_id(exhibit_id, "exhibit_id")

    _cleanup_expired()
    data = _token_store.get(token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    age_seconds = time.time() - float(data["created_at"])
    if age_seconds > TOKEN_EXPIRE_SECONDS:
        _token_store.pop(token, None)
        raise HTTPException(status_code=401, detail="Token expired")

    if data["exhibit_id"] != exhibit_id:
        raise HTTPException(status_code=401, detail="Token mismatch")

    return {
        "valid": True,
        "exhibit_id": data["exhibit_id"],
        "museum_id": data["museum_id"],
        "expires_in": int(TOKEN_EXPIRE_SECONDS - age_seconds),
    }
