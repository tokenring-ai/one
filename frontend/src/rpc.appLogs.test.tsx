import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";

type LogChunk = { position: number; logs: Array<{ timestamp: number; level: "info" | "error"; message: string }> };

const streamCalls: number[] = [];
const SERVER_LOGS = [
  { timestamp: 1, level: "info" as const, message: "a" },
  { timestamp: 2, level: "info" as const, message: "b" },
];

async function* streamLogs({ fromPosition }: { fromPosition: number }, signal: AbortSignal): AsyncGenerator<LogChunk> {
  streamCalls.push(fromPosition);
  const logs = SERVER_LOGS.slice(fromPosition);
  if (logs.length > 0) yield { position: SERVER_LOGS.length, logs };
  await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
}

void mock.module("@tokenring-ai/web-host/createWsRPCClient", () => ({
  isRpcConnectionClosed: () => false,
  default: () => new Proxy({}, { get: (_target, prop) => (prop === "streamLogs" ? streamLogs : async () => ({})) }),
  setWsRPCAuthHandler: () => {},
  resetWsRPCConnections: () => {},
  getRpcConnectionState: () => "connected",
  subscribeRpcConnection: () => () => {},
}));

const { useAppLogs } = await import("./rpc.ts");
const { resetSharedStreams } = await import("./hooks/sharedStreamStore.ts");

afterEach(() => {
  resetSharedStreams();
  streamCalls.length = 0;
});

describe("useAppLogs", () => {
  it("refetches from the start after being disabled and re-enabled", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useAppLogs({ enabled }), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.data?.logs.map(log => log.message)).toEqual(["a", "b"]));

    act(() => rerender({ enabled: false }));
    act(() => rerender({ enabled: true }));

    // The shared buffer was dropped while disabled, so the old position must not be reused.
    await waitFor(() => expect(result.current.data?.logs.map(log => log.message)).toEqual(["a", "b"]));
    expect(streamCalls).toEqual([0, 0]);
  });
});
