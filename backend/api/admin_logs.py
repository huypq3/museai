from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from math import ceil
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query

from middleware.request_log import get_request_log_store
from auth.admin import get_current_admin, require_super_admin

router = APIRouter(prefix="/admin/logs", tags=["admin"])

MethodFilter = Literal["GET", "POST", "PUT", "DELETE", "ALL"]
StatusFilter = Literal["2xx", "3xx", "4xx", "5xx", "ALL"]
CategoryFilter = Literal["auth", "exhibit", "museum", "vision", "websocket", "session", "admin", "other", "ALL"]
BlockedFilter = Literal["true", "false", "all"]
SortFilter = Literal["newest", "oldest"]


def _parse_dt(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    try:
        if len(value) == 10:
            d = date.fromisoformat(value)
            t = time.max if end_of_day else time.min
            return datetime.combine(d, t, tzinfo=timezone.utc)
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _matches_status(code: int, status_filter: StatusFilter) -> bool:
    if status_filter == "ALL":
        return True
    if status_filter == "2xx":
        return 200 <= code < 300
    if status_filter == "3xx":
        return 300 <= code < 400
    if status_filter == "4xx":
        return 400 <= code < 500
    return 500 <= code < 600


def _to_bool(value: BlockedFilter) -> bool | None:
    if value == "all":
        return None
    return value == "true"


def _filter_logs(
    logs: list[dict[str, Any]],
    *,
    method: MethodFilter,
    status: StatusFilter,
    category: CategoryFilter,
    ip: str | None,
    path_contains: str | None,
    is_blocked: BlockedFilter,
    date_from: str | None,
    date_to: str | None,
) -> list[dict[str, Any]]:
    from_dt = _parse_dt(date_from, end_of_day=False)
    to_dt = _parse_dt(date_to, end_of_day=True)
    blocked_filter = _to_bool(is_blocked)
    path_q = (path_contains or "").strip().lower()

    out: list[dict[str, Any]] = []
    for log in logs:
        method_ok = method == "ALL" or str(log.get("method", "")).upper() == method
        if not method_ok:
            continue

        code = int(log.get("status_code", 0) or 0)
        if not _matches_status(code, status):
            continue

        cat = str(log.get("api_category", "other"))
        if category != "ALL" and cat != category:
            continue

        if ip and str(log.get("ip", "")) != ip:
            continue

        if path_q and path_q not in str(log.get("path", "")).lower():
            continue

        if blocked_filter is not None and bool(log.get("is_blocked", False)) is not blocked_filter:
            continue

        ts_raw = str(log.get("timestamp", ""))
        ts = _parse_dt(ts_raw)
        if from_dt and (ts is None or ts < from_dt):
            continue
        if to_dt and (ts is None or ts > to_dt):
            continue

        out.append(log)
    return out


@router.get("")
async def get_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    method: MethodFilter = Query(default="ALL"),
    status: StatusFilter = Query(default="ALL"),
    category: CategoryFilter = Query(default="ALL"),
    ip: str | None = Query(default=None),
    path_contains: str | None = Query(default=None),
    is_blocked: BlockedFilter = Query(default="all"),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    sort: SortFilter = Query(default="newest"),
    admin=Depends(get_current_admin),
):
    require_super_admin(admin)

    store = get_request_log_store()
    logs = await store.get_all()
    filtered = _filter_logs(
        logs,
        method=method,
        status=status,
        category=category,
        ip=ip,
        path_contains=path_contains,
        is_blocked=is_blocked,
        date_from=date_from,
        date_to=date_to,
    )
    if sort == "oldest":
        filtered = list(reversed(filtered))

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = filtered[start:end]
    total_pages = max(1, ceil(total / page_size)) if total > 0 else 1

    return {
        "items": page_items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "has_prev": page > 1,
        "has_next": end < total,
    }


@router.get("/stats")
async def get_logs_stats(admin=Depends(get_current_admin)):
    require_super_admin(admin)
    store = get_request_log_store()
    logs = await store.get_all()

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    last_24h: list[dict[str, Any]] = []
    for log in logs:
        ts = _parse_dt(str(log.get("timestamp", "")))
        if ts and ts >= cutoff:
            last_24h.append(log)

    total_requests = len(last_24h)
    blocked_requests = sum(1 for x in last_24h if bool(x.get("is_blocked", False)))
    avg_duration = round(
        sum(float(x.get("duration_ms", 0) or 0) for x in last_24h) / total_requests, 2
    ) if total_requests else 0.0
    unique_ips = len({str(x.get("ip", "")) for x in last_24h if x.get("ip")})

    category_counts: dict[str, int] = {}
    for x in last_24h:
        cat = str(x.get("api_category", "other"))
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        "total_requests_24h": total_requests,
        "blocked_requests_24h": blocked_requests,
        "avg_response_time_ms_24h": avg_duration,
        "unique_ips_24h": unique_ips,
        "category_counts_24h": category_counts,
    }


@router.delete("/clear")
async def clear_old_logs(admin=Depends(get_current_admin)):
    require_super_admin(admin)
    store = get_request_log_store()
    result = await store.clear_older_than(keep_days=30)
    return {
        "success": True,
        "retention_days": 30,
        **result,
    }
