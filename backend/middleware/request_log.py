from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from collections import deque
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover - optional dependency
    redis = None  # type: ignore[assignment]


REQUEST_LOGS_KEY = "request_logs"
REQUEST_LOGS_MAXLEN = 10000
IN_MEMORY_MAXLEN = 1000
EXCLUDED_PATHS = {"/health", "/docs", "/openapi.json", "/favicon.ico"}


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        normalized = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _parse_user_agent(user_agent: str) -> dict[str, str]:
    ua = (user_agent or "").lower()

    browser = "Unknown"
    if "edg/" in ua:
        browser = "Edge"
    elif "opr/" in ua or "opera" in ua:
        browser = "Opera"
    elif "chrome/" in ua and "safari/" in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"
    elif "trident/" in ua or "msie " in ua:
        browser = "Internet Explorer"

    os_name = "Unknown"
    if "windows nt" in ua:
        os_name = "Windows"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua or "ipod" in ua:
        os_name = "iOS"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"

    device_type = "desktop"
    if any(bot_kw in ua for bot_kw in ("bot", "spider", "crawl", "slurp")):
        device_type = "bot"
    elif "ipad" in ua or "tablet" in ua:
        device_type = "tablet"
    elif "mobile" in ua or "iphone" in ua or ("android" in ua and "mobile" in ua):
        device_type = "mobile"

    return {"browser": browser, "os": os_name, "device_type": device_type}


def classify_api_category(path: str) -> str:
    if path.startswith("/admin/auth/"):
        return "auth"
    if path.startswith("/exhibits/"):
        return "exhibit"
    if path.startswith("/museums/"):
        return "museum"
    if path.startswith("/vision/"):
        return "vision"
    if path.startswith("/ws/"):
        return "websocket"
    if path.startswith("/api/session/"):
        return "session"
    if path.startswith("/admin/"):
        return "admin"
    return "other"


def _extract_path_id(path: str, key: str) -> str | None:
    match = re.search(rf"/{key}/([^/?#]+)", path)
    return match.group(1) if match else None


def extract_museum_id(request: Request, path: str) -> str | None:
    query_museum = request.query_params.get("museum_id")
    if query_museum:
        return query_museum
    return _extract_path_id(path, "museums") or _extract_path_id(path, "museum")


def extract_exhibit_id(path: str) -> str | None:
    return _extract_path_id(path, "exhibits") or _extract_path_id(path, "persona")


class RequestLogStore:
    def __init__(self) -> None:
        self._memory: deque[str] = deque(maxlen=IN_MEMORY_MAXLEN)
        redis_url = os.getenv("REDIS_URL", "").strip()
        self._redis = redis.from_url(redis_url, decode_responses=True) if redis and redis_url else None

    async def push(self, entry: dict[str, Any]) -> None:
        payload = json.dumps(entry, ensure_ascii=False)
        if self._redis:
            try:
                pipe = self._redis.pipeline()
                pipe.lpush(REQUEST_LOGS_KEY, payload)
                pipe.ltrim(REQUEST_LOGS_KEY, 0, REQUEST_LOGS_MAXLEN - 1)
                await pipe.execute()
                return
            except Exception:
                pass
        self._memory.appendleft(payload)

    async def get_all(self) -> list[dict[str, Any]]:
        raw_items: list[str] = []
        if self._redis:
            try:
                raw_items = await self._redis.lrange(REQUEST_LOGS_KEY, 0, REQUEST_LOGS_MAXLEN - 1)
            except Exception:
                raw_items = []
        if not raw_items:
            raw_items = list(self._memory)
        logs: list[dict[str, Any]] = []
        for item in raw_items:
            try:
                parsed = json.loads(item)
                if isinstance(parsed, dict):
                    logs.append(parsed)
            except Exception:
                continue
        return logs

    async def clear_older_than(self, keep_days: int) -> dict[str, int]:
        logs = await self.get_all()
        cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
        kept: list[dict[str, Any]] = []
        removed = 0
        for log in logs:
            ts = _parse_iso(str(log.get("timestamp", "")))
            if ts and ts < cutoff:
                removed += 1
                continue
            kept.append(log)

        if self._redis:
            try:
                payloads = [json.dumps(item, ensure_ascii=False) for item in kept]
                pipe = self._redis.pipeline()
                pipe.delete(REQUEST_LOGS_KEY)
                if payloads:
                    pipe.rpush(REQUEST_LOGS_KEY, *payloads)
                    pipe.ltrim(REQUEST_LOGS_KEY, 0, REQUEST_LOGS_MAXLEN - 1)
                await pipe.execute()
            except Exception:
                self._memory.clear()
                for item in reversed(kept[-IN_MEMORY_MAXLEN:]):
                    self._memory.appendleft(json.dumps(item, ensure_ascii=False))
        else:
            self._memory.clear()
            for item in reversed(kept[-IN_MEMORY_MAXLEN:]):
                self._memory.appendleft(json.dumps(item, ensure_ascii=False))

        return {"removed": removed, "kept": len(kept)}


request_log_store = RequestLogStore()


def get_request_log_store() -> RequestLogStore:
    return request_log_store


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path in EXCLUDED_PATHS:
            return await call_next(request)

        started = perf_counter()
        response = await call_next(request)
        duration_ms = round((perf_counter() - started) * 1000, 2)

        user_agent = request.headers.get("user-agent", "")
        entry = {
            "id": str(uuid.uuid4()),
            "timestamp": _now_utc_iso(),
            "ip": _get_ip(request),
            "method": request.method.upper(),
            "path": path,
            "status_code": int(response.status_code),
            "duration_ms": duration_ms,
            "user_agent": user_agent,
            "user_agent_parsed": _parse_user_agent(user_agent),
            "api_category": classify_api_category(path),
            "is_blocked": int(response.status_code) == 429,
            "museum_id": extract_museum_id(request, path),
            "exhibit_id": extract_exhibit_id(path),
        }

        asyncio.create_task(request_log_store.push(entry))
        return response
