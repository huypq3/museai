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


def create_ephemeral_token(artifact_id: str, museum_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "type": "ephemeral_ws",
        "artifact_id": artifact_id,
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
    return payload
