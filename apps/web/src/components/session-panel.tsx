"use client";

import { useEffect } from "react";

import { startWsClient, stopWsClient } from "@/lib/ws-client";
import { useSessionStore } from "@/lib/stores/session-store";

function ConnectionBadge({
  status,
}: {
  status: "connecting" | "connected" | "disconnected" | "error";
}) {
  const colors: Record<typeof status, string> = {
    connecting: "text-yellow",
    connected: "text-green",
    disconnected: "text-text-low",
    error: "text-red",
  };
  const labels: Record<typeof status, string> = {
    connecting: "Connecting",
    connected: "Live",
    disconnected: "Disconnected",
    error: "Error",
  };
  return (
    <span className={`text-[11px] font-mono uppercase tracking-wide ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export function SessionPanel() {
  const { session, connectionStatus, lastUpdated } = useSessionStore();

  useEffect(() => {
    startWsClient();
    return () => stopWsClient();
  }, []);

  const hasSession = session?.sessionKey != null;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-panel border border-border bg-panel p-3">
        <header className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h1 className="text-[13px] text-text-mid">Session</h1>
          <ConnectionBadge status={connectionStatus} />
        </header>

        {!hasSession ? (
          <div className="py-8 text-center">
            <p className="text-[15px] text-text-mid">No live session</p>
            <p className="mt-1 text-[13px] text-text-low">
              Load a replay to explore telemetry.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-low">
                Session key
              </p>
              <p className="font-mono text-[28px] font-semibold text-text-hi">
                {session.sessionKey}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-low">
                  Circuit
                </p>
                <p className="font-mono text-[15px] text-text-hi">
                  {session.circuitShortName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-low">
                  Session
                </p>
                <p className="font-mono text-[15px] text-text-hi">
                  {session.sessionName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-low">
                  Country
                </p>
                <p className="font-mono text-[15px] text-text-hi">
                  {session.countryName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-text-low">
                  Status
                </p>
                <p
                  className={`font-mono text-[15px] ${session.isLive ? "text-green" : "text-text-mid"}`}
                >
                  {session.isLive ? "Live" : "Not live"}
                </p>
              </div>
            </div>
          </div>
        )}

        {lastUpdated && (
          <footer className="border-t border-border pt-2 text-[11px] text-text-low">
            Last update:{" "}
            <span className="font-mono">{lastUpdated}</span>
          </footer>
        )}
      </section>
    </main>
  );
}
