import { describe, expect, it } from "bun:test";
import { aspectLabel, formatDuration, keywordsFromPrompt, mediaUrl, workOnMediaMessage } from "./utils.ts";

describe("mediaUrl", () => {
  it("encodes filenames for the static media path", () => {
    expect(mediaUrl("panda.png")).toBe("/api/media/panda.png");
    expect(mediaUrl("a b.png")).toBe("/api/media/a%20b.png");
  });
});

describe("aspectLabel", () => {
  it("classifies square, wide, and tall", () => {
    expect(aspectLabel(100, 100)).toBe("Square");
    expect(aspectLabel(1600, 900)).toBe("Wide");
    expect(aspectLabel(900, 1600)).toBe("Tall");
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss and ignores empty values", () => {
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(125.9)).toBe("2:05");
  });
});

describe("keywordsFromPrompt", () => {
  it("splits and trims punctuation", () => {
    expect(keywordsFromPrompt("A serene mountain lake at sunset!")).toEqual(["A", "serene", "mountain", "lake", "at", "sunset"]);
  });

  it("respects the limit", () => {
    expect(keywordsFromPrompt("one two three four", 2)).toEqual(["one", "two"]);
  });
});

describe("workOnMediaMessage", () => {
  it("includes kind, filename, url, and keywords", () => {
    const msg = workOnMediaMessage("image", "panda.png", ["panda", "wildlife"]);
    expect(msg).toContain("image");
    expect(msg).toContain("Filename: panda.png");
    expect(msg).toContain("URL: /api/media/panda.png");
    expect(msg).toContain("Keywords: panda, wildlife");
  });
});
