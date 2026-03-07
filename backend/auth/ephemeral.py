from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from jose import JWTError, jwt

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable not set!")

EPHEMERAL_EXPIRE_SECONDS = int(os.getenv("EPHEMERAL_TOKEN_EXPIRE_SECONDS", "3600"))


def create_ephemeral_token(
    exhibit_id: str | None = None,
    museum_id: str | None = None,
    artifact_id: str | None = None,
) -> str:
    """
    Create WS ephemeral token.
    Backward compatible:
    - Preferred key: exhibit_id
    - Legacy key: artifact_id
    """
    entity_id = (exhibit_id or artifact_id or "").strip()
    if not entity_id:
        raise HTTPException(status_code=400, detail="Missing exhibit_id")

    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "type": "ephemeral_ws",
        "exhibit_id": entity_id,
        # Keep legacy field for old clients/routes.
        "artifact_id": entity_id,
        "museum_id": museum_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=EPHEMERAL_EXPIRE_SECONDS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_ephemeral_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid ephemeral token")
    if payload.get("type") != "ephemeral_ws":
        raise HTTPException(status_code=401, detail="Invalid token type")
    # Normalize for callers: always provide both keys.
    entity_id = payload.get("exhibit_id") or payload.get("artifact_id")
    payload["exhibit_id"] = entity_id
    payload["artifact_id"] = entity_id
    return payload
