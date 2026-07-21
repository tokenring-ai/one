import { describe, expect, it } from "bun:test";
import { resolvePreferredAgentType } from "./agentTypeUtils.ts";

describe("resolvePreferredAgentType", () => {
  const types = [{ type: "coder" }, { type: "writer" }, { type: "blog" }];

  it("picks first matching preferred type", () => {
    expect(resolvePreferredAgentType(types, ["writer", "blog"])?.type).toBe("writer");
  });

  it("falls back to first available type", () => {
    expect(resolvePreferredAgentType(types, ["missing"])?.type).toBe("coder");
  });

  it("uses custom resolver when provided", () => {
    const resolved = resolvePreferredAgentType(types, undefined, ts => ts.find(t => t.type === "blog"));
    expect(resolved?.type).toBe("blog");
  });

  it("returns undefined when types list is empty", () => {
    expect(resolvePreferredAgentType([])).toBeUndefined();
  });
});
