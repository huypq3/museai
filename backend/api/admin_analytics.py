"""
Admin analytics endpoints.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from pydantic import BaseModel

import sys

sys.path.append("..")
from auth.admin import ensure_museum_scope, get_current_admin, get_db, require_super_admin  # noqa: E402
router = APIRouter(prefix="/admin/analytics", tags=["admin"])


class TrackEventBody(BaseModel):
    museum_id: str
    exhibit_id: str | None = None
    artifact_id: str | None = None
    event_type: str
    language: str = "vi"
    duration_seconds: int | None = None
    session_id: str | None = None
    user_agent: str | None = None
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
async def track_event(body: TrackEventBody, admin=Depends(get_current_admin)):
    """Admin tracking endpoint (authenticated)."""
    if admin.get("role") == "museum_admin":
        ensure_museum_scope(admin, body.museum_id)
    db = get_db()
    payload = body.model_dump()
    entity_id = body.exhibit_id or body.artifact_id
    if entity_id:
        payload["exhibit_id"] = entity_id
        payload["artifact_id"] = entity_id  # legacy compatibility
    payload["timestamp"] = _parse_ts(body.timestamp)
    payload["created_at"] = firestore.SERVER_TIMESTAMP
    await db.collection("analytics_events").add(payload)
    return {"success": True}


@router.get("/overview")
async def analytics_overview(admin=Depends(get_current_admin)):
    require_super_admin(admin)
    db = get_db()
    museums = []
    museum_map: dict[str, dict[str, Any]] = {}

    async for doc in db.collection("museums").stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        museum_map[doc.id] = data
        museums.append(data)

    total_museums = len(museums)
    total_artifacts = 0
    async for _ in db.collection("exhibits").stream():
        total_artifacts += 1
    if total_artifacts == 0:
        async for _ in db.collection("artifacts").stream():
            total_artifacts += 1

    total_events = 0
    top_museum_counter: Counter[str] = Counter()
    top_artifact_counter: Counter[str] = Counter()
    async for doc in db.collection("analytics_events").stream():
        total_events += 1
        event = doc.to_dict() or {}
        if event.get("museum_id"):
            top_museum_counter[str(event["museum_id"])] += 1
        entity_id = event.get("exhibit_id") or event.get("artifact_id")
        if entity_id:
            top_artifact_counter[str(entity_id)] += 1

    return {
        "total_museums": total_museums,
        "total_artifacts": total_artifacts,
        "total_events": total_events,
        "top_museums": [
            {"museum_id": m_id, "count": count, "name": museum_map.get(m_id, {}).get("name", m_id)}
            for m_id, count in top_museum_counter.most_common(10)
        ],
        "top_artifacts": [
            {"exhibit_id": a_id, "artifact_id": a_id, "count": count}
            for a_id, count in top_artifact_counter.most_common(10)
        ],
    }


@router.get("/museum/{museum_id}")
async def analytics_museum(museum_id: str, admin=Depends(get_current_admin)):
    ensure_museum_scope(admin, museum_id)
    db = get_db()

    events: list[dict[str, Any]] = []
    query = db.collection("analytics_events").where("museum_id", "==", museum_id)
    async for doc in query.stream():
        events.append(doc.to_dict() or {})

    now = datetime.now(timezone.utc).date()
    daily = []
    by_day: dict[str, int] = defaultdict(int)
    for e in events:
        ts = e.get("timestamp")
        if hasattr(ts, "date"):
            d = ts.date().isoformat()
            by_day[d] += 1

    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).isoformat()
        daily.append({"date": day, "count": by_day.get(day, 0)})

    top_artifacts: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    by_type: Counter[str] = Counter()
    for e in events:
        entity_id = e.get("exhibit_id") or e.get("artifact_id")
        if entity_id:
            top_artifacts[str(entity_id)] += 1
        if e.get("language"):
            languages[str(e["language"])] += 1
        if e.get("event_type"):
            by_type[str(e["event_type"])] += 1

    return {
        "museum_id": museum_id,
        "events_total": len(events),
        "daily_visits": daily,
        "top_artifacts": [{"exhibit_id": k, "artifact_id": k, "count": v} for k, v in top_artifacts.most_common(20)],
        "language_distribution": [{"language": k, "count": v} for k, v in languages.most_common()],
        "event_distribution": [{"event_type": k, "count": v} for k, v in by_type.most_common()],
        "heatmap": [{"exhibit_id": k, "artifact_id": k, "scan_count": v} for k, v in top_artifacts.most_common(20)],
    }
