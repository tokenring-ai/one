import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppShellProvider } from "./AppShellContext.tsx";
import DashboardSwitcher from "./DashboardSwitcher.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const navigateMock = mock();
const setThemeMock = mock();
let themeValue: "light" | "dark" = "dark";
let agentsData: { id: string; createdAt: number; agentType: string; displayName: string; description: string; idle: boolean; currentActivity: string }[] = [];
let agentTypesData: { type: string; displayName: string; description: string; enabledTools: string[]; source: "bundled" | "workspace" }[] = [];
const createAgentMock = mock(async () => ({ id: "new-agent-1", displayName: "x", description: "x" }));

const actualRouter = await import("react-router-dom");
void mock.module("react-router-dom", () => ({
  ...actualRouter,
  useNavigate: () => navigateMock,
}));

void mock.module("../../rpc.ts", () => ({
  agentRPCClient: { createAgent: createAgentMock },
  useAgentList: () => ({ data: agentsData, isLoading: false, error: undefined, mutate: mock() }),
  useAgentTypes: () => ({ data: agentTypesData, isLoading: false, error: undefined, mutate: mock() }),
}));

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => [themeValue, setThemeMock, themeValue],
}));

const toastErrorMock = mock();
void mock.module("../ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: toastErrorMock, warning: mock(), info: mock() },
}));

void mock.module("../../features/documents/documentsStore.ts", () => ({
  resetToNewDocument: mock(),
}));

function renderSwitcher() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AppShellProvider>
        <SwitcherOpener />
      </AppShellProvider>
    </MemoryRouter>,
  );
}

/** The switcher renders nothing until opened; open it via the provider's state. */
function SwitcherOpener() {
  return (
    <OpenButton>
      <DashboardSwitcher />
    </OpenButton>
  );
}

import { useAppShell } from "./AppShellContext.tsx";

function OpenButton({ children }: { children: ReactNode }) {
  const { toggleSwitcher } = useAppShell();
  return (
    <>
      <button type="button" onClick={toggleSwitcher}>
        open palette
      </button>
      {children}
    </>
  );
}

describe("DashboardSwitcher command palette", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    localStorage.clear();
    themeValue = "dark";
    agentsData = [
      {
        id: "agent-1",
        createdAt: 1,
        agentType: "coding",
        displayName: "Code Engineer #1",
        description: "",
        idle: false,
        currentActivity: "Refactoring",
      },
    ];
    agentTypesData = [{ type: "reviewer", displayName: "Reviewer", description: "Reviews pull requests", enabledTools: [], source: "bundled" }];
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("lists dashboards, running agents and actions when opened empty", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));

    await waitFor(() => expect(screen.getByText("Command palette")).toBeTruthy());
    expect(screen.getByText("Actions")).toBeTruthy();
    expect(screen.getByText("Running agents")).toBeTruthy();
    expect(screen.getByText("Dashboards")).toBeTruthy();
    expect(screen.getByText("Code Engineer #1")).toBeTruthy();
    expect(screen.getByText("Switch to light theme")).toBeTruthy();
    // Views stay hidden until the user types so the empty palette stays short.
    expect(screen.queryByText("Panels")).toBeNull();
  });

  it("navigates to a running agent via keyboard (arrows + Enter)", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));

    await user.type(screen.getByRole("combobox"), "code eng");
    await waitFor(() => expect(screen.getByText("Code Engineer #1")).toBeTruthy());

    // The first result is the agent (only section matching the query besides actions).
    const highlighted = screen.getAllByRole("option").find(option => option.getAttribute("aria-selected") === "true");
    expect(highlighted?.textContent).toContain("Code Engineer #1");

    await user.keyboard("{Enter}");
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/agent/agent-1"));
  });

  it("Enter on a focused Pin / close button does not run the highlighted result", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));
    await waitFor(() => expect(screen.getByText("Command palette")).toBeTruthy());

    const pinButton = screen.getAllByRole("button", { name: /^(Pin|Unpin) / })[0]!;
    pinButton.focus();
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    pinButton.dispatchEvent(event);

    // Not prevented, so the browser still activates the button itself.
    expect(event.defaultPrevented).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Command palette")).toBeTruthy();

    // Arrows on a button leave the combobox highlight alone too.
    const before = screen.getAllByRole("option").findIndex(option => option.getAttribute("aria-selected") === "true");
    fireEvent.keyDown(pinButton, { key: "ArrowDown" });
    const after = screen.getAllByRole("option").findIndex(option => option.getAttribute("aria-selected") === "true");
    expect(after).toBe(before);
  });

  it("finds views that have their own URL and opens them there", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));

    // "New agent" is the Agents app's create form at /agents/new.
    await user.type(screen.getByRole("combobox"), "new agent");
    await waitFor(() => expect(screen.getByText("Panels")).toBeTruthy());

    // The view entry (hinted with its app); the palette also has its own "New agent" quick action.
    const option = screen.getByRole("option", { name: /New agent.*Agents ·/ });
    await user.click(within(option).getAllByRole("button")[0]!);
    await waitFor(() => {
      const lastCall = navigateMock.mock.calls.at(-1)?.[0] as string | undefined;
      expect(lastCall).toBe("/agents/new");
    });
  });

  it("launches an agent type from the palette", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));

    await user.type(screen.getByRole("combobox"), "reviewer");
    await waitFor(() => expect(screen.getByText("Launch an agent")).toBeTruthy());

    fireEvent.click(screen.getByText("Reviewer"));
    await waitFor(() => expect(createAgentMock).toHaveBeenCalledWith({ agentType: "reviewer" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/agent/new-agent-1"));
  });

  it("includes the error detail when launching from the palette fails", async () => {
    createAgentMock.mockImplementationOnce(async () => {
      throw new Error("Model provider unavailable");
    });
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));
    await user.type(screen.getByRole("combobox"), "reviewer");
    await waitFor(() => expect(screen.getByText("Reviewer")).toBeTruthy());

    fireEvent.click(screen.getByText("Reviewer"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(String(toastErrorMock.mock.calls[0]?.[0])).toContain("Model provider unavailable");
  });

  it("toggles the theme from the actions section", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: "open palette" }));

    fireEvent.click(screen.getByText("Switch to light theme"));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
