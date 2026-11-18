import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ChatInputProvider, prefillChatInput, resetPendingPrefillsForTests, useChatInput } from "./ChatInputContext.tsx";

const wrapper = ({ children }: { children: ReactNode }) => <ChatInputProvider>{children}</ChatInputProvider>;

describe("prefillChatInput", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPendingPrefillsForTests();
  });

  afterEach(() => {
    localStorage.clear();
    resetPendingPrefillsForTests();
  });

  it("hands the draft to a mounted composer through storage", async () => {
    const { result } = renderHook(() => useChatInput(), { wrapper });
    await act(async () => {
      prefillChatInput("agent-1", "Fix issue #12");
      await Promise.resolve();
    });
    expect(result.current.getInput("agent-1")).toBe("Fix issue #12");
  });

  describe("without localStorage", () => {
    let setItem: ReturnType<typeof spyOn>;
    let consoleError: ReturnType<typeof spyOn>;

    beforeEach(() => {
      setItem = spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "QuotaExceededError");
      });
      consoleError = spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      setItem.mockRestore();
      consoleError.mockRestore();
    });

    it("falls back to memory while the provider is mounted", () => {
      const { result } = renderHook(() => useChatInput(), { wrapper });
      act(() => {
        prefillChatInput("agent-1", "Fix issue #12");
      });
      expect(result.current.getInput("agent-1")).toBe("Fix issue #12");
    });

    it("keeps a prefill posted before the composer mounts", () => {
      prefillChatInput("agent-2", "Review PR #7");
      // Storage really refused it; only the in-memory fallback can deliver it.
      expect(localStorage.getItem("tokenring-chat-inputs")).toBeNull();
      const { result } = renderHook(() => useChatInput(), { wrapper });
      expect(result.current.getInput("agent-2")).toBe("Review PR #7");
    });
  });
});
