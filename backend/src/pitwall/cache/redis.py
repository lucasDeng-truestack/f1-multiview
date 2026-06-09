import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import redis.asyncio as redis

from pitwall.config import settings

logger = logging.getLogger(__name__)

SNAPSHOT_PREFIX = "snapshot:"
CHANNEL_PREFIX = "channel:"


class RedisCache:
    def __init__(self, client: redis.Redis) -> None:  # type: ignore[type-arg]
        self._client = client

    async def write_snapshot(self, domain: str, payload: dict[str, Any]) -> None:
        key = f"{SNAPSHOT_PREFIX}{domain}"
        await self._client.set(key, json.dumps(payload))

    async def read_snapshot(self, domain: str) -> dict[str, Any] | None:
        key = f"{SNAPSHOT_PREFIX}{domain}"
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def publish(self, domain: str, payload: dict[str, Any]) -> None:
        channel = f"{CHANNEL_PREFIX}{domain}"
        await self._client.publish(channel, json.dumps(payload))

    async def subscribe(self, *domains: str) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        channels = [f"{CHANNEL_PREFIX}{domain}" for domain in domains]
        pubsub = self._client.pubsub()
        await pubsub.subscribe(*channels)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                channel = str(message["channel"])
                domain = channel.removeprefix(CHANNEL_PREFIX)
                data = json.loads(message["data"])
                yield domain, data
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()


async def create_redis_client() -> redis.Redis:  # type: ignore[type-arg]
    # Pub/sub listen() blocks until a message arrives; default socket_timeout (5s)
    # would raise TimeoutError between poll intervals.
    return redis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_timeout=None,
    )
