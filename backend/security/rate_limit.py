from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

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
_memory_sets: dict[str, dict[str, float]] = defaultdict(dict)

LOGIN_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(os.getenv("LOGIN_LOCKOUT_MINUTES", "15"))
WS_MAX_PER_IP = int(os.getenv("WS_MAX_PER_IP", "5"))
WS_MAX_PER_HOUR = int(os.getenv("WS_MAX_PER_HOUR", "100"))

# Endpoint-level middleware limits.
# Key: (method, regex_path)
RATE_LIMITS: dict[tuple[str, str], tuple[int, int]] = {
    ("POST", r"^/api/museum/validate$"): (20, 60),
    ("GET", r"^/museums/[^/]+/validate$"): (20, 60),
    ("GET", r"^/exhibits/[^/]+$"): (30, 60),
    ("GET", r"^/exhibits/[^/]+/validate$"): (30, 60),
    ("POST", r"^/vision/recognize/[^/]+$"): (10, 60),
    ("POST", r"^/vision/camera-tour/[^/]+$"): (10, 60),
    ("POST", r"^/api/session/token/[^/]+$"): (20, 60),
    ("POST", r"^/admin/auth/login$"): (5, 900),
    ("POST", r"^/admin/auth/refresh$"): (10, 60),
    ("POST", r"^/admin/exhibits/?$"): (30, 60),
    ("PUT", r"^/admin/exhibits/[^/]+$"): (30, 60),
    ("DELETE", r"^/admin/exhibits/[^/]+$"): (10, 60),
}


@dataclass
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int
    reset_epoch: int


def get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


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


async def _ttl_seconds(key: str, window_seconds: int) -> int:
    if _redis_client:
        ttl = await _redis_client.ttl(key)
        if ttl is None or ttl < 0:
            return window_seconds
        return int(ttl)

    now = time.time()
    dq = _memory_windows.get(key, deque())
    if not dq:
        return 0
    oldest = dq[0]
    ttl = int(max(0, window_seconds - (now - oldest)))
    return ttl


async def _add_unique_with_window(key: str, value: str, window_seconds: int) -> int:
    """
    Returns cardinality in window after adding value.
    """
    if _redis_client:
        await _redis_client.sadd(key, value)
        await _redis_client.expire(key, window_seconds)
        return int(await _redis_client.scard(key))

    now = time.time()
    values = _memory_sets[key]
    cutoff = now - window_seconds
    stale = [k for k, ts in values.items() if ts < cutoff]
    for k in stale:
        values.pop(k, None)
    values[value] = now
    return len(values)


async def consume_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
    bucket_key = f"rl:{scope}:{key}"
    count = await _incr_with_window(bucket_key, window_seconds)
    remaining = max(0, limit - count)
    retry_after = await _ttl_seconds(bucket_key, window_seconds)
    reset_epoch = int(time.time()) + retry_after
    return RateLimitDecision(
        allowed=count <= limit,
        limit=limit,
        remaining=remaining,
        retry_after=max(1, retry_after) if count > limit else max(0, retry_after),
        reset_epoch=reset_epoch,
    )


async def check_rate_limit(scope: str, key: str, limit: int, window_seconds: int) -> None:
    decision = await consume_rate_limit(scope, key, limit, window_seconds)
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Rate limit exceeded",
                "scope": scope,
                "retry_after": decision.retry_after,
                "limit": decision.limit,
            },
            headers={
                "Retry-After": str(decision.retry_after),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": str(decision.remaining),
                "X-RateLimit-Reset": str(decision.reset_epoch),
            },
        )


def _match_route_limit(method: str, path: str) -> tuple[str, int, int] | None:
    for (m, pattern), (limit, window) in RATE_LIMITS.items():
        if m == method and re.match(pattern, path):
            scope = f"{m}:{pattern}"
            return scope, limit, window
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Apply endpoint-specific rate limits and emit standard headers."""

    async def dispatch(self, request: Request, call_next):
        route_limit = _match_route_limit(request.method.upper(), request.url.path)
        if not route_limit:
            return await call_next(request)

        scope, limit, window = route_limit
        ip = get_real_ip(request)
        decision = await consume_rate_limit(scope=scope, key=f"ip:{ip}", limit=limit, window_seconds=window)

        if not decision.allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"},
                headers={
                    "Retry-After": str(decision.retry_after),
                    "X-RateLimit-Limit": str(decision.limit),
                    "X-RateLimit-Remaining": str(decision.remaining),
                    "X-RateLimit-Reset": str(decision.reset_epoch),
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(decision.limit)
        response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
        response.headers["X-RateLimit-Reset"] = str(decision.reset_epoch)
        return response


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
        retry_after = await _ttl_seconds(active_key, 600)
        raise HTTPException(
            status_code=429,
            detail=f"Too many active WebSocket sessions. Retry in {max(1, retry_after)}s",
        )
    if hourly >= WS_MAX_PER_HOUR:
        retry_after = await _ttl_seconds(hourly_key, 3600)
        raise HTTPException(
            status_code=429,
            detail=f"Hourly WebSocket session limit exceeded. Retry in {max(1, retry_after)}s",
        )


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


async def check_qr_scan_limits(ip: str, museum_id: str) -> None:
    # 10 scans/min/IP
    await check_rate_limit(scope="qr_scan", key=f"ip:{ip}", limit=10, window_seconds=60)

    # 3 unique museum IDs/min/IP to prevent enumeration.
    unique_count = await _add_unique_with_window(f"qr_unique_museum:{ip}", museum_id, 60)
    if unique_count > 3:
        # Escalate with simple strike model.
        strikes = await _incr_with_window(f"qr_enum_strikes:{ip}", 3600)
        if strikes >= 3:
            await _incr_with_window(f"qr_hard_block:{ip}", 3600)
            raise HTTPException(status_code=429, detail="Too many invalid scan attempts")
        await _incr_with_window(f"qr_soft_block:{ip}", 300)
        raise HTTPException(status_code=429, detail="Too many unique museum scans")


async def enforce_qr_block_state(ip: str) -> None:
    hard = await _get_count(f"qr_hard_block:{ip}", 3600)
    if hard > 0:
        raise HTTPException(status_code=429, detail="Request temporarily blocked")

    soft = await _get_count(f"qr_soft_block:{ip}", 300)
    if soft > 0:
        raise HTTPException(status_code=429, detail="Too many requests")
