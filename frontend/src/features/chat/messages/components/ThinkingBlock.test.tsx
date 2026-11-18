import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThinkingBlock from "./ThinkingBlock.tsx";

describe("ThinkingBlock", () => {
  it("shows a character count to the right of Thinking ... when collapsed", () => {
    const message = "abcdefghij";
    render(<ThinkingBlock message={message} />);

    expect(screen.getByText("Thinking ...")).toBeInTheDocument();
    expect(screen.getByText(`${message.length.toLocaleString()} chars`)).toBeInTheDocument();
    expect(screen.queryByText(message)).toBeNull();
  });

  it("keeps the character count when expanded and scrolls in a full-width container", async () => {
    const user = userEvent.setup();
    const message = "the model is thinking about this";
    render(<ThinkingBlock message={message} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText(`${message.length.toLocaleString()} chars`)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();

    const content = screen.getByText(message).closest("div");
    expect(content?.className).toContain("prose");
    expect(content?.className).not.toContain("overflow-y-auto");

    const scrollBox = content?.parentElement;
    expect(scrollBox?.className).toContain("w-full");
    expect(scrollBox?.className).toContain("max-w-none");
    expect(scrollBox?.className).toContain("max-h-[300px]");
    expect(scrollBox?.className).toContain("overflow-y-auto");
  });
});
