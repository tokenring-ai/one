import { describe, expect, it } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { useAnnouncer } from "./useAnnouncer.tsx";

let announceRef: (message: string) => void = () => {};

function Harness() {
  const { announce, region } = useAnnouncer();
  announceRef = announce;
  return region;
}

describe("useAnnouncer", () => {
  it("renders one polite, atomic, visually hidden status region", () => {
    render(<Harness />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region).toHaveClass("sr-only");
    expect(region).toHaveTextContent("");
  });

  it("speaks a message", () => {
    render(<Harness />);
    act(() => announceRef("Agent finished"));
    expect(screen.getByRole("status")).toHaveTextContent("Agent finished");
  });

  it("re-announces an identical message by replacing the text node", () => {
    render(<Harness />);
    act(() => announceRef("Agent finished"));
    const first = screen.getByRole("status").firstElementChild;
    act(() => announceRef("Agent finished"));
    const second = screen.getByRole("status").firstElementChild;
    expect(second).toHaveTextContent("Agent finished");
    expect(second).not.toBe(first);
  });
});
