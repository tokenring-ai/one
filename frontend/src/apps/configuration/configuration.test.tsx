import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import type React from "react";

const widgetPlugin: ConfigUIPluginSchema = {
  pluginName: "widget-plugin",
  displayName: "Widget Plugin",
  description: "A test plugin",
  version: "1.0.0",
  slices: {
    widget: {
      kind: "group",
      key: "widget",
      path: ["widget"],
      label: "Widget",
      children: [
        { kind: "field", key: "name", path: ["widget", "name"], label: "Name", field: { type: "text" }, required: false },
        { kind: "field", key: "size", path: ["widget", "size"], label: "Size", field: { type: "number", min: 1 }, required: false, defaultValue: 10 },
        { kind: "field", key: "apiKey", path: ["widget", "apiKey"], label: "Api Key", field: { type: "password" }, required: false, sensitive: true },
      ],
    },
  },
};

const alphaPlugin: ConfigUIPluginSchema = {
  pluginName: "alpha-plugin",
  displayName: "Alpha Plugin",
  description: "Another test plugin",
  version: "0.1.0",
  slices: {
    alpha: {
      kind: "group",
      key: "alpha",
      path: ["alpha"],
      label: "Alpha",
      children: [{ kind: "field", key: "label", path: ["alpha", "label"], label: "Label", field: { type: "text" }, required: false }],
    },
  },
};

const applyConfig = mock(async (_args: { scope: string; overrides: Record<string, unknown> }) => ({ ok: true }) as Record<string, unknown>);
const validateConfig = mock(async (_args: { scope: string; overrides: Record<string, unknown> }) => ({ ok: true }) as Record<string, unknown>);
const resetConfig = mock(async (_args: { scope: string; path: string[] }) => ({ ok: true }) as Record<string, unknown>);
const schemaMutate = mock(async () => schemaData);
const valuesMutate = mock(async () => valuesData);

let schemaData: Record<string, unknown>;
let valuesData: Record<string, unknown>;

void mock.module("../../rpc.ts", () => ({
  // The Users view is part of the Configuration views these tests load; it is not exercised here.
  useMe: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useUserList: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usePendingAccessLinks: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  useRemoteAccessInfo: () => ({ data: undefined, isLoading: true, isValidating: false, error: undefined, mutate: async () => undefined }),
  usersRPCClient: {},
  useConfigSchema: () => ({ data: schemaData, isLoading: false, isValidating: false, error: undefined, mutate: schemaMutate }),
  useConfigValues: () => ({ data: valuesData, isLoading: false, isValidating: false, error: undefined, mutate: valuesMutate }),
  configRPCClient: { applyConfig, validateConfig, resetConfig },
  useProviderStatuses: () => ({
    data: { providers: [], templates: [], canSaveKeys: true },
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: async () => undefined,
  }),
  aiRPCClient: {},
  googleRPCClient: {},
  vaultRPCClient: {},
  chatRPCClient: {},
  usePermissionGrants: () => ({
    data: { status: "success", grants: [], maxGrantLevel: 8 },
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: async () => undefined,
  }),
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutApp, renderLayoutView } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CONFIGURATION_APP } = await import("./manifest.ts");
const { CONFIGURATION_VIEWS } = await import("./views.tsx");
const { sortConfigPlugins } = await import("./shared.tsx");
const { resetConfigurationStore, setConfigurationScope } = await import("./configurationStore.ts");

const registry = createLayoutRegistry({ apps: [CONFIGURATION_APP], views: CONFIGURATION_VIEWS, kinds: CORE_KINDS });
const pluginView = CONFIGURATION_VIEWS.find(view => view.id === "configuration-plugin")!;
const navigatorView = CONFIGURATION_VIEWS.find(view => view.id === "configuration-plugins")!;

const renderApp = (url = "/configuration") => renderLayoutApp({ registry, url });
const renderPlugin = (plugin: string) => renderLayoutView(pluginView, { params: { plugin } });

describe("Configuration app", () => {
  beforeEach(() => {
    applyConfig.mockClear();
    applyConfig.mockImplementation(async () => ({ ok: true }));
    validateConfig.mockClear();
    validateConfig.mockImplementation(async () => ({ ok: true }));
    resetConfig.mockClear();
    resetConfig.mockImplementation(async () => ({ ok: true }));
    schemaMutate.mockClear();
    valuesMutate.mockClear();
    valuesMutate.mockImplementation(async () => valuesData);
    // Drafts persist to localStorage and the reset re-reads them, so clear storage first.
    localStorage.removeItem("tokenring-configuration-drafts");
    resetConfigurationStore();
    schemaData = {
      plugins: [widgetPlugin, alphaPlugin],
      overridesFiles: { global: "/home/user/.tokenring/config.yaml", workspace: "/repo/.tokenring/config.yaml" },
      overlayError: null,
    };
    valuesData = {
      effective: { widget: { name: "eff-name", size: 5, apiKey: { __sensitive: true, isSet: true } }, alpha: { label: "default" } },
      overrides: { global: {}, workspace: {} },
    };
  });

  describe("configuration-plugins navigator", () => {
    it("shows a real empty state when no plugin is configurable", () => {
      schemaData = { ...schemaData, plugins: [] };
      renderLayoutView(navigatorView);
      expect(screen.getByText("No configurable plugins")).toBeInTheDocument();
      expect(screen.queryByText(/No plugins match/)).not.toBeInTheDocument();
    });

    it("pins the AI client first", () => {
      const aiClient = { ...widgetPlugin, pluginName: "@tokenring-ai/ai-client", displayName: "Zed AI Client" };
      expect(sortConfigPlugins([widgetPlugin, aiClient, alphaPlugin]).map(plugin => plugin.displayName)).toEqual([
        "Zed AI Client",
        "Alpha Plugin",
        "Widget Plugin",
      ]);
    });

    it("lists plugins; clicking one navigates to it, opens its editor tab and closes the start tab", async () => {
      const user = userEvent.setup();
      const app = renderApp("/configuration");

      expect(screen.getByRole("tab", { name: /Configuration/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Widget Plugin/ })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Alpha Plugin/ }));

      expect(app.location().pathname).toBe("/configuration/alpha-plugin");
      expect(screen.getByRole("tab", { name: /Alpha Plugin/ })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: /^Configuration/ })).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Alpha Plugin" })).toBeInTheDocument();
    });

    it("opened at a plugin's URL, shows no empty start tab beside it", async () => {
      renderApp("/configuration/alpha-plugin");
      expect(await screen.findByRole("tab", { name: /Alpha Plugin/ })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: /^Configuration/ })).not.toBeInTheDocument();
    });

    it("highlights the plugin named by the URL and filters the list by search", async () => {
      const user = userEvent.setup();
      renderApp("/configuration/widget-plugin");

      const list = within(screen.getByRole("navigation", { name: "Configuration plugins" }));
      expect(list.getByRole("button", { name: /Widget Plugin/ })).toHaveAttribute("aria-current", "page");

      await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "alpha");
      expect(list.getByRole("button", { name: /Alpha Plugin/ })).toBeInTheDocument();
      expect(list.queryByRole("button", { name: /Widget Plugin/ })).not.toBeInTheDocument();
    });

    it("finds a plugin by one of its setting labels and shows which setting matched", async () => {
      const user = userEvent.setup();
      renderLayoutView(navigatorView);

      await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "api key");
      const row = screen.getByRole("button", { name: /Widget Plugin/ });
      expect(within(row).getByText("Api Key")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Alpha Plugin/ })).not.toBeInTheDocument();
    });

    it("switches scope, showing the file that layer saves to", async () => {
      const user = userEvent.setup();
      renderLayoutView(navigatorView);

      expect(screen.getByText("/home/user/.tokenring/config.yaml")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Workspace/ }));
      expect(screen.getByText("/repo/.tokenring/config.yaml")).toBeInTheDocument();
    });

    it("shows the overlay error banner", () => {
      schemaData = { ...schemaData, overlayError: "overrides were rejected" };
      renderLayoutView(navigatorView);
      expect(screen.getByText("overrides were rejected")).toBeInTheDocument();
    });

    it("selects the layer from a legacy ?scope= deep link, once", async () => {
      const { getConfigurationState } = await import("./configurationStore.ts");
      const app = renderApp("/configuration/widget-plugin?scope=workspace");
      await waitFor(() => expect(getConfigurationState().scope).toBe("workspace"));

      // The switch owns the scope from then on: a later URL with another param must not reset it.
      app.go("/configuration/alpha-plugin?scope=global");
      expect(getConfigurationState().scope).toBe("workspace");
    });
  });

  describe("configuration-plugin editor", () => {
    it("shows the choose-a-plugin state at /configuration", () => {
      renderApp("/configuration");
      expect(screen.getByText("Select a plugin")).toBeInTheDocument();
      // A getting-started hint: where to begin and what the two scopes mean.
      expect(screen.getByText(/Start with/)).toHaveTextContent("AI providers");
      expect(screen.getByText(/settings apply everywhere you run TokenRing/)).toBeInTheDocument();
    });

    it("opens AI providers from the start view's call to action", async () => {
      const user = userEvent.setup();
      const app = renderApp("/configuration");
      await user.click(screen.getByRole("button", { name: "Connect an AI provider" }));
      expect(app.location().pathname).toBe("/configuration/ai-providers");
      expect(await screen.findByRole("heading", { name: "AI providers" })).toBeInTheDocument();
    });

    it("lists AI providers first in the navigator and routes /configuration/ai-providers to it", async () => {
      const user = userEvent.setup();
      const app = renderApp("/configuration/widget-plugin");
      const nav = screen.getByRole("button", { name: /^AI providers/ });
      expect(nav).toHaveTextContent("No provider connected");
      await user.click(nav);
      expect(app.location().pathname).toBe("/configuration/ai-providers");
      expect(screen.getByRole("button", { name: /^AI providers/ })).toHaveAttribute("aria-current", "page");
    });

    it("lists Permissions in the navigator and routes /configuration/permissions to it", async () => {
      const user = userEvent.setup();
      const app = renderApp("/configuration/widget-plugin");
      await user.click(screen.getByRole("button", { name: /^Permissions/ }));
      expect(app.location().pathname).toBe("/configuration/permissions");
      expect(await screen.findByRole("heading", { name: "Things TokenRing may do without asking" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Permissions/ })).toHaveAttribute("aria-current", "page");
    });

    it("marks the tab while edits are unsaved and clears the badge after saving", async () => {
      const user = userEvent.setup();
      renderApp("/configuration/widget-plugin");
      const tab = () => screen.getByRole("tab", { name: /Widget Plugin/ });

      expect(within(tab()).queryByRole("img", { name: "Unsaved changes" })).not.toBeInTheDocument();
      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      expect(within(tab()).getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save to global" }));
      await waitFor(() => expect(within(tab()).queryByRole("img", { name: "Unsaved changes" })).not.toBeInTheDocument());
    });

    it("renders the plugin named by the route and saves the draft as a full override set", async () => {
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      expect(screen.getByRole("heading", { name: "Widget Plugin" })).toBeInTheDocument();
      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      expect(screen.getByText(/Unsaved changes to the global configuration/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Save to global" }));
      expect(applyConfig).toHaveBeenCalledWith({ scope: "global", overrides: { widget: { name: "eff-namex" } } });
      await waitFor(() => expect(screen.getByText(/Saved to global configuration/)).toBeInTheDocument());
    });

    it("drops the draft after a save so redacted secrets do not leave the form dirty", async () => {
      valuesMutate.mockImplementation(async () => {
        valuesData = { ...valuesData, overrides: { global: { widget: { apiKey: { __sensitive: true, isSet: true } } }, workspace: {} } };
        return valuesData;
      });
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.type(screen.getByLabelText("Api Key"), "new-secret");
      await user.click(screen.getByRole("button", { name: "Save to global" }));

      await waitFor(() => expect(screen.getByText(/Saved to global configuration/)).toBeInTheDocument());
      expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
      expect(screen.getByLabelText("Api Key")).toHaveAttribute("placeholder", expect.stringContaining("set"));
    });

    it("maps failed-apply issues onto fields and clears them on the next edit", async () => {
      applyConfig.mockImplementation(async () => ({ ok: false, issues: [{ path: ["widget", "size"], message: "Too small" }] }));
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
      await user.type(screen.getByRole("spinbutton", { name: "Size" }), "0");
      await user.click(screen.getByRole("button", { name: "Save to global" }));

      await waitFor(() => expect(screen.getByText("Too small")).toBeInTheDocument());
      expect(screen.getByText(/1 validation issue/)).toBeInTheDocument();

      await user.type(screen.getByRole("spinbutton", { name: "Size" }), "2");
      expect(screen.queryByText("Too small")).not.toBeInTheDocument();
    });

    it("validates the draft before save and shows field errors", async () => {
      validateConfig.mockImplementation(async () => ({ ok: false, issues: [{ path: ["widget", "size"], message: "Must be at least 1" }] }));
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
      await user.type(screen.getByRole("spinbutton", { name: "Size" }), "0");

      expect(await screen.findByText("Must be at least 1", undefined, { timeout: 2000 })).toBeInTheDocument();
      expect(validateConfig.mock.lastCall?.[0]).toMatchObject({ scope: "global", overrides: { widget: {} } });
      expect(screen.getByText(/fix the highlighted fields before saving/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save to global" })).toBeDisabled();
      expect(applyConfig).not.toHaveBeenCalled();
    });

    it("ignores draft-validation issues that belong to other plugins", async () => {
      validateConfig.mockImplementation(async () => ({ ok: false, issues: [{ path: ["alpha", "label"], message: "Alpha broke" }] }));
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      await waitFor(() => expect(validateConfig).toHaveBeenCalled(), { timeout: 2000 });
      expect(screen.getByRole("button", { name: "Save to global" })).toBeEnabled();
    });

    it("resets a saved override to its default after confirming", async () => {
      valuesData = { ...valuesData, overrides: { global: { widget: { name: "saved-name", size: 3 } }, workspace: {} } };
      valuesMutate.mockImplementation(async () => {
        valuesData = { ...valuesData, overrides: { global: { widget: { size: 3 } }, workspace: {} } };
        return valuesData;
      });
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.click(screen.getByRole("button", { name: "Reset Name" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("Reset Name?")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Reset" }));

      await waitFor(() => expect(resetConfig).toHaveBeenCalledWith({ scope: "global", path: ["widget", "name"] }));
      await waitFor(() => expect(screen.getByText(/Reset Name to its default/)).toBeInTheDocument());
      expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
    });

    it("does not reset a saved override when the confirm is cancelled", async () => {
      valuesData = { ...valuesData, overrides: { global: { widget: { name: "saved-name" } }, workspace: {} } };
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.click(screen.getByRole("button", { name: "Reset Name" }));
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      expect(resetConfig).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("saved-name");
    });

    it("resetting an unsaved edit only changes the draft", async () => {
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      await user.click(screen.getByRole("button", { name: "Reset Name" }));
      expect(resetConfig).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name");
    });

    it("discard restores the server overrides", async () => {
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      await user.click(screen.getByRole("button", { name: "Discard" }));

      expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name");
    });

    it("asks before discarding several changed fields", async () => {
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
      await user.type(screen.getByLabelText("Api Key"), "secret");
      await user.click(screen.getByRole("button", { name: "Discard" }));

      expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-namex");

      await user.click(screen.getByRole("button", { name: "Discard" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Discard" }));
      await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name"));
    });

    describe("several plugin panels share one scope", () => {
      const renderPanel = (plugin: string) => renderPlugin(plugin);
      it("badges and offers Save/Discard only on the plugin that was edited", async () => {
        const user = userEvent.setup();
        const widget = renderPanel("widget-plugin");
        const alpha = renderPanel("alpha-plugin");

        await user.type(within(widget.container).getByRole("textbox", { name: "Name" }), "x");

        expect(within(widget.container).getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument();
        expect(within(alpha.container).queryByRole("img", { name: "Unsaved changes" })).not.toBeInTheDocument();
        expect(within(alpha.container).queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
      });

      it("discarding one plugin keeps another plugin's unsaved edits", async () => {
        const user = userEvent.setup();
        const widget = renderPanel("widget-plugin");
        const alpha = renderPanel("alpha-plugin");

        await user.type(within(widget.container).getByRole("textbox", { name: "Name" }), "x");
        await user.type(within(alpha.container).getByRole("textbox", { name: "Label" }), "y");
        await user.click(within(alpha.container).getByRole("button", { name: "Discard" }));

        expect(within(alpha.container).getByRole("textbox", { name: "Label" })).toHaveValue("default");
        expect(within(alpha.container).queryByText(/Unsaved changes/)).not.toBeInTheDocument();
        expect(within(widget.container).getByRole("textbox", { name: "Name" })).toHaveValue("eff-namex");
        expect(within(widget.container).getByText(/Unsaved changes/)).toBeInTheDocument();
      });

      it("saving one plugin sends only its changes over the server overrides and keeps the other draft", async () => {
        valuesData = { ...valuesData, overrides: { global: { alpha: { label: "server-label" } }, workspace: {} } };
        valuesMutate.mockImplementation(async () => {
          valuesData = { ...valuesData, overrides: { global: { alpha: { label: "server-label" }, widget: { name: "eff-namex" } }, workspace: {} } };
          return valuesData;
        });
        const user = userEvent.setup();
        const widget = renderPanel("widget-plugin");
        const alpha = renderPanel("alpha-plugin");

        await user.type(within(alpha.container).getByRole("textbox", { name: "Label" }), "y");
        await user.type(within(widget.container).getByRole("textbox", { name: "Name" }), "x");
        await user.click(within(widget.container).getByRole("button", { name: "Save to global" }));

        expect(applyConfig).toHaveBeenCalledWith({ scope: "global", overrides: { alpha: { label: "server-label" }, widget: { name: "eff-namex" } } });
        await waitFor(() => expect(within(widget.container).getByText(/Saved to global configuration/)).toBeInTheDocument());
        expect(within(widget.container).queryByText(/Unsaved changes/)).not.toBeInTheDocument();
        expect(within(alpha.container).getByRole("textbox", { name: "Label" })).toHaveValue("server-labely");
        expect(within(alpha.container).getByText(/Unsaved changes/)).toBeInTheDocument();
      });
    });

    it("edits and saves the workspace layer when that scope is selected", async () => {
      setConfigurationScope("workspace");
      valuesData = { ...valuesData, overrides: { global: {}, workspace: { widget: { name: "workspace-name" } } } };
      const user = userEvent.setup();
      renderPlugin("widget-plugin");

      expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("workspace-name");
      await user.type(screen.getByRole("textbox", { name: "Name" }), "y");
      await user.click(screen.getByRole("button", { name: "Save to workspace" }));

      expect(applyConfig).toHaveBeenCalledWith({ scope: "workspace", overrides: { widget: { name: "workspace-namey" } } });
    });

    it("warns when workspace overrides shadow the global scope", () => {
      valuesData = { ...valuesData, overrides: { global: {}, workspace: { widget: { name: "workspace-name" } } } };
      renderPlugin("widget-plugin");
      expect(screen.getByText(/also configured at the workspace level/)).toBeInTheDocument();
    });

    it("offers to close the tab for a plugin that is no longer configurable", async () => {
      const user = userEvent.setup();
      const app = renderApp("/configuration/missing-plugin");

      expect(screen.getByText("Plugin not found")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close panel" }));
      await waitFor(() => expect(screen.queryByText("Plugin not found")).not.toBeInTheDocument());
      expect(app.location().pathname).toBe("/configuration");
    });
  });
});
