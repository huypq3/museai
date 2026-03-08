from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable


logger = logging.getLogger(__name__)


@dataclass
class SessionState:
    session_id: str
    exhibit_id: str
    language: str
    client_ip: str
    started_at: float = field(default_factory=time.monotonic)
    last_client_activity_at: float = field(default_factory=time.monotonic)
    last_pong_at: float = field(default_factory=time.monotonic)
    messages_in: int = 0
    messages_out: int = 0
    audio_in_bytes: int = 0
    audio_out_bytes: int = 0
    ended: bool = False
    end_reason: str | None = None


class SessionManager:
    """
    Track active websocket sessions and provide global controls.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}
        self._shutdown_hooks: dict[str, Callable[[str], Awaitable[None]]] = {}
        self._lock = asyncio.Lock()
        self._max_global_sessions = int(os.getenv("WS_GLOBAL_MAX_SESSIONS", "500"))

    async def create_session(self, exhibit_id: str, language: str, client_ip: str) -> SessionState:
        async with self._lock:
            if len(self._sessions) >= self._max_global_sessions:
                raise RuntimeError("Global websocket session limit reached")
            session_id = str(uuid.uuid4())
            state = SessionState(
                session_id=session_id,
                exhibit_id=exhibit_id,
                language=language,
                client_ip=client_ip,
            )
            self._sessions[session_id] = state
            return state

    async def get_session(self, session_id: str) -> SessionState | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def touch_client_activity(self, session_id: str) -> None:
        async with self._lock:
            s = self._sessions.get(session_id)
            if s:
                s.last_client_activity_at = time.monotonic()

    async def touch_pong(self, session_id: str) -> None:
        async with self._lock:
            s = self._sessions.get(session_id)
            if s:
                s.last_pong_at = time.monotonic()

    async def incr_in(self, session_id: str, *, audio_bytes: int = 0) -> None:
        async with self._lock:
            s = self._sessions.get(session_id)
            if s:
                s.messages_in += 1
                if audio_bytes > 0:
                    s.audio_in_bytes += audio_bytes

    async def incr_out(self, session_id: str, *, audio_bytes: int = 0) -> None:
        async with self._lock:
            s = self._sessions.get(session_id)
            if s:
                s.messages_out += 1
                if audio_bytes > 0:
                    s.audio_out_bytes += audio_bytes

    async def finish_session(self, session_id: str, reason: str) -> dict[str, Any] | None:
        async with self._lock:
            s = self._sessions.pop(session_id, None)
            if not s:
                return None
            s.ended = True
            s.end_reason = reason
            duration_sec = max(0.0, time.monotonic() - s.started_at)
            return {
                "session_id": s.session_id,
                "exhibit_id": s.exhibit_id,
                "language": s.language,
                "client_ip": s.client_ip,
                "duration_sec": round(duration_sec, 3),
                "messages_in": s.messages_in,
                "messages_out": s.messages_out,
                "audio_in_bytes": s.audio_in_bytes,
                "audio_out_bytes": s.audio_out_bytes,
                "reason": reason,
            }

    async def active_count(self) -> int:
        async with self._lock:
            return len(self._sessions)

    async def metrics_snapshot(self) -> dict[str, Any]:
        async with self._lock:
            sessions = list(self._sessions.values())
        now = time.monotonic()
        durations = [max(0.0, now - s.started_at) for s in sessions]
        avg_duration = (sum(durations) / len(durations)) if durations else 0.0
        return {
            "active_sessions": len(sessions),
            "max_global_sessions": self._max_global_sessions,
            "avg_active_duration_sec": round(avg_duration, 3),
        }

    async def list_stale_sessions(self, *, max_age_sec: float) -> list[str]:
        async with self._lock:
            now = time.monotonic()
            return [
                sid
                for sid, s in self._sessions.items()
                if (now - s.started_at) > max_age_sec
            ]

    async def cleanup_orphans(self, *, max_age_sec: float = 3600.0) -> int:
        stale_ids = await self.list_stale_sessions(max_age_sec=max_age_sec)
        cleaned = 0
        for sid in stale_ids:
            summary = await self.finish_session(sid, reason="orphan_cleanup")
            if summary:
                cleaned += 1
                logger.warning("Cleaned orphan websocket session: %s", summary)
        return cleaned

    async def register_shutdown_hook(self, session_id: str, hook: Callable[[str], Awaitable[None]]) -> None:
        async with self._lock:
            self._shutdown_hooks[session_id] = hook

    async def unregister_shutdown_hook(self, session_id: str) -> None:
        async with self._lock:
            self._shutdown_hooks.pop(session_id, None)

    async def shutdown_all(self, reason: str = "server_shutdown") -> list[str]:
        async with self._lock:
            session_ids = list(self._sessions.keys())
            hooks = {sid: self._shutdown_hooks.get(sid) for sid in session_ids}
        for sid in session_ids:
            hook = hooks.get(sid)
            if not hook:
                continue
            try:
                await hook(reason)
            except Exception:
                logger.exception("Failed shutdown hook for session %s", sid)
        return session_ids
