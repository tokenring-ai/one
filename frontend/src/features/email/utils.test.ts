import { describe, expect, it } from "bun:test";
import type { EmailMessage } from "@tokenring-ai/email";
import { draftFromMessage, formatAddress, isValidEmailList, messageTimestamp, parseEmailAddresses, senderName } from "./utils.ts";

const sampleMessage: EmailMessage = {
  id: "m1",
  threadId: "t1",
  subject: "Hello world",
  from: { email: "alice@example.com", name: "Alice" },
  to: [{ email: "bob@example.com", name: "Bob" }, { email: "carol@example.com" }],
  cc: [{ email: "dave@example.com", name: "Dave" }],
  snippet: "Just saying hi",
  textBody: "Just saying hi\nSecond line",
  isRead: false,
  receivedAt: Date.parse("2024-06-01T12:00:00Z"),
};

describe("parseEmailAddresses", () => {
  it("parses bare emails", () => {
    expect(parseEmailAddresses("a@b.com, c@d.com")).toEqual([{ email: "a@b.com" }, { email: "c@d.com" }]);
  });

  it("parses name-angle form", () => {
    expect(parseEmailAddresses('Alice <alice@ex.com>; "Bob" <bob@ex.com>')).toEqual([
      { email: "alice@ex.com", name: "Alice" },
      { email: "bob@ex.com", name: "Bob" },
    ]);
  });

  it("returns empty for blank input", () => {
    expect(parseEmailAddresses("  ")).toEqual([]);
  });

  it("skips invalid tokens", () => {
    expect(parseEmailAddresses("not-an-email, real@ex.com")).toEqual([{ email: "real@ex.com" }]);
  });
});

describe("isValidEmailList", () => {
  it("accepts valid lists", () => {
    expect(isValidEmailList("a@b.com")).toBe(true);
    expect(isValidEmailList("Alice <a@b.com>, bob@c.com")).toBe(true);
  });

  it("rejects empty or invalid", () => {
    expect(isValidEmailList("")).toBe(false);
    expect(isValidEmailList("nope")).toBe(false);
    expect(isValidEmailList("a@b.com, nope")).toBe(false);
  });
});

describe("senderName", () => {
  it("prefers display name", () => {
    expect(senderName(sampleMessage)).toBe("Alice");
  });

  it("falls back to email", () => {
    expect(senderName({ ...sampleMessage, from: { email: "solo@ex.com" } })).toBe("solo@ex.com");
  });
});

describe("formatAddress", () => {
  it("includes name when present", () => {
    expect(formatAddress({ email: "a@b.com", name: "A" })).toBe("A <a@b.com>");
  });
});

describe("messageTimestamp", () => {
  it("prefers receivedAt", () => {
    expect(messageTimestamp(sampleMessage)).toBe(sampleMessage.receivedAt);
  });

  it("falls back to sentAt", () => {
    expect(messageTimestamp({ ...sampleMessage, receivedAt: 0, sentAt: 99 })).toBe(99);
  });
});

describe("draftFromMessage", () => {
  it("builds a reply draft", () => {
    const draft = draftFromMessage(sampleMessage, "reply");
    expect(draft.mode).toBe("reply");
    expect(draft.to).toBe("Alice <alice@example.com>");
    expect(draft.subject).toBe("Re: Hello world");
    expect(draft.cc).toBe("");
    expect(draft.body).toContain("Alice <alice@example.com> wrote:");
    expect(draft.body).toContain("> Just saying hi");
    expect(draft.relatedMessageId).toBe("m1");
    expect(draft.relatedThreadId).toBe("t1");
  });

  it("does not double Re: prefix", () => {
    const draft = draftFromMessage({ ...sampleMessage, subject: "Re: Already" }, "reply");
    expect(draft.subject).toBe("Re: Already");
  });

  it("builds reply-all with other recipients in cc", () => {
    const draft = draftFromMessage(sampleMessage, "replyAll");
    expect(draft.to).toBe("Alice <alice@example.com>");
    expect(draft.cc).toContain("Bob <bob@example.com>");
    expect(draft.cc).toContain("carol@example.com");
    expect(draft.cc).toContain("Dave <dave@example.com>");
    expect(draft.cc).not.toContain("alice@example.com");
  });

  it("builds a forward draft", () => {
    const draft = draftFromMessage(sampleMessage, "forward");
    expect(draft.mode).toBe("forward");
    expect(draft.to).toBe("");
    expect(draft.subject).toBe("Fwd: Hello world");
    expect(draft.body).toContain("---------- Forwarded message ----------");
    expect(draft.body).toContain("Just saying hi");
  });
});
