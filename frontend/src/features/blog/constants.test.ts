import { describe, expect, test } from "bun:test";
import { parseTagsInput, STATUS_FILTERS, STATUS_STYLES } from "./constants.ts";
import { POST_STATUSES } from "./types.ts";

describe("parseTagsInput", () => {
  test("splits and trims comma-separated tags", () => {
    expect(parseTagsInput("news, product, launch")).toEqual(["news", "product", "launch"]);
  });

  test("drops empty segments", () => {
    expect(parseTagsInput(" a, , b ,")).toEqual(["a", "b"]);
  });

  test("returns empty array for blank input", () => {
    expect(parseTagsInput("")).toEqual([]);
    expect(parseTagsInput("   ")).toEqual([]);
  });
});

describe("blog constants", () => {
  test("STATUS_STYLES covers every post status", () => {
    for (const status of POST_STATUSES) {
      expect(STATUS_STYLES[status]).toBeDefined();
      expect(STATUS_STYLES[status].label.length).toBeGreaterThan(0);
    }
  });

  test("STATUS_FILTERS includes all / draft / published", () => {
    expect(STATUS_FILTERS.map(t => t.id)).toEqual(["all", "draft", "published"]);
  });
});
