import { create } from "zustand";
import type { TelemetrySample, TelemetryUpdate } from "@pitwall/shared-types";

const TRACE_SECONDS = 30;

function trimToWindow(samples: TelemetrySample[]): TelemetrySample[] {
  if (!samples.length) return [];
  const newest = Date.parse(samples[samples.length - 1].ts);
  const cutoff = newest - TRACE_SECONDS * 1000;
  return samples.filter((s) => Date.parse(s.ts) >= cutoff);
}

interface TelemetryState {
  driverNumber: number | null;
  isLive: boolean;
  buffer: TelemetrySample[];
  setDriver: (driver: number) => void;
  applyUpdate: (update: TelemetryUpdate) => void;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  driverNumber: null,
  isLive: false,
  buffer: [],

  setDriver: (driver) => set({ driverNumber: driver, buffer: [], isLive: false }),

  applyUpdate: (update) => {
    if (update.driver_number !== get().driverNumber) return;

    const merged = update.is_live
      ? [...get().buffer, ...update.samples]
      : update.samples;

    set({
      buffer: trimToWindow(merged),
      isLive: update.is_live,
    });
  },

  clear: () => set({ buffer: [], driverNumber: null, isLive: false }),
}));
