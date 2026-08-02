import { describe, expect, it } from "bun:test";
import { formatBytes, formatCaptureTime, prettyPrintSnapshot } from "./formatters.ts";

describe("formatBytes", () => {
  it("uses the largest unit that keeps the number small", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatCaptureTime", () => {
  it("shows only the time for captures made today", () => {
    const today = new Date();
    today.setHours(14, 37, 1, 0);
    expect(formatCaptureTime(today.getTime())).toBe(today.toLocaleTimeString(undefined, { hour12: false }));
  });

  it("includes the date for older captures", () => {
    const earlier = new Date(2020, 0, 1, 14, 37, 1);
    expect(formatCaptureTime(earlier.getTime())).toContain(earlier.toLocaleDateString());
  });
});

describe("prettyPrintSnapshot", () => {
  it("re-indents JSON with two spaces", () => {
    expect(prettyPrintSnapshot('{"a":{"b":1}}')).toBe('{\n  "a": {\n    "b": 1\n  }\n}');
  });

  it("leaves text that is not JSON alone", () => {
    expect(prettyPrintSnapshot("not json")).toBe("not json");
  });
});
