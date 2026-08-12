import { describe, expect, test } from "bun:test";
import {
  bucketTotals,
  categoryKind,
  categoryShares,
  filterAgents,
  formatAgentIdShort,
  formatCount,
  formatMs,
  formatPercent,
  formatTps,
  formatUsd,
  shortCategoryLabel,
  sumRecord,
  topRecordEntries,
} from "./formatters.ts";

describe("formatUsd", () => {
  test("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  test("formats typical amounts with up to 4 decimals", () => {
    expect(formatUsd(1.23456)).toBe("$1.2346");
  });

  test("uses higher precision for tiny amounts", () => {
    expect(formatUsd(0.00042)).toBe("$0.00042");
  });

  test("places the minus sign before the dollar sign", () => {
    expect(formatUsd(-1.5)).toBe("-$1.50");
    expect(formatUsd(-0.00042)).toBe("-$0.00042");
  });

  test("uses en-US grouping for large amounts", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
  });

  test("handles non-finite", () => {
    expect(formatUsd(Number.NaN)).toBe("$0.00");
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  test("formats whole percents", () => {
    expect(formatPercent(0.75)).toBe("75%");
  });

  test("shows less-than-one for tiny shares", () => {
    expect(formatPercent(0.004)).toBe("<1%");
  });

  test("handles non-finite", () => {
    expect(formatPercent(Number.NaN)).toBe("0%");
  });
});

describe("formatCount", () => {
  test("formats zero and small counts", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
  });

  test("compacts thousands and millions", () => {
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(12500)).toBe("12.5k");
    expect(formatCount(2_500_000)).toBe("2.5M");
  });
});

describe("formatMs", () => {
  test("formats ms and seconds", () => {
    expect(formatMs(120)).toBe("120ms");
    expect(formatMs(1500)).toBe("1.50s");
    expect(formatMs(undefined)).toBe("—");
    expect(formatMs(0)).toBe("—");
  });
});

describe("formatTps", () => {
  test("formats throughput", () => {
    expect(formatTps(42.3)).toBe("42.3 tk/s");
    expect(formatTps(150)).toBe("150 tk/s");
    expect(formatTps(0)).toBe("—");
  });
});

describe("sumRecord / topRecordEntries", () => {
  test("sums and ranks records", () => {
    expect(sumRecord({ a: 1, b: 2 })).toBe(3);
    expect(topRecordEntries({ a: 1, b: 5, c: 3 }, 2)).toEqual([
      { key: "b", value: 5 },
      { key: "c", value: 3 },
    ]);
  });
});

describe("formatAgentIdShort", () => {
  test("truncates long ids", () => {
    expect(formatAgentIdShort("abcdefghijklmnop")).toBe("abcdefgh");
  });

  test("passes short ids through", () => {
    expect(formatAgentIdShort("abc")).toBe("abc");
  });

  test("handles empty", () => {
    expect(formatAgentIdShort("")).toBe("—");
  });
});

describe("shortCategoryLabel", () => {
  test("strips Chat wrapper", () => {
    expect(shortCategoryLabel("Chat (OpenAI:gpt-4o)")).toBe("OpenAI:gpt-4o");
  });

  test("labels image generation", () => {
    expect(shortCategoryLabel("Image Generation (OpenAI:dall-e-3)")).toBe("Image · OpenAI:dall-e-3");
  });

  test("labels video generation", () => {
    expect(shortCategoryLabel("Video Generation (Runway:gen-3)")).toBe("Video · Runway:gen-3");
  });

  test("labels structured generation", () => {
    expect(shortCategoryLabel("GenerateObject (OpenAI:gpt-4o)")).toBe("Object · OpenAI:gpt-4o");
  });

  test("passes through unknown labels", () => {
    expect(shortCategoryLabel("Web Search")).toBe("Web Search");
  });
});

describe("categoryKind", () => {
  test("classifies known prefixes", () => {
    expect(categoryKind("Chat (x)")).toBe("chat");
    expect(categoryKind("GenerateObject (x)")).toBe("chat");
    expect(categoryKind("Image Generation (x)")).toBe("image");
    expect(categoryKind("Video Generation (x)")).toBe("video");
    expect(categoryKind("Web Search")).toBe("other");
  });
});

describe("categoryShares", () => {
  test("sorts by amount and computes shares", () => {
    const shares = categoryShares({ a: 1, b: 3 }, 4);
    expect(shares.map(s => s.category)).toEqual(["b", "a"]);
    expect(shares[0]!.share).toBeCloseTo(0.75);
    expect(shares[1]!.share).toBeCloseTo(0.25);
  });

  test("handles zero total", () => {
    const shares = categoryShares({ a: 0 }, 0);
    expect(shares[0]!.share).toBe(0);
  });
});

describe("bucketTotals", () => {
  test("buckets chat vs media vs other", () => {
    const buckets = bucketTotals({
      "Chat (m)": 1,
      "Image Generation (m)": 2,
      "Video Generation (m)": 3,
      "Web Search": 4,
    });
    expect(buckets.chat).toBe(1);
    expect(buckets.media).toBe(5);
    expect(buckets.other).toBe(4);
  });
});

describe("filterAgents", () => {
  const agents = [
    { agentId: "a1", displayName: "Code #1", agentType: "code", idle: false },
    { agentId: "a2", displayName: "Researcher", agentType: "research", idle: true },
    { agentId: "a3", displayName: "Code #2", agentType: "code", idle: true },
  ];

  test("filters by status", () => {
    expect(filterAgents(agents, "all")).toHaveLength(3);
    expect(filterAgents(agents, "active").map(a => a.agentId)).toEqual(["a1"]);
    expect(filterAgents(agents, "idle").map(a => a.agentId)).toEqual(["a2", "a3"]);
  });

  test("filters by search", () => {
    expect(filterAgents(agents, "all", "research").map(a => a.agentId)).toEqual(["a2"]);
    expect(filterAgents(agents, "idle", "code").map(a => a.agentId)).toEqual(["a3"]);
  });
});
