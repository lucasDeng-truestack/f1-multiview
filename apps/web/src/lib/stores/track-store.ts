import type { CarPosition, TrackGeometry } from "@pitwall/shared-types";
import { create } from "zustand";

interface TrackState {
  geometry: TrackGeometry | null;
  cars: CarPosition[];
  receivedAt: number | null;
  setGeometry: (geometry: TrackGeometry) => void;
  setCars: (cars: CarPosition[]) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  geometry: null,
  cars: [],
  receivedAt: null,
  setGeometry: (geometry) => set({ geometry }),
  setCars: (cars) => set({ cars, receivedAt: Date.now() }),
}));
