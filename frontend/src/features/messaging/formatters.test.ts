import { describe, expect, test } from "bun:test";
import { formatRelativeTime, formatServiceName, formatTimestamp, serviceGradient } from "./formatters.ts";

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  test("handles missing timestamps", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime(undefined, now)).toBe("—");
    expect(formatRelativeTime(0, now)).toBe("—");
  });

  test("formats recent activity", () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toBe("3d ago");
  });
});

describe("formatTimestamp", () => {
  test("handles missing timestamps", () => {
    expect(formatTimestamp(null)).toBe("—");
    expect(formatTimestamp(0)).toBe("—");
  });
});

describe("formatServiceName", () => {
  test("title-cases service ids", () => {
    expect(formatServiceName("slack")).toBe("Slack");
    expect(formatServiceName("telegram")).toBe("Telegram");
    expect(formatServiceName("x")).toBe("X");
    expect(formatServiceName("")).toBe("Unknown");
  });
});

describe("serviceGradient", () => {
  test("maps known services", () => {
    expect(serviceGradient("slack")).toContain("purple");
    expect(serviceGradient("telegram")).toContain("sky");
    expect(serviceGradient("email")).toContain("red");
    expect(serviceGradient("unknown")).toContain("emerald");
  });
});
