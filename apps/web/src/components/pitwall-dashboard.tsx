"use client";

import { useEffect } from "react";

import { PitWallGrid } from "@/components/pitwall-grid";
import { startWsClient, stopWsClient } from "@/lib/ws-client";
import { useSessionStore } from "@/lib/stores/session-store";

export function PitWallDashboard() {
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    startWsClient();
    return () => stopWsClient();
  }, []);

  // Title reflects what the wall is showing — circuit + session when loaded.
  useEffect(() => {
    const parts = [session?.circuitShortName, session?.sessionName].filter(
      Boolean,
    );
    document.title = parts.length
      ? `${parts.join(" · ")} — PitWall`
      : "PitWall";
  }, [session?.circuitShortName, session?.sessionName]);

  return <PitWallGrid />;
}
