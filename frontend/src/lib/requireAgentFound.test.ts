import { describe, expect, it } from "bun:test";
import { requireAgentFound } from "./requireAgentFound.ts";

describe("requireAgentFound", () => {
  it("passes other results through and throws for a missing agent", () => {
    expect(requireAgentFound({ status: "success" as const, requestId: "r" })).toEqual({ status: "success", requestId: "r" });
    expect(() => requireAgentFound({ status: "agentNotFound" })).toThrow("no longer running");
  });
});
