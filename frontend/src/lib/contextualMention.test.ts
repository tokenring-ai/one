import { describe, expect, it } from "bun:test";
import { findActiveMention, replaceActiveMention } from "./contextualMention.ts";

describe("findActiveMention", () => {
  it("finds @query at the start or after whitespace", () => {
    expect(findActiveMention("@foo", 4)).toEqual({ query: "foo", start: 0, end: 4 });
    expect(findActiveMention("hi @bar", 7)).toEqual({ query: "bar", start: 3, end: 7 });
  });

  it("ignores email-like tokens and completed tags", () => {
    expect(findActiveMention("a@b.com", 7)).toBeNull();
    expect(findActiveMention("@[skill:x]", 10)).toBeNull();
  });

  it("returns an empty query for a lone @", () => {
    expect(findActiveMention("say @", 5)).toEqual({ query: "", start: 4, end: 5 });
  });
});

describe("replaceActiveMention", () => {
  it("inserts the tag and a trailing space", () => {
    expect(replaceActiveMention("@fo", { query: "fo", start: 0, end: 3 }, "@[skill:review]")).toEqual({
      next: "@[skill:review] ",
      cursor: 16,
    });
  });
});
