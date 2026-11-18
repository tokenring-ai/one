import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fixturePlugins = [
  {
    name: "@tokenring-ai/filesystem",
    displayName: "Filesystem",
    version: "1.2.0",
    description: "Read and write project files",
    hasConfig: true,
    services: ["FilesystemService"],
    tools: ["filesystem_read"],
    commands: ["filesystem"],
    rpcMethods: ["/rpc/filesystem.read"],
  },
  {
    name: "@tokenring-ai/metrics",
    displayName: "Metrics",
    version: "0.9.1",
    description: "Collect usage metrics",
    hasConfig: false,
    services: [],
    tools: [],
    commands: [],
    rpcMethods: [],
  },
  {
    name: "@tokenring-ai/vault",
    displayName: "Vault",
    version: "2.0.0",
    description: "Secure secrets storage",
    hasConfig: true,
    services: ["VaultService"],
    tools: [],
    commands: ["vault"],
    rpcMethods: ["/rpc/vault.getSecret", "/rpc/vault.setSecret"],
  },
];

const mutatePlugins = mock(async () => undefined);

let pluginsData: { plugins: typeof fixturePlugins; requiresRestart?: boolean } | undefined = { plugins: fixturePlugins };
let pluginsError: Error | undefined;
let pluginsLoading = false;
let pluginsValidating = false;

const actualRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...actualRpc,
  usePlugins: () => ({
    data: pluginsData,
    error: pluginsError,
    isLoading: pluginsLoading,
    isValidating: pluginsValidating,
    mutate: mutatePlugins,
  }),
}));

const actualToast = await import("../../components/ui/toast.tsx");
void mock.module("../../components/ui/toast.tsx", () => ({
  ...actualToast,
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
    info: mock(),
  },
}));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { PLUGINS_KINDS } = await import("./kinds.ts");
const { PLUGINS_APP } = await import("./manifest.ts");
const { PLUGINS_VIEWS } = await import("./views.tsx");

const registry = createLayoutRegistry({ apps: [PLUGINS_APP], views: PLUGINS_VIEWS, kinds: [...CORE_KINDS, ...PLUGINS_KINDS] });

const renderApp = (url = "/plugins") => renderLayoutApp({ registry, url });
const VAULT = "@tokenring-ai/vault";
const VAULT_URL = `/plugins/${encodeURIComponent(VAULT)}`;

describe("Plugins app", () => {
  beforeEach(() => {
    pluginsData = { plugins: fixturePlugins };
    pluginsError = undefined;
    pluginsLoading = false;
    pluginsValidating = false;
    mutatePlugins.mockClear();
  });

  it("shows a restart-required notice only when the server asks for one", () => {
    renderApp();
    expect(screen.queryByText("Restart required")).not.toBeInTheDocument();
  });

  it("warns that a restart is needed to fully apply configuration", () => {
    pluginsData = { plugins: fixturePlugins, requiresRestart: true };
    renderApp();
    expect(screen.getByTestId("plugins-restart-required")).toHaveTextContent(/Restart TokenRing to fully apply it/);
  });

  it("lists installed plugins from usePlugins", () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByText("Metrics")).toBeInTheDocument();
    expect(screen.getByText("Vault")).toBeInTheDocument();
    expect(screen.getByText("3 installed")).toBeInTheDocument();
    expect(screen.getByText("2 configurable")).toBeInTheDocument();
  });

  it("explains itself on /plugins until a plugin is chosen", () => {
    renderApp();
    expect(screen.getByText("Select a plugin")).toBeInTheDocument();
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

  it("deep-links to configuration for configurable plugins", () => {
    renderApp();

    const filesystemCard = screen.getByText("Filesystem").closest("[data-plugin-name]");
    expect(filesystemCard).toBeTruthy();
    const configure = within(filesystemCard as HTMLElement).getByRole("link", { name: /Configure/i });
    expect(configure).toHaveAttribute("href", "/configuration/%40tokenring-ai%2Ffilesystem");
  });

  it("opens the detail panel for the selected plugin and navigates to it", async () => {
    const user = userEvent.setup();
    const app = renderApp();

    await user.click(screen.getByRole("button", { name: "Vault details" }));

    expect(app.location().pathname).toBe(VAULT_URL);
    const detail = await screen.findByLabelText("Details for Vault");
    expect(within(detail).getByText("v2.0.0")).toBeInTheDocument();
    // The "select a plugin" tab has done its job.
    expect(screen.queryByText("Select a plugin")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vault details" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opened at a plugin's URL, shows no empty start tab beside it", async () => {
    renderApp(VAULT_URL);
    await screen.findByLabelText("Details for Vault");
    expect(screen.queryByText("Select a plugin")).not.toBeInTheDocument();
  });

  it("opens a plugin named by the URL and marks it selected", async () => {
    renderApp(VAULT_URL);
    expect(await screen.findByLabelText("Details for Vault")).toBeInTheDocument();
    const card = screen.getByText("Vault", { selector: "span" }).closest("[data-plugin-name]") as HTMLElement;
    expect(card.dataset.selected).toBe("true");
  });

  it("closes the detail panel and returns to /plugins from its close button", async () => {
    const user = userEvent.setup();
    const app = renderApp(VAULT_URL);
    await screen.findByLabelText("Details for Vault");

    await user.click(screen.getByRole("button", { name: "Close plugin details" }));

    await waitFor(() => expect(app.location().pathname).toBe("/plugins"));
    await waitFor(() => expect(screen.queryByLabelText("Details for Vault")).not.toBeInTheDocument());
    expect(screen.getByText("Select a plugin")).toBeInTheDocument();
    const card = screen.getByRole("button", { name: "Vault details" }).closest("[data-plugin-name]") as HTMLElement;
    expect(card.dataset.selected).toBeUndefined();
  });

  it("deselects a plugin when its card is clicked again", async () => {
    const user = userEvent.setup();
    const app = renderApp(VAULT_URL);
    await screen.findByLabelText("Details for Vault");

    await user.click(screen.getByRole("button", { name: "Vault details" }));

    await waitFor(() => expect(app.location().pathname).toBe("/plugins"));
  });

  it("keeps the open detail panel when the list is filtered", async () => {
    const user = userEvent.setup();
    renderApp(VAULT_URL);
    await screen.findByLabelText("Details for Vault");
    await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "filesystem");

    expect(screen.queryByRole("button", { name: "Vault details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filesystem details" })).toBeInTheDocument();
    expect(screen.getByLabelText("Details for Vault")).toBeInTheDocument();
  });

  it("renders one plugin in the detail view", async () => {
    renderApp(VAULT_URL);
    const detail = await screen.findByLabelText("Details for Vault");
    expect(within(detail).getAllByText(VAULT).length).toBeGreaterThan(0);
    expect(within(detail).getByRole("link", { name: /Open configuration/i })).toHaveAttribute("href", "/configuration/%40tokenring-ai%2Fvault");
    // No hardcoded runtime status: the RPC does not report one.
    expect(within(detail).queryByText("Installed and active")).not.toBeInTheDocument();
    expect(within(detail).getByText("v2.0.0")).toBeInTheDocument();
    expect(within(detail).getByText("Has settings UI")).toBeInTheDocument();

    const services = within(detail).getByRole("region", { name: "Services" });
    expect(within(services).getByText("VaultService")).toBeInTheDocument();
    const tools = within(detail).getByRole("region", { name: "Tools" });
    expect(within(tools).getByText("No tools registered.")).toBeInTheDocument();
    expect(within(detail).getByRole("region", { name: "Commands" })).toHaveTextContent("vault");
    const methods = within(detail).getByRole("region", { name: "RPC methods" });
    expect(within(methods).getByText("/rpc/vault.getSecret")).toBeInTheDocument();
    expect(within(methods).getByText("/rpc/vault.setSecret")).toBeInTheDocument();
  });

  it("says so when a plugin registers nothing", async () => {
    renderApp("/plugins/%40tokenring-ai%2Fmetrics");
    const detail = await screen.findByLabelText("Details for Metrics");
    expect(within(detail).getByText("No config schema")).toBeInTheDocument();
    expect(within(detail).getByText("No services registered.")).toBeInTheDocument();
    expect(within(detail).getByText("No tools registered.")).toBeInTheDocument();
    expect(within(detail).getByText("No commands registered.")).toBeInTheDocument();
    expect(within(detail).getByText("No RPC methods registered.")).toBeInTheDocument();
  });

  it("says so when the named plugin is not installed", async () => {
    renderApp("/plugins/%40tokenring-ai%2Fgone");
    expect(await screen.findByText("Plugin not found")).toBeInTheDocument();
  });

  it("sorts plugins by version", async () => {
    const user = userEvent.setup();
    renderApp();

    // Default display-name order is Filesystem, Metrics, Vault.
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort plugins" }), "version");

    const cards = screen.getAllByRole("button", { name: / details$/ });
    expect(cards.map(card => card.getAttribute("aria-label"))).toEqual(["Metrics details", "Filesystem details", "Vault details"]);
  });

  it("refreshes via the header button", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(mutatePlugins).toHaveBeenCalled();
  });

  it("shows loading and error states", () => {
    pluginsLoading = true;
    pluginsData = undefined;
    const { unmount } = renderApp();
    expect(screen.getAllByText("Loading plugins…").length).toBeGreaterThan(0);
    unmount();

    pluginsLoading = false;
    pluginsError = new Error("rpc down");
    pluginsData = undefined;
    renderApp();
    expect(screen.getAllByText("Failed to load plugins").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(/rpc down/);
  });

  it("keeps cached plugins when refresh fails", () => {
    pluginsError = new Error("rpc down");
    pluginsData = { plugins: fixturePlugins };
    renderApp();

    expect(screen.getByText("Could not refresh plugins")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/rpc down/);
    expect(screen.getByText("Filesystem")).toBeInTheDocument();
    expect(screen.getByText("3 installed")).toBeInTheDocument();
  });

  it("shows empty installed state when there are no plugins", () => {
    pluginsData = { plugins: [] };
    renderApp();
    expect(screen.getByText("No plugins installed")).toBeInTheDocument();
    expect(screen.getAllByText(/can't be added or removed here/).length).toBeGreaterThan(0);
  });

  it("explains that plugins are built in, without source-code instructions", () => {
    renderApp();
    expect(screen.getByText("Adding plugins")).toBeInTheDocument();
    expect(screen.getAllByText(/can't be added or removed here/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/backend\/plugins\.ts/)).not.toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });
});
