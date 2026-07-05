import type { TelemetryUpdate } from "./telemetry";
import type { TimingSnapshot } from "./timing";
import type { TrackGeometry, TrackPositions } from "./track";

export interface Session {
  sessionKey: number | null;
  sessionName: string | null;
  sessionType: string | null;
  circuitShortName: string | null;
  countryName: string | null;
  year: number | null;
  isLive: boolean;
  dateStart: string | null;
  dateEnd: string | null;
}

export type ServerMessage =
  | { type: "session.update"; data: Session }
  | { type: "timing.update"; data: TimingSnapshot }
  | { type: "telemetry.update"; data: TelemetryUpdate }
  | { type: "track.geometry"; data: TrackGeometry }
  | { type: "track.positions"; data: TrackPositions }
  | { type: "error"; message: string };

export type ClientMessage =
  | { type: "subscribe"; channels: string[] }
  | { type: "select_driver"; driver: number }
  | { type: "load_session"; session_key: number }
  | { type: "load_replay"; year: number; round: number; session: string };
