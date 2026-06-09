import type { TimingSnapshot } from "@pitwall/shared-types";
import { create } from "zustand";

interface TimingState {
  snapshot: TimingSnapshot | null;
  setSnapshot: (snapshot: TimingSnapshot) => void;
}

export const useTimingStore = create<TimingState>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
}));
