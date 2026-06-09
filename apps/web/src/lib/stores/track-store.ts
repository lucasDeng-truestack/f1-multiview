import type { CarPosition, TrackGeometry } from "@pitwall/shared-types";
import { create } from "zustand";

interface TrackState {
  geometry: TrackGeometry | null;
  cars: CarPosition[];
  setGeometry: (geometry: TrackGeometry) => void;
  setCars: (cars: CarPosition[]) => void;
}

export const useTrackStore = create<TrackState>((set) => ({
  geometry: null,
  cars: [],
  setGeometry: (geometry) => set({ geometry }),
  setCars: (cars) => set({ cars }),
}));
