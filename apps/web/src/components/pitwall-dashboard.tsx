"use client";

import { useEffect } from "react";

import { PitWallGrid } from "@/components/pitwall-grid";
import { startWsClient, stopWsClient } from "@/lib/ws-client";

export function PitWallDashboard() {
  useEffect(() => {
    startWsClient();
    return () => stopWsClient();
  }, []);

  return <PitWallGrid />;
}
