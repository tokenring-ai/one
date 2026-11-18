import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConnectionStatus } from "./useConnectionStatus.ts";

type ConnectionState = "connected" | "connecting" | "disconnected";
type Listener = (state: ConnectionState) => void;

let currentState: ConnectionState = "connected";
const listeners = new Set<Listener>();

void mock.module("@tokenring-ai/web-host/createWsRPCClient", () => ({
  isRpcConnectionClosed: () => false,
  getRpcConnectionState: () => currentState,
  subscribeRpcConnection: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
}));

function setConnectionState(state: ConnectionState) {
  currentState = state;
  for (const listener of listeners) listener(state);
}

describe("useConnectionStatus", () => {
  beforeEach(() => {
    listeners.clear();
    currentState = "connected";
  });

  it("reports online when the socket is connected", () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.rpcState).toBe("connected");
  });

  it("stays online through a brief disconnect, then reports offline after the grace period", async () => {
    const { result } = renderHook(() => useConnectionStatus({ disconnectGraceMs: 5 }));

    act(() => {
      setConnectionState("disconnected");
    });
    // Within the grace period the badge must not flash offline.
    expect(result.current.isOnline).toBe(true);
    expect(result.current.rpcState).toBe("disconnected");

    await waitFor(() => expect(result.current.isOnline).toBe(false));

    act(() => {
      setConnectionState("connected");
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("follows reconnect transitions through the exposed rpcState", () => {
    const { result } = renderHook(() => useConnectionStatus({ disconnectGraceMs: 5 }));
    act(() => {
      setConnectionState("connecting");
    });
    expect(result.current.rpcState).toBe("connecting");
    act(() => {
      setConnectionState("disconnected");
    });
    expect(result.current.rpcState).toBe("disconnected");
  });
});

describe("useConnectionStatus subscription race", () => {
  beforeEach(() => {
    listeners.clear();
    currentState = "disconnected";
  });

  it("picks up a transition that lands between render and subscribe", () => {
    // Change the state silently (no listener yet) the moment the hook first reads it,
    // the way a reconnect can complete before the subscribing effect runs.
    let reads = 0;
    const { result } = renderHook(() => {
      const status = useConnectionStatus({ disconnectGraceMs: 5 });
      reads += 1;
      if (reads === 1) currentState = "connected";
      return status;
    });
    expect(result.current.rpcState).toBe("connected");
    expect(result.current.isOnline).toBe(true);
  });
});
