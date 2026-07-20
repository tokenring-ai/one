import { describe, expect, test } from "bun:test";
import { bucketTotals, categoryKind, categoryShares, formatUsd, shortCategoryLabel } from "./formatters.ts";

describe("formatUsd", () => {
  test("formats zero", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });

  test("formats typical amounts with up to 4 decimals", () => {
    expect(formatUsd(1.23456)).toMatch(/^\$1\.2346$/);
  });

  test("uses higher precision for tiny amounts", () => {
    expect(formatUsd(0.00042)).toMatch(/\$0\.00042/);
  });

  test("handles non-finite", () => {
    expect(formatUsd(Number.NaN)).toBe("$0.00");
  });
});

describe("shortCategoryLabel", () => {
  test("strips Chat wrapper", () => {
    expect(shortCategoryLabel("Chat (OpenAI:gpt-4o)")).toBe("OpenAI:gpt-4o");
  });

  test("labels image generation", () => {
    expect(shortCategoryLabel("Image Generation (OpenAI:dall-e-3)")).toBe("Image · OpenAI:dall-e-3");
  });

  test("passes through unknown labels", () => {
    expect(shortCategoryLabel("Web Search")).toBe("Web Search");
  });
});

describe("categoryKind", () => {
  test("classifies known prefixes", () => {
    expect(categoryKind("Chat (x)")).toBe("chat");
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
