import asyncio
import logging
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from pitwall.clients.openf1_auth import OpenF1Auth
from pitwall.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 6
RETRY_BASE_SECONDS = 1.0
# Free tier: 3 req/s — pace all OpenF1 calls through one shared throttle.
MIN_REQUEST_INTERVAL_S = 0.34

_rate_lock = asyncio.Lock()
_last_request_at = 0.0


async def _throttle() -> None:
    global _last_request_at
    async with _rate_lock:
        loop = asyncio.get_running_loop()
        elapsed = loop.time() - _last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_S:
            await asyncio.sleep(MIN_REQUEST_INTERVAL_S - elapsed)
        _last_request_at = loop.time()


class OpenF1Client:
    def __init__(
        self, client: httpx.AsyncClient, auth: OpenF1Auth | None = None
    ) -> None:
        self._client = client
        self._auth = auth

    async def _auth_headers(self) -> dict[str, str]:
        if self._auth is None:
            return {}
        token = await self._auth.get_bearer_token()
        if token:
            return {"Authorization": f"Bearer {token}"}
        return {}

    async def fetch_list(self, endpoint: str, **params: Any) -> list[dict[str, Any]]:
        url = f"{settings.openf1_base_url}/v1/{endpoint}"
        headers = await self._auth_headers()
        response: httpx.Response | None = None
        for attempt in range(MAX_RETRIES):
            await _throttle()
            response = await self._client.get(url, params=params, headers=headers)
            if response.status_code == 429:
                wait = RETRY_BASE_SECONDS * (2**attempt)
                logger.warning(
                    "OpenF1 rate limited on %s — retrying in %.1fs",
                    endpoint,
                    wait,
                )
                await asyncio.sleep(wait)
                continue
            # OpenF1 returns 404 when a filter matches zero rows — not a missing route.
            if response.status_code == 404:
                return []
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
        logger.error("OpenF1 rate limit exhausted on %s — returning empty", endpoint)
        return []

    async def get_latest_session(self) -> dict[str, Any] | None:
        sessions = await self.fetch_list("sessions", session_key="latest")
        if not sessions:
            return None
        return sessions[0]

    async def get_session(self, session_key: int) -> dict[str, Any] | None:
        sessions = await self.fetch_list("sessions", session_key=session_key)
        if not sessions:
            return None
        return sessions[0]

    async def fetch_location_window(
        self,
        session_key: int | str,
        driver_number: int | None,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        # OpenF1 range filters use literal date>/date< operators. Encode the
        # datetime value (+ in +00:00 becomes a space if left unencoded).
        # Omit driver_number to fetch all cars in the window (one request vs N).
        url = (
            f"{settings.openf1_base_url}/v1/location"
            f"?session_key={session_key}"
        )
        if driver_number is not None:
            url += f"&driver_number={driver_number}"
        url += (
            f"&date>{quote(start.isoformat())}"
            f"&date<{quote(end.isoformat())}"
        )
        headers = await self._auth_headers()
        for attempt in range(MAX_RETRIES):
            await _throttle()
            response = await self._client.get(url, headers=headers)
            if response.status_code == 429:
                wait = RETRY_BASE_SECONDS * (2**attempt)
                logger.warning(
                    "OpenF1 rate limited on location window — retrying in %.1fs",
                    wait,
                )
                await asyncio.sleep(wait)
                continue
            if response.status_code == 404:
                return []
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
        logger.error("OpenF1 rate limit exhausted on location window — returning empty")
        return []

    async def fetch_car_data(
        self,
        params: dict[str, Any],
        filters: list[tuple[str, str, str]] | None = None,
    ) -> list[dict[str, Any]]:
        """GET /car_data. Equality params are query-string encoded; comparison
        filters (field, op, value) are appended raw so OpenF1 parses them."""
        url = f"{settings.openf1_base_url}/v1/car_data"
        if filters:
            query = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
            extra = "".join(
                f"&{field}{op}{quote(value)}" for field, op, value in filters
            )
            full_url = f"{url}?{query}{extra}"
        else:
            query = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
            full_url = f"{url}?{query}"

        headers = await self._auth_headers()
        for attempt in range(MAX_RETRIES):
            await _throttle()
            response = await self._client.get(full_url, headers=headers)
            if response.status_code == 429:
                wait = RETRY_BASE_SECONDS * (2**attempt)
                logger.warning(
                    "OpenF1 rate limited on car_data — retrying in %.1fs",
                    wait,
                )
                await asyncio.sleep(wait)
                continue
            if response.status_code == 404:
                return []
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, list) else []
        logger.error("OpenF1 rate limit exhausted on car_data — returning empty")
        return []
