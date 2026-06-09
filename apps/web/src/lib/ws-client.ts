import type { ServerMessage } from "@pitwall/shared-types";

import { useSessionStore } from "./stores/session-store";
import { useTelemetryStore } from "./stores/telemetry-store";
import { useTimingStore } from "./stores/timing-store";
import { useTrackStore } from "./stores/track-store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function dispatch(message: ServerMessage): void {
  switch (message.type) {
    case "session.update":
      useSessionStore.getState().setSession(message.data);
      break;
    case "timing.update":
      useTimingStore.getState().setSnapshot(message.data);
      break;
    case "track.geometry":
      useTrackStore.getState().setGeometry(message.data);
      break;
    case "track.positions":
      useTrackStore.getState().setCars(message.data.cars);
      break;
    case "telemetry.update":
      useTelemetryStore.getState().applyUpdate(message.data);
      break;
    case "error":
      console.error("[ws] server error:", message.message);
      break;
    default:
      break;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  const delay = Math.min(
    BASE_BACKOFF_MS * 2 ** reconnectAttempt,
    MAX_BACKOFF_MS,
  );
  reconnectAttempt += 1;
  useSessionStore.getState().setConnectionStatus("disconnected");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect(): void {
  if (socket?.readyState === WebSocket.OPEN) return;

  useSessionStore.getState().setConnectionStatus("connecting");
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectAttempt = 0;
    useSessionStore.getState().setConnectionStatus("connected");
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as ServerMessage;
      dispatch(message);
    } catch (error) {
      console.error("[ws] failed to parse message", error);
    }
  };

  socket.onerror = () => {
    useSessionStore.getState().setConnectionStatus("error");
  };

  socket.onclose = () => {
    socket = null;
    scheduleReconnect();
  };
}

export function startWsClient(): void {
  if (started) return;
  started = true;
  connect();
}

export function selectDriver(driver: number): void {
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "select_driver", driver }));
}

export function stopWsClient(): void {
  started = false;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  socket?.close();
  socket = null;
}
