import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const fixturePlugins = [
  {
    name: "@tokenring-ai/filesystem",
    displayName: "Filesystem",
    version: "1.2.0",
    description: "Read and write project files",
    hasConfig: true,
  },
  {
    name: "@tokenring-ai/metrics",
    displayName: "Metrics",
    version: "0.9.1",
    description: "Collect usage metrics",
    hasConfig: false,
  },
  {
    name: "@tokenring-ai/vault",
    displayName: "Vault",
    version: "2.0.0",
    description: "Secure secrets storage",
    hasConfig: true,
  },
];

const mutatePlugins = mock(async () => undefined);

let pluginsData: { plugins: typeof fixturePlugins } | undefined = { plugins: fixturePlugins };
let pluginsError: Error | undefined;
let pluginsLoading = false;

void mock.module("../../rpc.ts", () => ({
  usePlugins: () => ({
    data: pluginsData,
    error: pluginsError,
    isLoading: pluginsLoading,
    mutate: mutatePlugins,
  }),
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
    info: mock(),
  },
}));

const { default: PluginsApp } = await import("./PluginsApp.tsx");

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/plugins"]}>
      <Routes>
        <Route path="/plugins" element={<PluginsApp />} />
        <Route path="/configuration" element={<div>Configuration page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PluginsApp", () => {
  beforeEach(() => {
    pluginsData = { plugins: fixturePlugins };
    pluginsError = undefined;
    pluginsLoading = false;
    mutatePlugins.mockClear();
  });

  it("lists installed plugins from usePlugins", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("3 installed")).toBeInTheDocument();
    expect(screen.getByText("2 configurable")).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "vault");

    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.queryByText("Filesystem")).not.toBeInTheDocument();
    expect(screen.queryByText("Metrics")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1")).toBeInTheDocument();
  });

  it("filters to configurable plugins only", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /^Configurable/ }));

    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.queryByText("Metrics")).not.toBeInTheDocument();
  });

  it("shows empty search state and clears filters", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "zzzz-no-match");
    expect(screen.getByText("No matching plugins")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search plugins" })).toHaveValue("");
  });

  it("deep-links to configuration for configurable plugins", async () => {
    renderApp();

    const filesystemCard = screen.getByText("Filesystem").closest("[data-plugin-name]");
    expect(filesystemCard).toBeTruthy();
    const configure = within(filesystemCard as HTMLElement).getByRole("link", { name: /Configure/i });
    expect(configure).toHaveAttribute("href", "/configuration?plugin=%40tokenring-ai%2Ffilesystem");
  });

  it("opens a detail panel when a plugin is selected", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /Select Vault/i }));

    const detail = screen.getByLabelText("Details for Vault");
    expect(within(detail).getByRole("heading", { name: "Vault" })).toBeInTheDocument();
    expect(within(detail).getAllByText("@tokenring-ai/vault").length).toBeGreaterThan(0);
    expect(within(detail).getByRole("link", { name: /Open configuration/i })).toHaveAttribute("href", "/configuration?plugin=%40tokenring-ai%2Fvault");
  });

  it("refreshes via the header button", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(mutatePlugins).toHaveBeenCalled();
  });

  it("shows loading and error states", async () => {
    pluginsLoading = true;
    pluginsData = undefined;
    const { unmount } = renderApp();
    expect(screen.getByText("Loading plugins…")).toBeInTheDocument();
    unmount();

    pluginsLoading = false;
    pluginsError = new Error("rpc down");
    pluginsData = undefined;
    renderApp();
    expect(screen.getByText("Failed to load plugins")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/rpc down/);
  });

  it("shows empty installed state when there are no plugins", () => {
    pluginsData = { plugins: [] };
    renderApp();
    expect(screen.getByText("No plugins installed")).toBeInTheDocument();
  });

  it("keeps the plugin store as coming soon", () => {
    renderApp();
    expect(screen.getByText("Plugin Store")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
