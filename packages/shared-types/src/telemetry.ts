// Mirrors backend/src/pitwall/models/telemetry.py. Keep both in sync.

export type DrsState = "off" | "eligible" | "on";

export interface TelemetrySample {
  driver_number: number;
  ts: string;
  speed: number | null;
  throttle: number | null;
  brake: boolean;
  gear: number | null;
  rpm: number | null;
  drs: DrsState;
}

export interface TelemetryUpdate {
  driver_number: number;
  is_live: boolean;
  samples: TelemetrySample[];
}
