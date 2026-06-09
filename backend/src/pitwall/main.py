import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from pitwall.api.health import router as health_router
from pitwall.cache.redis import RedisCache, create_redis_client
from pitwall.clients.openf1 import OpenF1Client
from pitwall.clients.openf1_auth import OpenF1Auth
from pitwall.config import settings
from pitwall.hub.websocket import ConnectionManager, WebSocketHub
from pitwall.services.session import SessionService
from pitwall.services.telemetry import TelemetryService
from pitwall.services.timing import TimingService
from pitwall.services.track import TrackService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    redis_client = await create_redis_client()
    cache = RedisCache(redis_client)
    http_client = httpx.AsyncClient(timeout=30.0)
    openf1_auth = OpenF1Auth(http_client)
    openf1 = OpenF1Client(http_client, auth=openf1_auth)

    manager = ConnectionManager()
    session_service = SessionService(openf1, cache)
    timing_service = TimingService(openf1, cache)
    track_service = TrackService(openf1, cache)
    telemetry_service = TelemetryService(openf1, cache)

    async def on_client_message(message: dict) -> None:
        if message.get("type") == "select_driver":
            driver = message.get("driver")
            if isinstance(driver, int):
                telemetry_service.select_driver(driver)

    hub = WebSocketHub(manager, cache, on_client_message=on_client_message)

    app.state.hub = hub

    await hub.start()
    await session_service.start()
    await timing_service.start()
    await track_service.start()
    await telemetry_service.start()
    logger.info(
        "PitWall backend started (replay_mode=%s, session_key=%s)",
        settings.replay_mode,
        settings.replay_session_key if settings.replay_mode else "latest",
    )

    yield

    await telemetry_service.stop()
    await track_service.stop()
    await timing_service.stop()
    await session_service.stop()
    await hub.stop()
    await http_client.aclose()
    await redis_client.aclose()
    logger.info("PitWall backend stopped")


app = FastAPI(title="PitWall", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    hub: WebSocketHub = app.state.hub
    await hub.handle_connection(websocket)
