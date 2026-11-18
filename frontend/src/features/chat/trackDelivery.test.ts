import { describe, expect, it } from "bun:test";
import type { RpcConnectionState } from "@tokenring-ai/web-host/createWsRPCClient";
import { type RpcConnectionSource, trackDelivery } from "./trackDelivery.ts";

function fakeConnection(initial: RpcConnectionState) {
  let state = initial;
  const listeners = new Set<(state: RpcConnectionState) => void>();
  const source: RpcConnectionSource = {
    getState: () => state,
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const set = (next: RpcConnectionState) => {
    state = next;
    for (const listener of listeners) listener(next);
  };
  return { source, set, listenerCount: () => listeners.size };
}

describe("trackDelivery", () => {
  it("passes a successful result through", async () => {
    const { source } = fakeConnection("connected");
    expect(await trackDelivery(() => Promise.resolve(42), source)).toEqual({ ok: true, value: 42 });
  });

  it("reports a failure as never sent when the socket was never connected during the call", async () => {
    const { source, set, listenerCount } = fakeConnection("disconnected");
    const result = await trackDelivery(async () => {
      set("connecting");
      set("disconnected");
      throw new Error("WebSocket closed");
    }, source);
    expect(result).toMatchObject({ ok: false, mayHaveBeenSent: false });
    expect(listenerCount()).toBe(0);
  });

  it("reports a failure as maybe sent when the socket was connected at the start", async () => {
    const { source } = fakeConnection("connected");
    const result = await trackDelivery(() => Promise.reject(new Error("WebSocket closed")), source);
    expect(result).toMatchObject({ ok: false, mayHaveBeenSent: true });
  });

  it("reports a failure as maybe sent when the socket connected mid-call", async () => {
    const { source, set } = fakeConnection("connecting");
    const result = await trackDelivery(async () => {
      set("connected");
      set("disconnected");
      throw new Error("WebSocket closed");
    }, source);
    expect(result).toMatchObject({ ok: false, mayHaveBeenSent: true });
  });
});
