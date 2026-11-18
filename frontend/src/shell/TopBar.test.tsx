import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";
import type { RunningAgent } from "../lib/agentSessions.ts";

function Nothing() {
  return null;
}
function PassThrough({ children }: { children: React.ReactNode }) {
  return children;
}

const appShellActual = await import("../components/layout/AppShellContext.tsx");
void mock.module("../components/layout/AppShellContext.tsx", () => ({
  ...appShellActual,
  useAppShell: () => ({ toggleSwitcher: () => {}, isSwitcherOpen: false }),
}));
void mock.module("../components/ChatSettingsDropdown.tsx", () => ({ default: () => null }));
void mock.module("../components/ui/notification-menu.tsx", () => ({ default: () => null }));
void mock.module("../components/ui/light-dark-selector.tsx", () => ({ LightDarkSelector: Nothing }));
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThrough }));
void mock.module("../hooks/useConnectionStatus.ts", () => ({
  useConnectionStatus: () => ({ isOnline: true, rpcState: "connected", browserOnline: true }),
}));

const rpcActual = await import("../rpc.ts");
let agentList: RunningAgent[] = [];
void mock.module("../rpc.ts", () => ({
  ...rpcActual,
  useAgentList: () => ({ data: agentList, isLoading: false, mutate: mock() }),
}));

let resetCalls = 0;
void mock.module("@tokenring-ai/web-host/createWsRPCClient", () => ({
  isRpcConnectionClosed: () => false,
  resetWsRPCConnections: () => {
    resetCalls += 1;
  },
  setWsRPCAuthHandler: () => {},
}));

const { default: TopBar } = await import("./TopBar.tsx");
const { setActiveTitle } = await import("./shellStatus.ts");
const { chatUrlFor } = await import("./AgentActivity.tsx");
const { default: LoginOverlay } = await import("../components/overlay/login-overlay.tsx");
const { clearRpcAuth, setRpcAuth, setRpcAuthUsername } = await import("../rpcAuth.ts");

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <TopBar />
    </MemoryRouter>,
  );
}

describe("TopBar", () => {
  afterEach(() => {
    act(() => setActiveTitle(null));
    agentList = [];
  });

  it("shows the app and the focused resource from the URL", () => {
    renderAt("/agent/swift-doors-shake-394");
    const crumb = screen.getByRole("navigation", { name: "Location" });
    expect(crumb.textContent).toContain("Agents");
    act(() => setActiveTitle("Swift doors"));
    expect(crumb.textContent).toContain("Swift doors");
  });

  it("shows only the app when the URL focuses nothing in it", () => {
    renderAt("/home");
    act(() => setActiveTitle(null));
    const crumb = screen.getByRole("navigation", { name: "Location" });
    expect(crumb.textContent).toBe("Home");
  });

  it("summarises agent activity instead of a current agent", () => {
    agentList = [
      { id: "a", idle: false, currentActivity: "Editing", displayName: "a", agentType: "coder", description: "", createdAt: 1 },
      { id: "b", idle: true, currentActivity: "", displayName: "b", agentType: "coder", description: "", createdAt: 2 },
    ];
    renderAt("/home");
    expect(screen.getByRole("button", { name: "Agent activity: 1 working · 1 idle" })).toBeTruthy();
    expect(screen.queryByText("Select agent")).toBeNull();
  });

  it("counts agents blocked on a question separately and lists them first", async () => {
    agentList = [
      { id: "a", idle: false, currentActivity: "Editing", displayName: "a", agentType: "coder", description: "", createdAt: 1 },
      { id: "q", idle: false, currentActivity: "Asking", displayName: "q", agentType: "coder", description: "", createdAt: 2, pendingQuestions: 1 },
    ];
    renderAt("/home");
    const trigger = screen.getByRole("button", { name: "Agent activity: 1 needs you · 1 working" });
    await userEvent.setup().click(trigger);
    const items = await screen.findAllByRole("menuitem");
    expect(items[0]!.textContent).toContain("Waiting for your answer");
  });

  it("keeps the Settings button visible at every width", () => {
    renderAt("/home");
    expect(screen.getByRole("button", { name: "Settings" }).className).not.toContain("hidden");
  });
});

describe("chatUrlFor", () => {
  it("opens a chat inside the current layout app, else in Agents", () => {
    expect(chatUrlFor("/home", "a b")).toBe("/home/agent/a%20b");
    expect(chatUrlFor("/agents/new", "x")).toBe("/agent/x");
    expect(chatUrlFor("/nowhere", "x")).toBe("/agent/x");
  });
});

describe("TopBar sign out", () => {
  const realFetch = globalThis.fetch;
  let fetchCalls: Array<[string, RequestInit | undefined]> = [];

  beforeEach(() => {
    resetCalls = 0;
    fetchCalls = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      fetchCalls.push([url, init]);
      return new Response(null, { status: 204 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    clearRpcAuth();
    sessionStorage.clear();
  });

  it("is hidden until the server has signed someone in", () => {
    renderAt("/home");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    act(() => setRpcAuthUsername("mark"));
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("revokes the session, clears stored auth, drops the socket, and shows the login overlay", async () => {
    setRpcAuth({ username: "mark", password: "s3cret" });
    setRpcAuthUsername("mark");
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <TopBar />
        <LoginOverlay />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog", { name: "Sign in" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Sign in" })).toBeTruthy());
    const deletes = fetchCalls.filter(([, init]) => init?.method === "DELETE");
    expect(deletes.map(([url]) => url)).toEqual(["/api/auth/session"]);
    expect(sessionStorage.getItem("tokenring.rpc.username")).toBeNull();
    expect(resetCalls).toBe(1);
  });
});

describe("TopBar sign in on another device", () => {
  afterEach(() => clearRpcAuth());

  it("offers the phone sign-in to anyone who is signed in, and to nobody else", () => {
    renderAt("/");
    expect(screen.queryByRole("button", { name: "Sign in on another device" })).toBeNull();
    act(() => setRpcAuthUsername("maria"));
    expect(screen.getByRole("button", { name: "Sign in on another device" })).toBeInTheDocument();
  });
});
