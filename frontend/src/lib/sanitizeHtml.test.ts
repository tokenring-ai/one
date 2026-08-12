import { describe, expect, it } from "bun:test";
import { sanitizeBlogHtml, sanitizeDesignHtml, sanitizeEmailHtml } from "./sanitizeHtml.ts";

describe("sanitizeBlogHtml", () => {
  it("preserves safe blog markup", () => {
    const html = '<h2>Title</h2><p>Hello <strong>world</strong></p><a href="https://example.com">link</a>';
    expect(sanitizeBlogHtml(html)).toBe(html);
  });

  it("strips script tags and inline event handlers", () => {
    const html = '<p onclick="alert(1)">Hi</p><script>alert("xss")</script>';
    expect(sanitizeBlogHtml(html)).toBe("<p>Hi</p>");
  });

  it("blocks javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">bad</a>';
    expect(sanitizeBlogHtml(html)).not.toContain("javascript:");
  });
});

describe("sanitizeDesignHtml", () => {
  it("preserves inline scripts and styles for live preview", () => {
    const html = "<style>body{color:red}</style><p>Hi</p><script>console.log(1)</script>";
    const sanitized = sanitizeDesignHtml(html);
    expect(sanitized).toContain("<style>");
    expect(sanitized).toContain("<script>");
    expect(sanitized).toContain("Hi");
  });

  it("strips inline event handlers and nested iframes", () => {
    const html = '<p onclick="alert(1)">Hi</p><iframe src="https://evil.test"></iframe>';
    const sanitized = sanitizeDesignHtml(html);
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("<iframe");
    expect(sanitized).toContain("Hi");
  });

  it("blocks javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">bad</a>';
    expect(sanitizeDesignHtml(html)).not.toContain("javascript:");
  });
});

describe("sanitizeEmailHtml", () => {
  it("preserves common email markup and cid images", () => {
    const html = '<table><tr><td align="center">Hello</td></tr></table><img src="cid:abc123" alt="logo">';
    const sanitized = sanitizeEmailHtml(html);
    expect(sanitized).toContain("<table>");
    expect(sanitized).toContain('align="center"');
    expect(sanitized).toContain('src="cid:abc123"');
    expect(sanitized).toContain("Hello");
  });

  it("strips scripts and event handlers", () => {
    const html = '<p onclick="alert(1)">Hi</p><script>alert("xss")</script>';
    expect(sanitizeEmailHtml(html)).toBe("<p>Hi</p>");
  });

  it("blocks javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">bad</a>';
    expect(sanitizeEmailHtml(html)).not.toContain("javascript:");
  });
});
