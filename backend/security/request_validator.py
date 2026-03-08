from __future__ import annotations

import os

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

MAX_CONTENT_SIZE = int(os.getenv("MAX_REQUEST_BYTES", str(10 * 1024 * 1024)))


def get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def is_suspicious_request(request: Request) -> bool:
    ua = (request.headers.get("user-agent") or "").lower()
    if not ua:
        return True
    patterns = [
        "sqlmap",
        "nikto",
        "nmap",
        "masscan",
        "acunetix",
        "zgrab",
    ]
    return any(p in ua for p in patterns)


class ContentSizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_content_size: int = MAX_CONTENT_SIZE):
        super().__init__(app)
        self.max_content_size = max_content_size

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > self.max_content_size:
                    return JSONResponse(status_code=413, content={"detail": "Request body too large"})
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(self)"
        return response
