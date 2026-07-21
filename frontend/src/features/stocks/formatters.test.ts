import { describe, expect, it } from "bun:test";
import { changeSign, fmt, fmtMarketCap, fmtPrice, fmtVol, parseHistoryDate, pricePrecision } from "./formatters.ts";

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
  it("prefixes positive values with plus", () => {
    expect(changeSign(5)).toBe("+");
    expect(changeSign(-3)).toBe("");
  });
});

describe("parseHistoryDate", () => {
  it("parses ISO date strings", () => {
    const ts = parseHistoryDate("2024-01-15");
    expect(ts).toBeGreaterThan(0);
  });

  it("normalizes microsecond timestamps", () => {
    const ms = 1_700_000_000_000;
    const micros = ms * 1_000_000;
    expect(parseHistoryDate(micros)).toBe(ms);
  });
});
