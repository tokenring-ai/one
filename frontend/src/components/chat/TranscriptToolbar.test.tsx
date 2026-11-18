import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptToolbar from "./TranscriptToolbar.tsx";

function renderToolbar(overrides: Partial<Parameters<typeof TranscriptToolbar>[0]> = {}) {
  const props = {
    searchQuery: "",
    onSearchChange: mock(),
    hideToolCalls: false,
    onToggleHideToolCalls: mock(),
    ...overrides,
  };
  return { props, ...render(<TranscriptToolbar {...props} />) };
}

describe("TranscriptToolbar", () => {
  it("opens search, and Escape clears and closes it", async () => {
    const user = userEvent.setup();
    const { props } = renderToolbar({ leading: <span>agent controls</span> });
    await user.click(screen.getByRole("button", { name: "Search in conversation" }));
    const input = screen.getByRole("textbox", { name: "Search in conversation" });
    expect(document.activeElement).toBe(input);
    // The host's controls make room for the search field.
    expect(screen.queryByText("agent controls")).toBeNull();
    await user.keyboard("{Escape}");
    expect(props.onSearchChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("textbox", { name: "Search in conversation" })).toBeNull();
  });

  it("toggles tool calls", async () => {
    const user = userEvent.setup();
    const { props } = renderToolbar();
    await user.click(screen.getByRole("button", { name: "Hide tool calls" }));
    expect(props.onToggleHideToolCalls).toHaveBeenCalledTimes(1);
  });

  it("leaves copy and export to the chat's ⋯ menu", () => {
    renderToolbar();
    expect(screen.queryByRole("button", { name: /copy|export/i })).toBeNull();
  });
});
