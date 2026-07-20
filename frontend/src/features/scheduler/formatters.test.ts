import { describe, expect, test } from "bun:test";
import { formatDuration, formatRelativeTime, formatScheduleSummary, formatScheduleTime, truncateMessage } from "./formatters.ts";

describe("formatScheduleTime", () => {
  test("returns em dash for empty values", () => {
    expect(formatScheduleTime(null)).toBe("—");
    expect(formatScheduleTime(0)).toBe("—");
    expect(formatScheduleTime(undefined)).toBe("—");
  });

  test("formats a valid timestamp", () => {
    const result = formatScheduleTime(Date.UTC(2026, 0, 15, 14, 30, 0));
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(4);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  test("handles empty", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
  });

  test("future minutes", () => {
    expect(formatRelativeTime(now + 10 * 60_000, now)).toBe("in 10m");
  });

  test("past hours", () => {
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2h ago");
  });
});

describe("formatScheduleSummary", () => {
  test("one-time default", () => {
    expect(formatScheduleSummary({})).toBe("One-time");
  });

  test("repeat with window and weekdays", () => {
    expect(
      formatScheduleSummary({
        repeat: "1 day",
        after: "09:00",
        before: "17:00",
        weekdays: "mon tue wed thu fri",
        timezone: "UTC",
      }),
    ).toBe("Every 1 day · 09:00–17:00 · mon tue wed thu fri · UTC");
  });
});

describe("formatDuration", () => {
  test("seconds", () => {
    expect(formatDuration(0, 4500)).toBe("5s");
  });

  test("minutes", () => {
    expect(formatDuration(0, 90_000)).toBe("1m 30s");
    expect(formatDuration(0, 120_000)).toBe("2m");
  });
});

describe("truncateMessage", () => {
  test("short messages unchanged", () => {
    expect(truncateMessage("hello")).toBe("hello");
  });

  test("long messages truncated", () => {
    const long = "a".repeat(200);
    const result = truncateMessage(long, 20);
    expect(result.length).toBe(20);
    expect(result.endsWith("…")).toBe(true);
  });
});
