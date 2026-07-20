import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAvailableHooks, useEnabledHooks } from "../rpc.ts";
import HookSelector from "./HookSelector";

const enableHooksMock = mock();
const disableHooksMock = mock();
const toastErrorMock = mock();

void mock.module("../rpc.ts", () => ({
  lifecycleRPCClient: {
    enableHooks: enableHooksMock,
    disableHooks: disableHooksMock,
  },
  useAvailableHooks: mock(),
  useEnabledHooks: mock(),
}));

void mock.module("./ui/toast.tsx", () => ({
  toastManager: {
    error: toastErrorMock,
  },
}));

describe("HookSelector", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    enableHooksMock.mockResolvedValue({});
    disableHooksMock.mockResolvedValue({});
  });

  const setup = (availableHooks: Record<string, unknown> = {}, enabledHooks: string[] = [], mutate = mock()) => {
    (useAvailableHooks as ReturnType<typeof mock>).mockReturnValue({
      data: { hooks: availableHooks },
      isLoading: false,
      error: undefined,
    });
    (useEnabledHooks as ReturnType<typeof mock>).mockReturnValue({
      data: { status: "success", hooks: enabledHooks },
      mutate,
      isLoading: false,
      error: undefined,
    });
    return { mutate };
  };

  it("renders the hook selector button with accurate hook count", () => {
    setup();

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Select hooks. 0 of 0 enabled");
    expect(button).toHaveAttribute("title", "0 of 0 hooks enabled");
  });

  it("displays icon trigger variant correctly", () => {
    setup();

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("flex items-center justify-center p-1.5 rounded-md");
    expect(button).toHaveAttribute("title", "0 of 0 hooks enabled");
  });

  it("displays default trigger variant correctly", () => {
    setup();

    render(<HookSelector agentId="test-agent" triggerVariant="default" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("hidden md:flex items-center gap-2 px-2 py-1 rounded-md");
  });

  it("filters hooks based on search query", async () => {
    const user = userEvent.setup();
    const availableHooks = {
      "file-hooks": { displayName: "File Hooks", description: "File system operations" },
      "memory-hooks": { displayName: "Memory Hooks", description: "Memory management" },
      "git-hooks": { displayName: "Git Hooks", description: "Version control operations" },
    };

    setup(availableHooks);

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
      expect(screen.getByText("Memory Hooks")).toBeInTheDocument();
      expect(screen.getByText("Git Hooks")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Filter hooks...");
    await user.type(searchInput, "git");

    await waitFor(() => {
      expect(screen.queryByText("File Hooks")).not.toBeInTheDocument();
      expect(screen.queryByText("Memory Hooks")).not.toBeInTheDocument();
      expect(screen.getByText("Git Hooks")).toBeInTheDocument();
    });
  });

  it("clears search when clear button is clicked", async () => {
    const user = userEvent.setup();
    const availableHooks = {
      "file-hooks": { displayName: "File Hooks", description: "File system operations" },
    };

    setup(availableHooks);

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Filter hooks...");
    await user.type(searchInput, "nonexistent");

    await waitFor(() => {
      expect(screen.getByText(/No hooks found matching/)).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Clear search"));

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
    });
  });

  it("navigates through hooks with keyboard arrow keys", async () => {
    const user = userEvent.setup();
    const availableHooks = {
      "file-hooks": { displayName: "File Hooks", description: "File system operations" },
      "memory-hooks": { displayName: "Memory Hooks", description: "Memory management" },
      "git-hooks": { displayName: "Git Hooks", description: "Version control operations" },
    };

    setup(availableHooks);

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
    });

    const firstHook = screen.getByText("File Hooks").closest('[role="option"]');
    const secondHook = screen.getByText("Memory Hooks").closest('[role="option"]');
    expect(firstHook).toBeTruthy();
    expect(secondHook).toBeTruthy();

    (firstHook as HTMLElement).focus();
    await act(async () => {
      fireEvent.keyDown(firstHook!, { key: "ArrowDown", code: "ArrowDown" });
    });

    await waitFor(() => {
      expect(secondHook).toHaveClass("bg-hover");
      expect(secondHook).toHaveClass("focus-ring");
    });
  });

  it("toggles hook with Enter key", async () => {
    const user = userEvent.setup();
    const { mutate } = setup(
      {
        "file-hooks": { displayName: "File Hooks", description: "File system operations" },
      },
      [],
    );

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
    });

    const hookItem = screen.getByText("File Hooks").closest('[role="option"]');
    expect(hookItem).toBeTruthy();
    (hookItem as HTMLElement).focus();

    await act(async () => {
      fireEvent.keyDown(hookItem!, { key: "Enter", code: "Enter" });
    });

    await waitFor(() => {
      expect(enableHooksMock).toHaveBeenCalledWith({ agentId: "test-agent", hooks: ["file-hooks"] });
      expect(mutate).toHaveBeenCalled();
    });
  });

  it("shows a toast when hook toggle fails", async () => {
    const user = userEvent.setup();
    enableHooksMock.mockRejectedValueOnce(new Error("RPC unavailable"));
    setup({
      "file-hooks": { displayName: "File Hooks", description: "File system operations" },
    });

    render(<HookSelector agentId="test-agent" triggerVariant="icon" />);
    await user.click(screen.getByRole("button", { name: /Select hooks/i }));

    await waitFor(() => {
      expect(screen.getByText("File Hooks")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /File Hooks/i }));

    await waitFor(() => {
      expect(enableHooksMock).toHaveBeenCalled();
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining("RPC unavailable"), { duration: 5000 });
    });
  });
});
