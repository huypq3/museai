"""
Public analytics tracking endpoint.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from google.cloud import firestore
from pydantic import BaseModel, Field

import sys

sys.path.append("..")
from auth.admin import get_db  # noqa: E402
from middleware.audit_log import audit_log  # noqa: E402
from security.rate_limit import check_rate_limit  # noqa: E402

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALLOWED_EVENT_TYPES = {
    "qr_scan",
    "conversation_start",
    "question_asked",
    "language_changed",
    "camera_opened",
    "exhibit_detected",
}


class PublicTrackEventBody(BaseModel):
    museum_id: str = Field(min_length=1, max_length=128)
    exhibit_id: str | None = Field(default=None, max_length=128)
    event_type: str = Field(min_length=1, max_length=64)
    language: str = Field(default="vi", min_length=2, max_length=8)
    duration_seconds: int | None = None
    session_id: str | None = Field(default=None, max_length=128)
    user_agent: str | None = Field(default=None, max_length=512)
    timestamp: str | None = None


def _parse_ts(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        return datetime.fromisoformat(value)
    except Exception:
        return datetime.now(timezone.utc)


@router.post("/track")
async def track_event(request: Request, body: PublicTrackEventBody):
    ip = request.client.host if request.client else "unknown"
    await check_rate_limit(scope="analytics_track_public", key=f"ip:{ip}", limit=120, window_seconds=60)

    event_type = body.event_type.strip().lower()
    if event_type not in ALLOWED_EVENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported event_type")

    db = get_db()
    payload = body.model_dump()
    if body.exhibit_id:
        payload["exhibit_id"] = body.exhibit_id
    payload["event_type"] = event_type
    payload["timestamp"] = _parse_ts(body.timestamp)
    payload["created_at"] = firestore.SERVER_TIMESTAMP
    await db.collection("analytics_events").add(payload)

    await audit_log(
        event="analytics_tracked",
        actor="public",
        details={"event_type": event_type, "museum_id": body.museum_id, "ip": ip},
    )
    return {"success": True}
