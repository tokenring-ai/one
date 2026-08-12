import { describe, expect, test } from "bun:test";
import { formatDurationBetween, formatDurationMs, formatQueueTime, formatRelativeTime, truncateText } from "./formatters.ts";

describe("formatQueueTime", () => {
  test("returns em dash for empty values", () => {
    expect(formatQueueTime(null)).toBe("—");
    expect(formatQueueTime(0)).toBe("—");
    expect(formatQueueTime(undefined)).toBe("—");
  });

  test("formats a valid timestamp", () => {
    const result = formatQueueTime(Date.UTC(2026, 0, 15, 14, 30, 0));
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(4);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  test("handles empty", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
  });

  test("just now", () => {
    expect(formatRelativeTime(now - 10_000, now)).toBe("just now");
  });

  test("future minutes", () => {
    expect(formatRelativeTime(now + 10 * 60_000, now)).toBe("in 10m");
  });

  test("past hours", () => {
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2h ago");
  });
});

describe("formatDurationMs", () => {
  test("empty", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(-1)).toBe("—");
  });

  test("milliseconds", () => {
    expect(formatDurationMs(450)).toBe("450ms");
  });

  test("seconds", () => {
    expect(formatDurationMs(4500)).toBe("5s");
  });

  test("minutes", () => {
    expect(formatDurationMs(90_000)).toBe("1m 30s");
    expect(formatDurationMs(120_000)).toBe("2m");
  });

  test("hours", () => {
    expect(formatDurationMs(3_600_000)).toBe("1h");
    expect(formatDurationMs(3_600_000 + 120_000)).toBe("1h 2m");
  });
});

describe("formatDurationBetween", () => {
  test("empty", () => {
    expect(formatDurationBetween(null, 100)).toBe("—");
    expect(formatDurationBetween(100, null)).toBe("—");
  });

  test("positive span", () => {
    expect(formatDurationBetween(0, 5000)).toBe("5s");
  });
});

describe("truncateText", () => {
  test("short messages unchanged", () => {
    expect(truncateText("hello")).toBe("hello");
  });

  test("collapses whitespace", () => {
    expect(truncateText("a   b\nc")).toBe("a b c");
  });

  test("long messages truncated with ellipsis", () => {
    const long = "a".repeat(200);
    const result = truncateText(long, 20);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  test("breaks at word boundary when possible", () => {
    const text = "Please refactor the authentication module to use OAuth2";
    const result = truncateText(text, 40);
    // Hard cut at 39 would leave "…modul…"; word break drops the partial word.
    expect(result).toBe("Please refactor the authentication…");
  });

  test("falls back to hard cut when no good word break exists", () => {
    const long = "supercalifragilisticexpialidocious-word";
    const result = truncateText(long, 20);
    expect(result).toBe(`${long.slice(0, 19)}…`);
  });
});
