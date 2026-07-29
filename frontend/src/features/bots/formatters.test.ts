import { describe, expect, test } from "bun:test";
import { formatDirectMessagePolicy, formatRelativeTime, formatTargetLabel, formatTimestamp, splitTarget } from "./formatters.ts";

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  test("returns em dash for empty values", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime(0, now)).toBe("—");
    expect(formatRelativeTime(undefined, now)).toBe("—");
  });

  test("just now", () => {
    expect(formatRelativeTime(now - 20_000, now)).toBe("just now");
    expect(formatRelativeTime(now + 20_000, now)).toBe("just now");
  });

  test("past minutes and hours", () => {
    expect(formatRelativeTime(now - 10 * 60_000, now)).toBe("10m ago");
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2h ago");
  });

  test("future times", () => {
    expect(formatRelativeTime(now + 10 * 60_000, now)).toBe("in 10m");
    expect(formatRelativeTime(now + 3 * 3_600_000, now)).toBe("in 3h");
  });

  test("days", () => {
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe("3d ago");
  });
});

describe("formatTimestamp", () => {
  test("returns em dash for empty values", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
    expect(formatTimestamp(undefined)).toBe("—");
  });

  test("formats a valid timestamp", () => {
    const result = formatTimestamp(Date.UTC(2026, 0, 15, 14, 30, 0));
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(4);
  });
});

describe("formatDirectMessagePolicy", () => {
  test("maps known policies", () => {
    expect(formatDirectMessagePolicy("listed")).toBe("Listed users only");
    expect(formatDirectMessagePolicy("anyone")).toBe("Anyone");
    expect(formatDirectMessagePolicy("none")).toBe("Disabled");
  });
});

describe("splitTarget", () => {
  test("splits service and id", () => {
    expect(splitTarget("slack:U123ABC")).toEqual({ service: "slack", id: "U123ABC" });
  });

  test("tolerates colons in the id", () => {
    expect(splitTarget("custom:foo:bar")).toEqual({ service: "custom", id: "foo:bar" });
  });

  test("handles missing separator", () => {
    expect(splitTarget("bare")).toEqual({ service: "", id: "bare" });
  });
});

describe("formatTargetLabel", () => {
  test("passes through service:id", () => {
    expect(formatTargetLabel("telegram:123")).toBe("telegram:123");
  });

  test("passes through bare targets", () => {
    expect(formatTargetLabel("bare")).toBe("bare");
  });
});
