import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";
import App from "./App.tsx";

void mock.module("./components/CheckpointBrowser.tsx", () => ({
  default: () => null,
}));

// Spread the real rpc module so every export App's import graph touches resolves;
// only the hooks this test cares about are overridden. Merely importing rpc.ts is
// safe here — it builds client objects lazily and only opens WebSockets on call.
const rpcActual = await import("./rpc.ts");

void mock.module("./rpc.ts", () => ({
  ...rpcActual,
  useAgentList: () => ({ data: [], isLoading: false, mutate: mock() }),
  useAgentTypes: () => ({ data: [], isLoading: false }),
  useWorkflows: () => ({ data: [], isLoading: false }),
}));

// Heavy app shells / selectors that pull more RPC — keep route-loading focused
void mock.module("./components/layout/DashboardRail.tsx", () => ({ default: () => null }));
void mock.module("./shell/TopBar.tsx", () => ({ default: () => null }));
void mock.module("./shell/AppHost.tsx", () => ({ default: () => <div>Layout app</div> }));

function NavigationHarness() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/agents")}>
        Go agents
      </button>
      <button type="button" onClick={() => navigate("/settings")}>
        Go settings
      </button>
      <App />
    </>
  );
}

describe("App route loading bar", () => {
  beforeEach(() => {
    // real timers: fake timers + waitFor + full App mount hangs under Bun
  });

  afterEach(() => {
    // no-op reserved for timer cleanup if reintroduced
  });

  it("shows loading bar on initial mount and on navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <NavigationHarness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("route-loading-bar")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByTestId("route-loading-bar")).not.toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await user.click(screen.getByRole("button", { name: "Go agents" }));

    await act(async () => {
      // allow React to flush navigation + loading-bar effect
      await Promise.resolve();
    });

    expect(screen.getByTestId("route-loading-bar")).toBeInTheDocument();
  });
});
