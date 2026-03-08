from __future__ import annotations

import os
import time
from collections import defaultdict, deque
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

_memory_windows: dict[str, Deque[float]] = defaultdict(deque)

LOGIN_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15"))
WS_MAX_PER_IP = int(os.getenv("WS_MAX_PER_IP", "3"))
WS_MAX_PER_HOUR = int(os.getenv("WS_MAX_PER_HOUR", "20"))


async def _incr_with_window(key: str, window_seconds: int) -> int:
    if _redis_client:
        val = await _redis_client.incr(key)
        await _redis_client.expire(key, window_seconds)
        return int(val)
    now = time.time()
    dq = _memory_windows[key]
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
    dq = _memory_windows[key]
    cutoff = now - window_seconds
    while dq and dq[0] < cutoff:
        dq.popleft()
    return len(dq)


async def check_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> None:
    count = await _incr_with_window(f"rl:{scope}:{key}", window_seconds)
    if count > limit:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


async def check_login_lockout(username: str, ip: str) -> None:
    user_key = f"login_fail_user:{username}"
    ip_key = f"login_fail_ip:{ip}"
    user_fails = await _get_count(user_key, LOGIN_LOCKOUT_MINUTES * 60)
    ip_fails = await _get_count(ip_key, LOGIN_LOCKOUT_MINUTES * 60)
    if user_fails >= LOGIN_LOCKOUT_THRESHOLD or ip_fails >= LOGIN_LOCKOUT_THRESHOLD * 3:
        raise HTTPException(
            status_code=429,
            detail=f"Account temporarily locked. Try again in {LOGIN_LOCKOUT_MINUTES} minutes.",
        )


async def record_failed_login(username: str, ip: str) -> None:
    await _incr_with_window(f"login_fail_user:{username}", LOGIN_LOCKOUT_MINUTES * 60)
    await _incr_with_window(f"login_fail_ip:{ip}", LOGIN_LOCKOUT_MINUTES * 60)


async def clear_failed_login(username: str, ip: str) -> None:
    if _redis_client:
        await _redis_client.delete(f"login_fail_user:{username}", f"login_fail_ip:{ip}")
        return
    _memory_windows.pop(f"login_fail_user:{username}", None)
    _memory_windows.pop(f"login_fail_ip:{ip}", None)


async def check_ws_limits(ip: str) -> None:
    active_key = f"ws_active:{ip}"
    hourly_key = f"ws_hourly:{ip}"
    active = await _get_count(active_key, 600)
    hourly = await _get_count(hourly_key, 3600)
    if active >= WS_MAX_PER_IP:
        raise HTTPException(status_code=429, detail="Too many active WebSocket sessions")
    if hourly >= WS_MAX_PER_HOUR:
        raise HTTPException(status_code=429, detail="Hourly WebSocket session limit exceeded")


async def register_ws_session(ip: str) -> None:
    await _incr_with_window(f"ws_active:{ip}", 600)
    await _incr_with_window(f"ws_hourly:{ip}", 3600)


async def unregister_ws_session(ip: str) -> None:
    if _redis_client:
        key = f"ws_active:{ip}"
        val = await _redis_client.get(key)
        if val and int(val) > 0:
            await _redis_client.decr(key)
        return
    key = f"ws_active:{ip}"
    dq = _memory_windows.get(key)
    if dq:
        try:
            dq.popleft()
        except Exception:
            pass
