import { getRpcConnectionState, type RpcConnectionState, subscribeRpcConnection } from "@tokenring-ai/web-host/createWsRPCClient";
import { useEffect, useState, useSyncExternalStore } from "react";

/** How long a socket drop must persist before the UI reports "offline". Short
 * reconnects (the stream layer's 1s backoff) should not flash the badge. */
const DISCONNECT_GRACE_MS = 2_500;

function subscribeToRpcConnection(onStoreChange: () => void): () => void {
  return subscribeRpcConnection(() => onStoreChange());
}

/**
 * Connection health for status indicators: the browser's network state AND the
 * actual RPC WebSocket health (tracked by the shared client in
 * `createWsRPCClient`). `isOnline` turns false only after a real drop has
 * persisted past the grace period.
 */
export function useConnectionStatus(options?: { disconnectGraceMs?: number }) {
  const graceMs = options?.disconnectGraceMs ?? DISCONNECT_GRACE_MS;
  const [browserOnline, setBrowserOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  // useSyncExternalStore re-reads the state when it subscribes, so a transition
  // between render and subscription is not lost (it would otherwise stick).
  const rpcState: RpcConnectionState = useSyncExternalStore(subscribeToRpcConnection, getRpcConnectionState, getRpcConnectionState);
  const [reportedOnline, setReportedOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const healthy = browserOnline && rpcState === "connected";

  useEffect(() => {
    if (healthy) {
      setReportedOnline(true);
      return;
    }
    const timer = setTimeout(() => setReportedOnline(false), graceMs);
    return () => clearTimeout(timer);
  }, [healthy, graceMs]);

  return { isOnline: reportedOnline, rpcState, browserOnline };
}
