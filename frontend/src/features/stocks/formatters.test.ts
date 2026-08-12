import { describe, expect, it } from "bun:test";
import {
  bufferedHistoryRange,
  changeSign,
  fmt,
  fmtHistoryDate,
  fmtMarketCap,
  fmtPrice,
  fmtVol,
  historyRange,
  isoDateOffset,
  parseHistoryDate,
  pricePrecision,
  shiftIsoDate,
  toLocalIsoDate,
} from "./formatters.ts";

describe("pricePrecision", () => {
  it("uses 2 digits for prices >= 10", () => {
    expect(pricePrecision(150)).toBe(2);
  });

  it("uses 3 digits for prices >= 1 and < 10", () => {
    expect(pricePrecision(5.5)).toBe(3);
  });

  it("uses 4 digits for prices < 1", () => {
    expect(pricePrecision(0.05)).toBe(4);
  });
});

describe("fmt", () => {
  it("returns em dash for nullish values", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
  });

  it("formats numbers with default digits", () => {
    expect(fmt(1234.5)).toBe("1,234.50");
  });
});

describe("fmtPrice", () => {
  it("applies dynamic precision", () => {
    expect(fmtPrice(150)).toBe("150.00");
    expect(fmtPrice(0.05)).toBe("0.0500");
  });
});

describe("fmtVol", () => {
  it("abbreviates large volumes", () => {
    expect(fmtVol(1_500_000_000)).toBe("1.50B");
    expect(fmtVol(2_500_000)).toBe("2.50M");
    expect(fmtVol(3_200)).toBe("3.2K");
  });

  it("shows 0 for zero volume instead of missing", () => {
    expect(fmtVol(0)).toBe("0");
    expect(fmtVol("0")).toBe("0");
  });

  it("returns em dash for nullish or invalid", () => {
    expect(fmtVol(null)).toBe("—");
    expect(fmtVol(undefined)).toBe("—");
    expect(fmtVol("")).toBe("—");
    expect(fmtVol("n/a")).toBe("—");
  });
});

describe("fmtMarketCap", () => {
  it("formats market cap in trillions/billions", () => {
    expect(fmtMarketCap(200, 5_000_000_000)).toBe("$1.00T");
    expect(fmtMarketCap(50, 100_000_000)).toBe("$5.00B");
  });

  it("returns em dash when inputs missing", () => {
    expect(fmtMarketCap()).toBe("—");
  });
});

describe("changeSign", () => {
  it("prefixes only strictly positive values with plus", () => {
    expect(changeSign(5)).toBe("+");
    expect(changeSign(-3)).toBe("");
    expect(changeSign(0)).toBe("");
    expect(changeSign("0")).toBe("");
  });

  it("returns empty for nullish or non-numeric", () => {
    expect(changeSign(null)).toBe("");
    expect(changeSign(undefined)).toBe("");
    expect(changeSign("")).toBe("");
    expect(changeSign("n/a")).toBe("");
  });
});

describe("parseHistoryDate", () => {
  it("parses ISO date strings", () => {
    const ts = parseHistoryDate("2024-01-15");
    expect(ts).toBeGreaterThan(0);
  });

  it("leaves millisecond timestamps alone", () => {
    const ms = 1_700_000_000_000;
    expect(parseHistoryDate(ms)).toBe(ms);
  });

  it("normalizes microsecond timestamps", () => {
    const ms = 1_700_000_000_000;
    const micros = ms * 1_000;
    expect(parseHistoryDate(micros)).toBe(ms);
  });

  it("normalizes nanosecond timestamps", () => {
    const ms = 1_700_000_000_000;
    const nanos = ms * 1_000_000;
    expect(parseHistoryDate(nanos)).toBe(ms);
  });

  it("normalizes second timestamps", () => {
    expect(parseHistoryDate(1_700_000_000)).toBe(1_700_000_000_000);
  });
});

describe("fmtHistoryDate", () => {
  it("returns YYYY-MM-DD strings as-is", () => {
    expect(fmtHistoryDate("2024-01-15")).toBe("2024-01-15");
  });

  it("formats epoch milliseconds", () => {
    // 2024-01-15T00:00:00.000Z
    expect(fmtHistoryDate(1_705_276_800_000)).toMatch(/2024-01-1[45]/);
  });

  it("returns em dash for nullish", () => {
    expect(fmtHistoryDate(null)).toBe("—");
  });
});

describe("toLocalIsoDate", () => {
  it("formats local calendar date without UTC skew", () => {
    // 8pm local on July 29 — toISOString would often roll to the next UTC day
    const d = new Date(2026, 6, 29, 20, 0, 0);
    expect(toLocalIsoDate(d)).toBe("2026-07-29");
  });
});

describe("isoDateOffset", () => {
  it("returns YYYY-MM-DD", () => {
    expect(isoDateOffset(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("offsets from local calendar day, not UTC", () => {
    const base = new Date(2026, 6, 29, 22, 0, 0);
    expect(isoDateOffset(0, base)).toBe("2026-07-29");
    expect(isoDateOffset(-1, base)).toBe("2026-07-28");
    expect(isoDateOffset(1, base)).toBe("2026-07-30");
  });
});

describe("shiftIsoDate", () => {
  it("shifts plain YYYY-MM-DD dates", () => {
    expect(shiftIsoDate("2026-07-29", -1)).toBe("2026-07-28");
    expect(shiftIsoDate("2026-07-29", 1)).toBe("2026-07-30");
  });

  it("returns null for invalid input", () => {
    expect(shiftIsoDate("", -1)).toBeNull();
    expect(shiftIsoDate("not-a-date", 1)).toBeNull();
  });
});

describe("bufferedHistoryRange", () => {
  it("applies ±1 day buffer", () => {
    expect(bufferedHistoryRange("2026-01-10", "2026-04-10")).toEqual({
      from: "2026-01-09",
      to: "2026-04-11",
    });
  });

  it("returns null when dates invalid", () => {
    expect(bufferedHistoryRange("", "2026-04-10")).toBeNull();
  });
});

describe("historyRange", () => {
  it("returns from before to, with buffer", () => {
    const { from, to } = historyRange(3);
    expect(from < to).toBe(true);
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
