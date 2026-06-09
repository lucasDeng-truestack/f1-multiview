"""OAuth2 token acquisition for OpenF1 live data.

Live window (30 min before session start → 30 min after end) requires a bearer
token. The free tier allows 3 req/s and 30 req/min — our ~4s timing poll fits.

Credentials stay server-side only. Never expose username/password to clients.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta

import httpx

from pitwall.config import settings

logger = logging.getLogger(__name__)

# Refresh slightly before expiry so in-flight polls don't hit a dead token.
REFRESH_BUFFER_SECONDS = 60


class OpenF1Auth:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client
        self._lock = asyncio.Lock()
        self._access_token: str | None = settings.openf1_token
        self._expires_at: datetime | None = None

    @property
    def is_configured(self) -> bool:
        if settings.openf1_token:
            return True
        return bool(settings.openf1_username and settings.openf1_password)

    async def get_bearer_token(self) -> str | None:
        """Return a valid bearer token, refreshing via OAuth2 when needed."""
        if settings.openf1_token:
            return settings.openf1_token
        if not settings.openf1_username or not settings.openf1_password:
            return None

        async with self._lock:
            now = datetime.now(UTC)
            if (
                self._access_token is not None
                and self._expires_at is not None
                and now < self._expires_at
            ):
                return self._access_token
            await self._fetch_token()
            return self._access_token

    async def _fetch_token(self) -> None:
        url = f"{settings.openf1_base_url}/token"
        response = await self._client.post(
            url,
            data={
                "username": settings.openf1_username,
                "password": settings.openf1_password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        data = response.json()

        # OpenF1 returns expires_in as a string — cast before scheduling refresh.
        raw_expires = data.get("expires_in", 3600)
        expires_in = int(raw_expires)

        token = data.get("access_token")
        if not token:
            raise ValueError("OpenF1 token response missing access_token")

        self._access_token = token
        self._expires_at = datetime.now(UTC) + timedelta(
            seconds=max(expires_in - REFRESH_BUFFER_SECONDS, 0)
        )
        logger.info("OpenF1 OAuth token acquired (expires_in=%ss)", expires_in)
