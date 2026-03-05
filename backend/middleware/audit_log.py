from __future__ import annotations

import logging
import os
from typing import Any

from google.cloud import firestore

logger = logging.getLogger(__name__)
_db: firestore.AsyncClient | None = None


def _get_db() -> firestore.AsyncClient:
    global _db
    if _db is None:
        _db = firestore.AsyncClient(project=os.getenv("GOOGLE_CLOUD_PROJECT", "museai-2026"))
    return _db


async def audit_log(event: str, actor: str, details: dict[str, Any] | None = None) -> None:
    payload = {
        "event": event,
        "actor": actor,
        "details": details or {},
        "timestamp": firestore.SERVER_TIMESTAMP,
        "ip": (details or {}).get("ip"),
    }
    try:
        await _get_db().collection("audit_logs").add(payload)
    except Exception as e:  # pragma: no cover
        logger.warning("Failed to write audit log: %s", e)
