import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { isExternalHttpUrl, MarkdownAnchor } from "./MarkdownLink.tsx";

describe("isExternalHttpUrl", () => {
  it("detects http(s) and protocol-relative URLs", () => {
    expect(isExternalHttpUrl("https://example.com")).toBe(true);
    expect(isExternalHttpUrl("http://example.com/path")).toBe(true);
    expect(isExternalHttpUrl("//cdn.example.com/x")).toBe(true);
  });

  it("rejects relative and non-http schemes", () => {
    expect(isExternalHttpUrl("/agents")).toBe(false);
    expect(isExternalHttpUrl("agent://x")).toBe(false);
    expect(isExternalHttpUrl("mailto:a@b.com")).toBe(false);
    expect(isExternalHttpUrl(undefined)).toBe(false);
  });
});

describe("MarkdownAnchor", () => {
  it("opens http(s) links in a new tab", () => {
    render(
      <MemoryRouter>
        <MarkdownAnchor href="https://example.com/docs">Docs</MarkdownAnchor>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.getAttribute("href")).toBe("https://example.com/docs");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("keeps relative paths in-app without target=_blank", () => {
    render(
      <MemoryRouter>
        <MarkdownAnchor href="/agents">Agents</MarkdownAnchor>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Agents" });
    expect(link.getAttribute("href")).toBe("/agents");
    expect(link.getAttribute("target")).toBeNull();
  });

  it("maps app schemes to in-app routes", () => {
    render(
      <MemoryRouter>
        <MarkdownAnchor href="workflow://deploy">Deploy</MarkdownAnchor>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Deploy" });
    expect(link.getAttribute("href")).toBe("/workflows/deploy");
    expect(link.getAttribute("target")).toBeNull();
  });
});
