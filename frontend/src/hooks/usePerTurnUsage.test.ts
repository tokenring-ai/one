import { describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { ChatMessage } from "../types/agent-events.ts";
import { usePerTurnUsage } from "./usePerTurnUsage.ts";

const response: ChatMessage = {
  type: "agent.response",
  status: "success",
  requestId: "r1",
  message: "done",
  timestamp: Date.now(),
};

interface HookProps {
  status: string | null | undefined;
  snapshot: { costTotal: number; totalTokens: number } | null;
  messages: ChatMessage[];
}

describe("usePerTurnUsage", () => {
  it("binds a usage snapshot to the newest unbound response once", () => {
    const initial: HookProps = { status: undefined, snapshot: null, messages: [response] };
    const { result, rerender } = renderHook((props: HookProps) => usePerTurnUsage(props.status, props.snapshot, props.messages), {
      initialProps: initial,
    });

    // No usage yet: nothing bound.
    expect(result.current.size).toBe(0);

    // Usage for the completed turn arrives.
    rerender({ status: "success", snapshot: { costTotal: 0.42, totalTokens: 1234 }, messages: [response] });
    expect(result.current.get("r1")).toEqual({ costTotal: 0.42, totalTokens: 1234 });

    // Re-renders with the same data do not duplicate or change the entry.
    rerender({ status: "success", snapshot: { costTotal: 0.42, totalTokens: 1234 }, messages: [response] });
    expect(result.current.get("r1")).toEqual({ costTotal: 0.42, totalTokens: 1234 });
  });

  it("binds each new response as its usage arrives", () => {
    const second: ChatMessage = { type: "agent.response", status: "success", requestId: "r2", message: "again", timestamp: Date.now() };
    const { result, rerender } = renderHook((props: HookProps) => usePerTurnUsage(props.status, props.snapshot, props.messages), {
      initialProps: { status: "success", snapshot: { costTotal: 0.1, totalTokens: 10 }, messages: [response] } as HookProps,
    });
    expect(result.current.get("r1")).toEqual({ costTotal: 0.1, totalTokens: 10 });

    // New turn completes with a different usage snapshot.
    rerender({ status: "success", snapshot: { costTotal: 0.2, totalTokens: 20 }, messages: [response, second] });
    expect(result.current.get("r2")).toEqual({ costTotal: 0.2, totalTokens: 20 });
    expect(result.current.get("r1")).toEqual({ costTotal: 0.1, totalTokens: 10 });
  });

  it("does not bind a response that completes without a usage change", () => {
    const old: ChatMessage = { type: "agent.response", status: "success", requestId: "old", message: "old", timestamp: Date.now() - 60_000 };
    const { result, rerender } = renderHook((props: HookProps) => usePerTurnUsage(props.status, props.snapshot, props.messages), {
      initialProps: { status: undefined, snapshot: null, messages: [old] } as HookProps,
    });

    // No usage yet: nothing bound.
    expect(result.current.size).toBe(0);

    // The first usage snapshot describes the last completed turn: it binds there.
    rerender({ status: "success", snapshot: { costTotal: 1, totalTokens: 5 }, messages: [old] });
    expect(result.current.get("old")).toEqual({ costTotal: 1, totalTokens: 5 });

    // A new response with no subsequent usage change must not show stale numbers.
    const fresh: ChatMessage = { type: "agent.response", status: "success", requestId: "fresh", message: "fresh", timestamp: Date.now() };
    rerender({ status: "success", snapshot: { costTotal: 1, totalTokens: 5 }, messages: [old, fresh] });
    expect(result.current.has("fresh")).toBe(false);
    expect(result.current.get("old")).toEqual({ costTotal: 1, totalTokens: 5 });
  });
});
