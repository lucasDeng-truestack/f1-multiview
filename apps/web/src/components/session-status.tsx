"use client";

import { useSessionStore } from "@/lib/stores/session-store";

type State = {
  color: string;
  label: string;
};

/** One dot = one state. The only colour allowed on the neutral session bar.
   No race-control flag feed exists in the contract, so this honestly reflects
   connection + live/replay state rather than inventing a green/yellow/red flag. */
function stateFor(
  status: "connecting" | "connected" | "disconnected" | "error",
  isLive: boolean,
): State {
  if (status === "connecting") return { color: "var(--yellow)", label: "Connecting" };
  if (status === "disconnected")
    return { color: "var(--red)", label: "Reconnecting" };
  if (status === "error") return { color: "var(--red)", label: "Feed lost" };
  // connected
  return isLive
    ? { color: "var(--green)", label: "Live" }
    : { color: "var(--cyan)", label: "Replay" };
}

export function SessionStatus() {
  const session = useSessionStore((s) => s.session);
  const status = useSessionStore((s) => s.connectionStatus);

  const state = stateFor(status, session?.isLive ?? false);

  return (
    <div className="pw-session">
      <span className="pw-wordmark">PitWall</span>
      {session?.circuitShortName && (
        <>
          <span className="pw-session-sep" aria-hidden />
          <span className="pw-session-circuit">{session.circuitShortName}</span>
        </>
      )}
      {session?.sessionName && (
        <span className="pw-session-name">{session.sessionName}</span>
      )}
      <span className="pw-state" role="status">
        <span
          className="pw-state-dot"
          style={{ background: state.color }}
          aria-hidden
        />
        <span className="pw-state-label" style={{ color: state.color }}>
          {state.label}
        </span>
      </span>
    </div>
  );
}
