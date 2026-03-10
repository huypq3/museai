from __future__ import annotations

import os
from starlette.requests import Request
import pytest

os.environ.setdefault("JWT_SECRET", "x" * 32)

from auth import admin as admin_auth


def _make_request(path: str = "/admin/test", cookie: str | None = None) -> Request:
    headers = []
    if cookie:
        headers.append((b"cookie", cookie.encode("utf-8")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": headers,
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "server": ("testserver", 80),
        "query_string": b"",
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_get_current_admin_accepts_cookie_token(monkeypatch):
    async def _noop_rate_limit(*args, **kwargs):
        return None

    monkeypatch.setattr("security.rate_limit.check_rate_limit", _noop_rate_limit)
    monkeypatch.setattr(
        admin_auth,
        "decode_token",
        lambda token: {"uid": "u1", "username": "admin", "role": "super_admin"},
    )

    cookie_name = admin_auth.ADMIN_AUTH_COOKIE_NAME
    request = _make_request(cookie=f"{cookie_name}=cookie-token")

    payload = await admin_auth.get_current_admin(request=request, authorization=None)

    assert payload["username"] == "admin"
    assert payload["role"] == "super_admin"
