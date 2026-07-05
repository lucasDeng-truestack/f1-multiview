"use client";

import { SessionBrowser } from "@/components/session-browser";
import { useSessionStore } from "@/lib/stores/session-store";

import "./grid.css";
import "./no-session-home.css";

type Status = "connecting" | "connected" | "disconnected" | "error";

// Factual, engineer's register. Direction, not apology.
function line(status: Status): { color: string; text: string } {
  switch (status) {
    case "connecting":
      return { color: "var(--yellow)", text: "Connecting to timing feed…" };
    case "connected":
      return { color: "var(--cyan)", text: "Connected — waiting for a session." };
    case "disconnected":
      return { color: "var(--red)", text: "Timing feed lost — retrying." };
    case "error":
      return { color: "var(--red)", text: "Timing feed lost — retrying." };
  }
}

export function NoSessionHome() {
  const status = useSessionStore((s) => s.connectionStatus);
  const state = line(status);

  return (
    <div className="pw-home">
      <div className="pw-home-inner">
        <header className="pw-home-head">
          <span className="pw-home-mark">PitWall</span>
          <p className="pw-home-tagline">Read the race the way an engineer does.</p>
          <div className="pw-home-state" role="status">
            <span
              className={`pw-state-dot${
                status === "connecting" ? " pw-dot-pulse" : ""
              }`}
              style={{ background: state.color }}
              aria-hidden
            />
            <span style={{ color: state.color }}>{state.text}</span>
          </div>
          <div className="pw-home-action">
            <SessionBrowser label="Load replay" />
          </div>
        </header>

        {/* A dim preview of the workspace, not an empty box — the wall is
            standing by. Panels populate the moment a session streams. */}
        <div className="pw-home-preview" aria-hidden>
          <div className="pw-ghost pw-ghost-timing">
            <span className="pw-ghost-title">Live timing</span>
          </div>
          <div className="pw-ghost pw-ghost-track">
            <span className="pw-ghost-title">Track map</span>
          </div>
          <div className="pw-ghost pw-ghost-tel">
            <span className="pw-ghost-title">Telemetry</span>
          </div>
        </div>

        <p className="pw-home-hint">
          Replay runs by default — start the backend to load the wall.
        </p>
      </div>
    </div>
  );
}
