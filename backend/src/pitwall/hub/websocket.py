import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from pitwall.cache.redis import RedisCache

logger = logging.getLogger(__name__)

SNAPSHOT_DOMAINS = (
    "session",
    "timing",
    "track_geometry",
    "track_positions",
    "telemetry",
)

ClientMessageHandler = Callable[[dict[str, Any]], Awaitable[None]]


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("WebSocket client connected (%d total)", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        logger.info("WebSocket client disconnected (%d total)", len(self._connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        if not self._connections:
            return
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        for connection in self._connections:
            try:
                await connection.send_text(payload)
            except Exception:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


class WebSocketHub:
    def __init__(
        self,
        manager: ConnectionManager,
        cache: RedisCache,
        on_client_message: ClientMessageHandler | None = None,
    ) -> None:
        self._manager = manager
        self._cache = cache
        self._on_client_message = on_client_message
        self._listener_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self._listener_task = asyncio.create_task(self._listen_to_redis())

    async def stop(self) -> None:
        if self._listener_task is not None:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass

    async def handle_connection(self, websocket: WebSocket) -> None:
        await self._manager.connect(websocket)
        for domain in SNAPSHOT_DOMAINS:
            snapshot = await self._cache.read_snapshot(domain)
            if snapshot is not None:
                await websocket.send_text(json.dumps(snapshot))
        try:
            while True:
                raw = await websocket.receive_text()
                await self._handle_client_message(raw)
        except WebSocketDisconnect:
            self._manager.disconnect(websocket)

    async def _handle_client_message(self, raw: str) -> None:
        if self._on_client_message is None:
            return
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Ignoring non-JSON WebSocket message")
            return
        if not isinstance(message, dict):
            return
        try:
            await self._on_client_message(message)
        except Exception:
            logger.exception("Client message handler failed")

    async def _listen_to_redis(self) -> None:
        while True:
            try:
                async for _domain, payload in self._cache.subscribe(*SNAPSHOT_DOMAINS):
                    await self._manager.broadcast(payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Redis pub/sub listener failed; retrying in 2s")
                await asyncio.sleep(2)
