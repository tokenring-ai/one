import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type TerminalSummary = {
  name: string;
  lastInput?: string;
  providerName: string;
  workingDirectory: string;
  startTime: number;
  running: boolean;
  outputLength: number;
  exitCode: number | null;
  connectedAgentIds: string[];
};

const termA: TerminalSummary = {
  name: "term-a",
  lastInput: "ls -la",
  providerName: "posix",
  workingDirectory: "/project",
  startTime: 1_700_000_000_000,
  running: true,
  outputLength: 12,
  exitCode: null,
  connectedAgentIds: [],
};

const termB: TerminalSummary = {
  name: "term-b",
  lastInput: "echo hi",
  providerName: "posix",
  workingDirectory: "/tmp",
  startTime: 1_700_000_000_100,
  running: false,
  outputLength: 4,
  exitCode: 0,
  connectedAgentIds: ["agent-1"],
};

const spawnTerminal = mock(async (_args: Record<string, unknown>) => ({
  status: "success" as const,
  terminalName: "term-new",
}));
const terminateTerminal = mock(async (_args: { terminalName: string }) => ({ status: "success" as const }));
const sendInput = mock(async (_args: { terminalName: string; input: string }) => ({ status: "success" as const }));
const resizeTerminal = mock(async (_args: { terminalName: string; cols: number; rows: number }) => ({
  status: "success" as const,
}));
const mutateTerminals = mock(async () => undefined);

let terminalList: TerminalSummary[] = [];
let terminalsLoading = false;
let outputByTerminal: Record<string, { output: string; position: number; complete: boolean }> = {};

void mock.module("../../rpc.ts", () => ({
  useTerminalList: () => ({
    data: { status: "success" as const, terminals: terminalList },
    isLoading: terminalsLoading,
    error: undefined,
    mutate: mutateTerminals,
  }),
  terminalRPCClient: {
    spawnTerminal,
    terminateTerminal,
    sendInput,
    resizeTerminal,
  },
}));

const EMPTY_OUTPUT = { output: "", position: 0, complete: false };

void mock.module("../../hooks/useTerminalOutput.ts", () => ({
  useTerminalOutput: (terminalName: string | null) => {
    if (!terminalName) {
      return { data: undefined, error: undefined, isLoading: false, mutate: mock() };
    }
    // Stable empty object — a fresh `{}` each render would loop the sessions cache effect.
    const data = outputByTerminal[terminalName] ?? EMPTY_OUTPUT;
    return { data, error: undefined, isLoading: false, mutate: mock() };
  },
}));

// Avoid mounting a real xterm instance in jsdom.
void mock.module("../../components/terminal/XTermView.tsx", () => ({
  default: ({ output, onSubmit, readOnly }: { output: string; onSubmit?: (input: string) => void; readOnly?: boolean }) => (
    <div data-testid="xterm-view">
      <pre data-testid="xterm-output">{output}</pre>
      {!readOnly && onSubmit && (
        <input
          aria-label="Terminal input"
          data-testid="xterm-input"
          onKeyDown={event => {
            if (event.key === "Enter") {
              onSubmit((event.target as HTMLInputElement).value);
              (event.target as HTMLInputElement).value = "";
            }
          }}
        />
      )}
    </div>
  ),
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: mock(),
    info: mock(),
    warning: mock(),
    remove: mock(),
  },
}));

// focus-trap refuses to activate in jsdom.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: TerminalApp } = await import("./TerminalApp.tsx");

function renderApp(initialPath = "/terminal") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/terminal/:terminalId?" element={<TerminalApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TerminalApp", () => {
  beforeEach(() => {
    spawnTerminal.mockClear();
    terminateTerminal.mockClear();
    sendInput.mockClear();
    resizeTerminal.mockClear();
    mutateTerminals.mockClear();
    terminalList = [];
    terminalsLoading = false;
    outputByTerminal = {};
  });

  it("shows the empty state when there are no terminals", () => {
    renderApp();

    expect(screen.getByText("No terminals")).toBeInTheDocument();
    expect(screen.getByText("Create a terminal to get started")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /New Terminal/i }).length).toBeGreaterThan(0);
  });

  it("auto-selects the first terminal when landing on /terminal", async () => {
    terminalList = [termA, termB];
    outputByTerminal["term-a"] = { output: "$ ls\n", position: 5, complete: false };

    renderApp("/terminal");

    await waitFor(() => {
      expect(screen.getByTestId("xterm-output")).toHaveTextContent("$ ls");
    });
    expect(screen.getByRole("tab", { name: /ls -la/ })).toHaveAttribute("aria-selected", "true");
  });

  it("lists sessions as tabs and switches between them", async () => {
    const user = userEvent.setup();
    terminalList = [termA, termB];
    outputByTerminal["term-a"] = { output: "output-a", position: 8, complete: false };
    outputByTerminal["term-b"] = { output: "output-b", position: 8, complete: true };

    renderApp("/terminal/term-a");

    expect(screen.getByRole("tab", { name: /ls -la/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /echo hi/ })).toBeInTheDocument();
    expect(screen.getByTestId("xterm-output")).toHaveTextContent("output-a");

    await user.click(screen.getByRole("tab", { name: /echo hi/ }));

    await waitFor(() => {
      expect(screen.getByTestId("xterm-output")).toHaveTextContent("output-b");
    });
  });

  it("spawns a new terminal and navigates to it", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByRole("button", { name: /New Terminal/i })[0]!);

    await waitFor(() => expect(spawnTerminal).toHaveBeenCalledTimes(1));
    expect(mutateTerminals).toHaveBeenCalled();
  });

  it("sends input through the terminal RPC client", async () => {
    const user = userEvent.setup();
    terminalList = [termA];
    outputByTerminal["term-a"] = { output: "$ ", position: 2, complete: false };

    renderApp("/terminal/term-a");

    const input = await screen.findByTestId("xterm-input");
    await user.type(input, "pwd{Enter}");

    await waitFor(() => expect(sendInput).toHaveBeenCalled());
    expect(sendInput.mock.calls[0]![0]).toEqual({ terminalName: "term-a", input: "pwd" });
  });

  it("closes an exited terminal without confirmation", async () => {
    const user = userEvent.setup();
    terminalList = [termB];
    outputByTerminal["term-b"] = { output: "done", position: 4, complete: true };

    renderApp("/terminal/term-b");

    await user.click(screen.getByRole("button", { name: /Close terminal echo hi/i }));

    await waitFor(() => expect(terminateTerminal).toHaveBeenCalledWith({ terminalName: "term-b" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms before closing a running terminal", async () => {
    const user = userEvent.setup();
    terminalList = [termA];
    outputByTerminal["term-a"] = { output: "$ ", position: 2, complete: false };

    renderApp("/terminal/term-a");

    await user.click(screen.getByRole("button", { name: /Close terminal ls -la/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(terminateTerminal).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(terminateTerminal).toHaveBeenCalledWith({ terminalName: "term-a" }));
  });

  it("shows a not-found state for a stale terminal URL", () => {
    terminalList = [termA];
    renderApp("/terminal/missing-term");

    expect(screen.getByText("Terminal not found")).toBeInTheDocument();
    expect(screen.getByText(/missing-term/)).toBeInTheDocument();
  });

  it("renders status bar details for the active terminal", async () => {
    terminalList = [termB];
    outputByTerminal["term-b"] = { output: "done", position: 4, complete: true };

    renderApp("/terminal/term-b");

    expect(await screen.findByText("/tmp")).toBeInTheDocument();
    expect(screen.getByText("posix")).toBeInTheDocument();
    expect(screen.getByText("1 agent")).toBeInTheDocument();
    expect(screen.getByText(/exited \(0\)/)).toBeInTheDocument();
  });
});
