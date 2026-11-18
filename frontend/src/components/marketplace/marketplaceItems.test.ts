import { describe, expect, it } from "bun:test";
import { availableUpdate, compareVersions, formatAge } from "./marketplaceItems.ts";

describe("compareVersions", () => {
  it("compares dotted versions numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.2")).toBe(1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("v2.0.0", "2.0.1")).toBe(-1);
  });
});

describe("availableUpdate", () => {
  it("returns the registry version only when it is newer than the installed one", () => {
    expect(availableUpdate({ kind: "agent", name: "a", version: "1.0.0" }, "1.1.0")).toBe("1.1.0");
    expect(availableUpdate({ kind: "agent", name: "a", version: "1.1.0" }, "1.1.0")).toBeNull();
    expect(availableUpdate({ kind: "agent", name: "a", version: "2.0.0" }, "1.1.0")).toBeNull();
  });

  it("never claims an update when either version is unknown", () => {
    expect(availableUpdate({ kind: "agent", name: "a", version: "" }, "1.1.0")).toBeNull();
    expect(availableUpdate({ kind: "agent", name: "a" }, "1.1.0")).toBeNull();
    expect(availableUpdate({ kind: "agent", name: "a", version: "1.0.0" }, "")).toBeNull();
    expect(availableUpdate(null, "1.0.0")).toBeNull();
  });
});

describe("formatAge", () => {
  const now = 1_000_000_000;
  it("rounds to the largest sensible unit", () => {
    expect(formatAge(now - 10_000, now)).toBe("just now");
    expect(formatAge(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatAge(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatAge(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});
