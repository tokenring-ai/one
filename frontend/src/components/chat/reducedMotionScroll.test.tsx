import { afterEach, describe, expect, it, mock } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import AutoScrollContainer from "./AutoScrollContainer.tsx";
import { followOutputBehavior } from "./MessageList.tsx";

const originalMatchMedia = window.matchMedia;
const originalScrollTo = HTMLElement.prototype.scrollTo;

function setReduce(reduce: boolean) {
  window.matchMedia = ((query: string) => ({ matches: reduce && query.includes("reduce"), media: query })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  HTMLElement.prototype.scrollTo = originalScrollTo;
});

describe("smooth scrolling honours reduced motion", () => {
  it("Virtuoso follows output smoothly by default and instantly when reduced", () => {
    setReduce(false);
    expect(followOutputBehavior(true)).toBe("smooth");
    expect(followOutputBehavior(false)).toBe(false);
    setReduce(true);
    expect(followOutputBehavior(true)).toBe("auto");
    expect(followOutputBehavior(false)).toBe(false);
  });

  for (const [reduce, expected] of [
    [false, "smooth"],
    [true, "auto"],
  ] as const) {
    it(`the Home key scrolls with behavior ${expected} when reduce=${reduce}`, () => {
      setReduce(reduce);
      const scrollTo = mock((_options?: ScrollToOptions) => {});
      HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
      render(<AutoScrollContainer>content</AutoScrollContainer>);
      fireEvent.keyDown(screen.getByRole("log", { name: "Chat messages" }), { key: "Home" });
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: expected });
    });
  }

  it('no source file hard-codes behavior: "smooth" outside the helper', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry) && /behavior:\s*["']smooth["']|followOutput=["']smooth["']/.test(readFileSync(path, "utf8")))
          offenders.push(path);
      }
    };
    walk(join(import.meta.dir, "../.."));
    expect(offenders).toEqual([]);
  });
});
