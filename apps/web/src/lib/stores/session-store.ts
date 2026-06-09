import type { Session } from "@pitwall/shared-types";
import { create } from "zustand";

interface SessionState {
  session: Session | null;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  lastUpdated: string | null;
  setSession: (session: Session) => void;
  setConnectionStatus: (status: SessionState["connectionStatus"]) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  connectionStatus: "connecting",
  lastUpdated: null,
  setSession: (session) =>
    set({ session, lastUpdated: new Date().toISOString() }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
