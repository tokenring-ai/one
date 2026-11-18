import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import AutoScrollContainer from "./AutoScrollContainer.tsx";

const resizeCallbacks: Array<() => void> = [];
const originalResizeObserver = globalThis.ResizeObserver;
const originalScrollTo = HTMLElement.prototype.scrollTo;
const scrollToMock = mock((_options?: ScrollToOptions) => {});

class CapturingResizeObserver {
  constructor(callback: () => void) {
    resizeCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setupRegion(scrollHeight: number, clientHeight: number) {
  const region = screen.getByRole("log", { name: "Chat messages" });
  Object.defineProperty(region, "scrollHeight", { configurable: true, get: () => scrollHeight });
  Object.defineProperty(region, "clientHeight", { configurable: true, get: () => clientHeight });
  return region;
}

function userScrollTo(region: HTMLElement, top: number) {
  region.scrollTop = top;
  fireEvent.scroll(region);
}

function contentGrew() {
  act(() => {
    for (const callback of resizeCallbacks) callback();
  });
}

describe("AutoScrollContainer", () => {
  beforeEach(() => {
    resizeCallbacks.length = 0;
    scrollToMock.mockClear();
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
    HTMLElement.prototype.scrollTo = scrollToMock as unknown as typeof HTMLElement.prototype.scrollTo;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.scrollTo = originalScrollTo;
  });

  it("resumes following new output once the user scrolls back to the bottom", () => {
    render(<AutoScrollContainer>content</AutoScrollContainer>);
    const region = setupRegion(1000, 100);

    userScrollTo(region, 400);
    scrollToMock.mockClear();
    contentGrew();
    expect(scrollToMock).not.toHaveBeenCalled();

    // Manually back at the bottom (within the threshold): follow mode is back on.
    userScrollTo(region, 895);
    contentGrew();
    expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "instant" });
  });

  it("ignores the jump button's own smooth-scroll events", () => {
    render(<AutoScrollContainer>content</AutoScrollContainer>);
    const region = setupRegion(1000, 100);

    userScrollTo(region, 100);
    fireEvent.click(screen.getByRole("button", { name: "Scroll to bottom of chat" }));
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 1000, behavior: "smooth" });

    // An intermediate animation frame is not a user scroll-up.
    userScrollTo(region, 500);
    scrollToMock.mockClear();
    contentGrew();
    expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "instant" });
  });

  it("gives each instance a unique scroll-hint id", () => {
    render(
      <>
        <AutoScrollContainer>one</AutoScrollContainer>
        <AutoScrollContainer>two</AutoScrollContainer>
      </>,
    );
    const ids = screen.getAllByRole("log", { name: "Chat messages" }).map(region => region.getAttribute("aria-describedby"));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) expect(document.getElementById(id ?? "")?.textContent).toContain("End key");
  });
});
