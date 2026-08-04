import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ConfigForm from "./ConfigForm.tsx";

const pluginFixture: ConfigUIPluginSchema = {
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
        { kind: "field", key: "enabled", path: ["widget", "enabled"], label: "Enabled", field: { type: "checkbox" }, required: false },
        {
          kind: "field",
          key: "mode",
          path: ["widget", "mode"],
          label: "Mode",
          field: {
            type: "select",
            options: [
              { label: "alpha", value: "alpha" },
              { label: "beta", value: "beta" },
            ],
          },
          required: false,
        },
        { kind: "field", key: "apiKey", path: ["widget", "apiKey"], label: "Api Key", field: { type: "password" }, required: false, sensitive: true },
        { kind: "field", key: "tags", path: ["widget", "tags"], label: "Tags", field: { type: "stringList", itemType: "string" }, required: false },
        {
          kind: "field",
          key: "include",
          path: ["widget", "include"],
          label: "Include",
          field: { type: "regex" },
          required: false,
          placeholder: "\\.ts$",
        },
      ],
    },
    connections: {
      kind: "map",
      key: "connections",
      path: ["connections"],
      label: "Connections",
      value: {
        kind: "group",
        key: "value",
        path: [],
        label: "Connection",
        children: [{ kind: "field", key: "url", path: ["url"], label: "Url", field: { type: "text" }, required: true }],
      },
    },
  },
};

const otherPluginFixture: ConfigUIPluginSchema = {
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

const applyConfigMock = mock();
const schemaMutateMock = mock(() => Promise.resolve());
const valuesMutateMock = mock(async () => valuesData);
let schemaData: Record<string, unknown>;
let valuesData: Record<string, unknown>;

void mock.module("../../rpc.ts", () => ({
  useConfigSchema: () => ({ data: schemaData, isLoading: false, error: undefined, mutate: schemaMutateMock }),
  useConfigValues: () => ({ data: valuesData, isLoading: false, error: undefined, mutate: valuesMutateMock }),
  configRPCClient: { applyConfig: applyConfigMock },
}));

const { default: ConfigurationApp } = await import("../../pages/apps/ConfigurationApp.tsx");

beforeEach(() => {
  applyConfigMock.mockReset();
  schemaMutateMock.mockReset();
  schemaMutateMock.mockImplementation(() => Promise.resolve());
  valuesMutateMock.mockReset();
  valuesMutateMock.mockImplementation(async () => valuesData);
  schemaData = {
    plugins: [pluginFixture, otherPluginFixture],
    overridesFiles: {
      user: "/home/user/.tokenring/config.yaml",
      project: "/repo/.tokenring/config.yaml",
    },
    overlayError: null,
  };
  valuesData = {
    effective: {
      widget: { name: "eff-name", size: 5, apiKey: { __sensitive: true, isSet: true } },
      connections: { main: { url: "sqlite://x" } },
      alpha: { label: "default" },
    },
    overrides: { user: {}, project: {} },
  };
});

describe("ConfigForm", () => {
  const renderForm = (draft: Record<string, unknown> = {}, issues: { path: (string | number)[]; message: string }[] = []) => {
    const onDraftChange = mock();
    render(<ConfigForm plugin={pluginFixture} draft={draft} effective={(valuesData as any).effective} issues={issues} onDraftChange={onDraftChange} />);
    return onDraftChange;
  };

  it("renders a control per field kind", () => {
    renderForm();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name");
    expect(screen.getByRole("spinbutton", { name: "Size" })).toHaveValue(5);
    expect(screen.getByRole("switch", { name: "Enabled" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeInTheDocument();
    expect(screen.getByLabelText("Api Key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("textbox", { name: "Add to Tags" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Include" })).toBeInTheDocument();
    // map node renders existing entries
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("reports draft edits at the right path", async () => {
    const user = userEvent.setup();
    const onDraftChange = renderForm();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toEqual({ widget: { name: "eff-namex" } });

    await user.click(screen.getByRole("switch", { name: "Enabled" }));
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toEqual({ widget: { enabled: true } });

    await user.selectOptions(screen.getByRole("combobox", { name: "Mode" }), "beta");
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toEqual({ widget: { mode: "beta" } });
  });

  it("renders a regex field and flags invalid patterns", () => {
    renderForm({ widget: { include: "[" } });

    const include = screen.getByRole("textbox", { name: "Include" });
    expect(include).toHaveValue("[");
    expect(include).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows the modified badge and reset clears the override", async () => {
    const user = userEvent.setup();
    const onDraftChange = renderForm({ widget: { size: 7 } });

    expect(screen.getByText("modified")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Size" })).toHaveValue(7);

    await user.click(screen.getByRole("button", { name: "Reset Size" }));
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toEqual({});
  });

  it("shows a set-secret placeholder for redacted sensitive values", () => {
    renderForm();
    expect(screen.getByLabelText("Api Key")).toHaveAttribute("placeholder", expect.stringContaining("set"));
  });

  it("renders validation issues on the matching field", () => {
    renderForm({}, [{ path: ["widget", "size"], message: "Too small" }]);
    expect(screen.getByRole("alert")).toHaveTextContent("Too small");
  });

  it("does not mark inherited list items as modified", () => {
    const listPlugin: ConfigUIPluginSchema = {
      pluginName: "list-plugin",
      displayName: "List Plugin",
      description: "list",
      version: "1.0.0",
      slices: {
        items: {
          kind: "list",
          key: "items",
          path: ["items"],
          label: "Items",
          item: {
            kind: "group",
            key: "value",
            path: [],
            label: "Item",
            children: [{ kind: "field", key: "url", path: ["url"], label: "Url", field: { type: "text" }, required: false }],
          },
        },
      },
    };
    render(<ConfigForm plugin={listPlugin} draft={{}} effective={{ items: [{ url: "https://example.test" }] }} issues={[]} onDraftChange={mock()} />);
    expect(screen.getByRole("textbox", { name: "Url" })).toHaveValue("https://example.test");
    expect(screen.queryByText("modified")).not.toBeInTheDocument();
  });

  it("keeps an empty string-list as an override when the last item is removed", async () => {
    const user = userEvent.setup();
    const onDraftChange = renderForm({ widget: { tags: ["only"] } });

    await user.click(screen.getByRole("button", { name: "Remove only" }));
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toEqual({ widget: { tags: [] } });
  });

  it("restores a secret override within the same mount when source is toggled away and back", async () => {
    const secretPlugin: ConfigUIPluginSchema = {
      pluginName: "secret-plugin",
      displayName: "Secret Plugin",
      description: "secrets",
      version: "1.0.0",
      slices: {
        creds: {
          kind: "group",
          key: "creds",
          path: ["creds"],
          label: "Credentials",
          children: [{ kind: "secret", key: "token", path: ["creds", "token"], label: "Token", required: false, sensitive: true }],
        },
      },
    };
    const redacted = { __sensitive: true, isSet: true };
    let draft: Record<string, unknown> = { creds: { token: redacted } };
    const user = userEvent.setup();

    const Harness = () => {
      const [current, setCurrent] = useState(draft);
      return (
        <ConfigForm
          plugin={secretPlugin}
          draft={current}
          effective={{ creds: { token: redacted } }}
          issues={[]}
          onDraftChange={next => {
            draft = next;
            setCurrent(next);
          }}
        />
      );
    };

    render(<Harness />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Token source" }), "env");
    expect(draft).toEqual({ creds: { token: { source: "env", env: "" } } });

    await user.selectOptions(screen.getByRole("combobox", { name: "Token source" }), "value");
    expect(draft).toEqual({ creds: { token: redacted } });
    expect(screen.getByLabelText("Token value")).toHaveAttribute("placeholder", expect.stringContaining("set"));
  });
});

describe("ConfigurationApp", () => {
  const renderApp = (initialEntry = "/configuration") =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/configuration/:plugin?" element={<ConfigurationApp />} />
        </Routes>
      </MemoryRouter>,
    );

  it("lists plugins and honors the /configuration/:plugin deep link", async () => {
    renderApp("/configuration/widget-plugin");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Widget Plugin" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Widget Plugin/ })).toBeInTheDocument();
  });

  it("shows the overrides file for the active scope", async () => {
    renderApp("/configuration/widget-plugin");
    await waitFor(() => {
      expect(screen.getByText("/home/user/.tokenring/config.yaml")).toBeInTheDocument();
    });
  });

  it("filters the plugin list by search", async () => {
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByRole("button", { name: /Widget Plugin/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Alpha Plugin/ })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search plugins" }), "alpha");
    expect(screen.getByRole("button", { name: /Alpha Plugin/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Widget Plugin/ })).not.toBeInTheDocument();
  });

  it("saves the edited draft as a full override set for the active scope", async () => {
    applyConfigMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin");

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    await user.click(screen.getByRole("button", { name: "Save to user" }));

    expect(applyConfigMock).toHaveBeenCalledWith({ scope: "user", overrides: { widget: { name: "eff-namex" } } });
    await waitFor(() => expect(screen.getByText(/Saved to user configuration/)).toBeInTheDocument());
  });

  it("reseeds the draft from post-save server values so sensitive redaction does not leave the form dirty", async () => {
    applyConfigMock.mockResolvedValue({ ok: true });
    // After save the server returns the secret redacted — matching what a real mutate would yield.
    valuesMutateMock.mockImplementation(() => {
      valuesData = {
        ...valuesData,
        overrides: {
          user: { widget: { apiKey: { __sensitive: true, isSet: true } } },
          project: {},
        },
      };
      return Promise.resolve(valuesData);
    });
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin");

    await waitFor(() => expect(screen.getByLabelText("Api Key")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Api Key"), "new-secret");
    expect(screen.getByText(/Unsaved changes to the user configuration/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save to user" }));
    await waitFor(() => expect(screen.getByText(/Saved to user configuration/)).toBeInTheDocument());
    // Draft must match the redacted server snapshot — no lingering "unsaved changes".
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Api Key")).toHaveAttribute("placeholder", expect.stringContaining("set"));
  });

  it("maps failed-apply issues onto fields", async () => {
    applyConfigMock.mockResolvedValue({ ok: false, issues: [{ path: ["widget", "size"], message: "Too small" }] });
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin");

    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Size" })).toBeInTheDocument());
    await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
    await user.type(screen.getByRole("spinbutton", { name: "Size" }), "0");
    await user.click(screen.getByRole("button", { name: "Save to user" }));

    await waitFor(() => expect(screen.getByText("Too small")).toBeInTheDocument());
    expect(screen.getByText(/1 validation issue/)).toBeInTheDocument();
  });

  it("clears validation feedback when the user edits after a failed save", async () => {
    applyConfigMock.mockResolvedValue({ ok: false, issues: [{ path: ["widget", "size"], message: "Too small" }] });
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin");

    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Size" })).toBeInTheDocument());
    await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
    await user.type(screen.getByRole("spinbutton", { name: "Size" }), "0");
    await user.click(screen.getByRole("button", { name: "Save to user" }));
    await waitFor(() => expect(screen.getByText("Too small")).toBeInTheDocument());

    await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
    await user.type(screen.getByRole("spinbutton", { name: "Size" }), "2");
    expect(screen.queryByText("Too small")).not.toBeInTheDocument();
    expect(screen.queryByText(/validation issue/)).not.toBeInTheDocument();
  });

  it("discard restores the server overrides", async () => {
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin");

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    expect(screen.getByText(/Unsaved changes to the user configuration/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name");
  });

  it("switches between user and project scopes", async () => {
    valuesData = {
      ...valuesData,
      overrides: {
        user: { widget: { name: "user-name" } },
        project: { widget: { name: "project-name" } },
      },
    };
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin?scope=user");

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("user-name"));
    expect(screen.getByText("/home/user/.tokenring/config.yaml")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Project/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("project-name"));
    expect(screen.getByText("/repo/.tokenring/config.yaml")).toBeInTheDocument();
  });

  it("saves to the project scope when selected", async () => {
    applyConfigMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderApp("/configuration/widget-plugin?scope=project");

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "y");
    await user.click(screen.getByRole("button", { name: "Save to project" }));

    expect(applyConfigMock).toHaveBeenCalledWith({ scope: "project", overrides: { widget: { name: "eff-namey" } } });
    await waitFor(() => expect(screen.getByText(/Saved to project configuration/)).toBeInTheDocument());
  });

  it("shows the overlay error banner", async () => {
    schemaData = { ...schemaData, overlayError: "overrides were rejected" };
    renderApp();
    await waitFor(() => expect(screen.getByText("overrides were rejected")).toBeInTheDocument());
  });

  it("warns when project overrides shadow the user scope", async () => {
    valuesData = {
      ...valuesData,
      overrides: {
        user: {},
        project: { widget: { name: "project-name" } },
      },
    };
    renderApp("/configuration/widget-plugin?scope=user");
    await waitFor(() => {
      expect(screen.getByText(/also configured at the project level/)).toBeInTheDocument();
    });
  });
});
