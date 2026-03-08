from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque

from fastapi import HTTPException

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover
    redis = None


REDIS_URL = os.getenv("REDIS_URL", "")
_VALID_REDIS = (
    redis is not None
    and bool(REDIS_URL)
    and "localhost" not in REDIS_URL
    and "127.0.0.1" not in REDIS_URL
)
_redis_client = redis.from_url(REDIS_URL, decode_responses=True) if _VALID_REDIS else None

_memory_counters: dict[str, Deque[float]] = defaultdict(deque)

DELAY_SCHEDULE = [0, 0, 1, 3, 10]
USERNAME_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
USERNAME_LOCKOUT_SECONDS = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15")) * 60
IP_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_IP_MAX_ATTEMPTS", "15"))
IP_LOCKOUT_SECONDS = int(os.getenv("LOGIN_IP_LOCKOUT_MINUTES", "60")) * 60
TARGET_RESPONSE_SECONDS = float(os.getenv("LOGIN_TARGET_RESPONSE_MS", "300")) / 1000.0


@dataclass
class LoginRiskSignals:
    username_failures: int
    ip_failures: int
    suggested_delay_seconds: int


async def _incr_with_window(key: str, window_seconds: int) -> int:
    if _redis_client:
        val = await _redis_client.incr(key)
        await _redis_client.expire(key, window_seconds)
        return int(val)

    now = time.time()
    dq = _memory_counters[key]
    dq.append(now)
    cutoff = now - window_seconds
    while dq and dq[0] < cutoff:
        dq.popleft()
    return len(dq)


async def _get_count(key: str, window_seconds: int) -> int:
    if _redis_client:
        val = await _redis_client.get(key)
        return int(val or 0)

    now = time.time()
    dq = _memory_counters[key]
    cutoff = now - window_seconds
    while dq and dq[0] < cutoff:
        dq.popleft()
    return len(dq)


async def _delete_keys(*keys: str) -> None:
    if _redis_client:
        await _redis_client.delete(*keys)
        return
    for key in keys:
        _memory_counters.pop(key, None)


async def precheck_login(username: str, ip: str) -> LoginRiskSignals:
    user_fails = await _get_count(f"login_fail_user:{username}", USERNAME_LOCKOUT_SECONDS)
    ip_fails = await _get_count(f"login_fail_ip:{ip}", IP_LOCKOUT_SECONDS)

    if user_fails >= USERNAME_LOCKOUT_THRESHOLD:
        raise HTTPException(status_code=429, detail="Account temporarily locked")
    if ip_fails >= IP_LOCKOUT_THRESHOLD:
        raise HTTPException(status_code=429, detail="Too many attempts from this IP")

    idx = min(user_fails, len(DELAY_SCHEDULE) - 1)
    return LoginRiskSignals(
        username_failures=user_fails,
        ip_failures=ip_fails,
        suggested_delay_seconds=DELAY_SCHEDULE[idx],
    )


async def record_failed_login(username: str, ip: str, password_hint: str = "") -> None:
    await _incr_with_window(f"login_fail_user:{username}", USERNAME_LOCKOUT_SECONDS)
    await _incr_with_window(f"login_fail_ip:{ip}", IP_LOCKOUT_SECONDS)

    # lightweight suspicious-pattern signals
    if password_hint:
        await _incr_with_window(f"login_password_reuse:{password_hint}", 300)
    await _incr_with_window(f"login_username_probe:{ip}:{username[:2]}", 300)


async def clear_failed_login(username: str, ip: str) -> None:
    await _delete_keys(f"login_fail_user:{username}", f"login_fail_ip:{ip}")


async def normalize_login_timing(started_at: float, min_seconds: float = TARGET_RESPONSE_SECONDS) -> None:
    elapsed = time.monotonic() - started_at
    remaining = min_seconds - elapsed
    if remaining > 0:
        await asyncio.sleep(remaining)


async def apply_progressive_delay(seconds: int) -> None:
    if seconds > 0:
        await asyncio.sleep(seconds)
