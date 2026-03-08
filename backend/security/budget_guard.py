from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import HTTPException

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover
    redis = None


class GeminiBudgetGuard:
    """
    Budget limiter to cap expensive Gemini usage.
    This is request-count based approximation (not billing API exact cost).
    """

    def __init__(self) -> None:
        self.daily_limit_usd = float(os.getenv("DAILY_GEMINI_BUDGET_USD", "50"))
        self.monthly_limit_usd = float(os.getenv("MONTHLY_GEMINI_BUDGET_USD", "500"))
        self.approx_cost_per_session = float(os.getenv("GEMINI_EST_COST_PER_SESSION_USD", "0.5"))

        redis_url = os.getenv("REDIS_URL", "")
        valid_redis = (
            redis is not None
            and bool(redis_url)
            and "localhost" not in redis_url
            and "127.0.0.1" not in redis_url
        )
        self.redis = redis.from_url(redis_url, decode_responses=True) if valid_redis else None
        self._daily_local = 0.0
        self._monthly_local = 0.0

    def _keys(self) -> tuple[str, str]:
        now = datetime.now(timezone.utc)
        daily = f"gemini_budget:daily:{now.strftime('%Y%m%d')}"
        monthly = f"gemini_budget:monthly:{now.strftime('%Y%m')}"
        return daily, monthly

    async def _get_spend(self) -> tuple[float, float]:
        daily_key, monthly_key = self._keys()
        if self.redis:
            daily = float(await self.redis.get(daily_key) or 0.0)
            monthly = float(await self.redis.get(monthly_key) or 0.0)
            return daily, monthly
        return self._daily_local, self._monthly_local

    async def check_budget(self) -> None:
        daily, monthly = await self._get_spend()
        if daily >= self.daily_limit_usd:
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")
        if monthly >= self.monthly_limit_usd:
            raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    async def record_session_start(self, estimated_cost_usd: float | None = None) -> None:
        amount = estimated_cost_usd if estimated_cost_usd is not None else self.approx_cost_per_session
        daily_key, monthly_key = self._keys()
        if self.redis:
            pipe = self.redis.pipeline()
            pipe.incrbyfloat(daily_key, amount)
            pipe.expire(daily_key, 60 * 60 * 24 * 2)
            pipe.incrbyfloat(monthly_key, amount)
            pipe.expire(monthly_key, 60 * 60 * 24 * 40)
            await pipe.execute()
            return

        self._daily_local += amount
        self._monthly_local += amount


budget_guard = GeminiBudgetGuard()
