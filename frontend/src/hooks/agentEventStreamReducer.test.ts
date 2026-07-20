// @vitest-environment node
import { describe, expect, it } from "bun:test";
import { createInitialAgentEventStreamState, reduceAgentEventStreamChunk } from "./agentEventStreamReducer.ts";

describe("reduceAgentEventStreamChunk", () => {
  it("marks agentNotFound without clearing prior messages", () => {
    const prev = {
      ...createInitialAgentEventStreamState(),
      messages: [{ type: "output.info" as const, message: "hello", timestamp: 1 }],
      position: 3,
    };

    const next = reduceAgentEventStreamChunk(prev, { status: "agentNotFound" });

    expect(next.agentNotFound).toBe(true);
    expect(next.messages).toHaveLength(1);
    expect(next.position).toBe(3);
  });

  it("merges consecutive streaming chat chunks", () => {
    const prev = createInitialAgentEventStreamState();
    const first = reduceAgentEventStreamChunk(prev, {
      status: "success",
      position: 1,
      events: [{ type: "output.chat", message: "Hel", timestamp: 1 }],
    });
    const second = reduceAgentEventStreamChunk(first, {
      status: "success",
      position: 2,
      events: [{ type: "output.chat", message: "lo", timestamp: 2 }],
    });

    expect(second.messages).toHaveLength(1);
    expect(second.messages[0]).toMatchObject({ type: "output.chat", message: "Hello" });
    expect(second.position).toBe(2);
  });
});
