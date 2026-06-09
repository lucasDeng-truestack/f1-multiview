"""Pydantic models for driver telemetry.

Source of truth for the `telemetry.update` WebSocket payload. Mirror any change in
packages/shared-types/src/telemetry.ts in the SAME commit.

OpenF1 /car_data fields (sample rate ~3.7 Hz):
  brake (0 or 100), date, driver_number, drs, n_gear (0-8), rpm, speed (km/h), throttle (%).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

DrsState = Literal["off", "eligible", "on"]


def drs_state(raw: int | None) -> DrsState:
    if raw is None:
        return "off"
    if raw >= 10:
        return "on"
    if raw == 8:
        return "eligible"
    return "off"


class TelemetrySample(BaseModel):
    driver_number: int
    ts: str
    speed: int | None = None
    throttle: int | None = None
    brake: bool = False
    gear: int | None = None
    rpm: int | None = None
    drs: DrsState = "off"


class TelemetryUpdate(BaseModel):
    driver_number: int
    is_live: bool
    samples: list[TelemetrySample]
