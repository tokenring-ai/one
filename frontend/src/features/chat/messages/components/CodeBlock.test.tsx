import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import CodeBlock from "./CodeBlock.tsx";

describe("CodeBlock", () => {
  it("applies syntax highlighting for a known language", () => {
    const { container } = render(<CodeBlock className="language-ts">{"const answer = 42;"}</CodeBlock>);
    const code = container.querySelector("code.hljs");
    expect(code).not.toBeNull();
    expect(container.querySelector(".hljs-keyword")).not.toBeNull();
    expect(code?.textContent).toContain("const answer = 42;");
  });

  it("falls back to auto-detection without a language hint", () => {
    const { container } = render(<CodeBlock>{"function hello() { return 'hi'; }"}</CodeBlock>);
    expect(container.querySelector("code.hljs")).not.toBeNull();
  });

  it("renders plain code when highlighting produces nothing", () => {
    const { container } = render(<CodeBlock className="language-unknownlangxyz">{"plain text"}</CodeBlock>);
    // hljs auto-detect may or may not classify it; the code text must survive.
    expect(container.querySelector("code")?.textContent).toBe("plain text");
  });

  it("toggles line wrap", () => {
    render(<CodeBlock className="language-js">{"const a = 1;"}</CodeBlock>);
    const toggle = screen.getByRole("button", { name: "Enable line wrap" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Disable line wrap" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the language label", () => {
    render(<CodeBlock className="language-python">{"x = 1"}</CodeBlock>);
    expect(screen.getByText("python")).not.toBeNull();
  });
});

describe("CodeBlock HTML safety", () => {
  // highlight.js escapes the source text before wrapping tokens in spans, so the
  // dangerouslySetInnerHTML sink only ever receives escaped text plus hljs spans.
  const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=1</script></code><b>bold</b>`;

  for (const [label, className] of [
    ["an explicit language", "language-html"],
    ["auto-detection", undefined],
    ["an unknown language", "language-nope"],
  ] as const) {
    it(`renders markup in code as text with ${label}`, () => {
      const { container } = render(<CodeBlock {...(className && { className })}>{payload}</CodeBlock>);
      const code = container.querySelector("code");
      expect(code?.textContent).toBe(payload);
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("b")).toBeNull();
      for (const element of Array.from(code?.querySelectorAll("*") ?? [])) {
        expect(element.tagName).toBe("SPAN");
        for (const attribute of Array.from(element.attributes)) expect(attribute.name).toBe("class");
      }
    });
  }
});
