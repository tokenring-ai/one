import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { ChatInputProvider, useChatInput } from "../ChatInputContext.tsx";
import { StorageErrorBanner } from "./StorageErrorBanner.tsx";

/** Writes once so unstable setInput identity cannot re-trigger an update loop. */
function ChatInputWriter() {
  const { setInput } = useChatInput();
  const wrote = useRef(false);

  useEffect(() => {
    if (wrote.current) return;
    wrote.current = true;
    setInput("agent-1", "draft message");
  }, [setInput]);

  return null;
}

describe("StorageErrorBanner", () => {
  let setItemSpy: ReturnType<typeof spyOn> | undefined;
  let consoleErrorSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    localStorage.clear();
    // Expected when persistence is forced to fail
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    setItemSpy?.mockRestore();
    setItemSpy = undefined;
    consoleErrorSpy?.mockRestore();
    consoleErrorSpy = undefined;
    localStorage.clear();
  });

  it("shows a warning when chat input persistence fails", async () => {
    setItemSpy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    render(
      <ChatInputProvider>
        <ChatInputWriter />
        <StorageErrorBanner />
      </ChatInputProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/localStorage unavailable/i)).toBeInTheDocument();
    });
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    setItemSpy = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    render(
      <ChatInputProvider>
        <ChatInputWriter />
        <StorageErrorBanner />
      </ChatInputProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Dismiss warning"));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
