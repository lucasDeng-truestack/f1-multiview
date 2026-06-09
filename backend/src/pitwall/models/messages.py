from pydantic import BaseModel, Field

from pitwall.models.telemetry import TelemetryUpdate
from pitwall.models.timing import TimingSnapshot
from pitwall.models.track import TrackGeometry, TrackPositions


class Session(BaseModel):
    session_key: int | None = None
    session_name: str | None = None
    session_type: str | None = None
    circuit_short_name: str | None = None
    country_name: str | None = None
    year: int | None = None
    is_live: bool = False
    date_start: str | None = None
    date_end: str | None = None


class SessionUpdateMessage(BaseModel):
    type: str = Field(default="session.update", frozen=True)
    data: Session


class TimingUpdateMessage(BaseModel):
    type: str = Field(default="timing.update", frozen=True)
    data: TimingSnapshot


class TelemetryUpdateMessage(BaseModel):
    type: str = Field(default="telemetry.update", frozen=True)
    data: TelemetryUpdate


class TrackGeometryMessage(BaseModel):
    type: str = Field(default="track.geometry", frozen=True)
    data: TrackGeometry


class TrackPositionsMessage(BaseModel):
    type: str = Field(default="track.positions", frozen=True)
    data: TrackPositions


class ErrorMessage(BaseModel):
    type: str = Field(default="error", frozen=True)
    message: str
