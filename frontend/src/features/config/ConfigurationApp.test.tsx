import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { MemoryRouter } from "react-router-dom";
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

const applyConfigMock = mock();
let schemaData: Record<string, unknown>;
let valuesData: Record<string, unknown>;

void mock.module("../../rpc.ts", () => ({
  useConfigSchema: () => ({ data: schemaData, isLoading: false, error: undefined, mutate: mock(() => Promise.resolve()) }),
  useConfigValues: () => ({ data: valuesData, isLoading: false, error: undefined, mutate: mock(() => Promise.resolve()) }),
  configRPCClient: { applyConfig: applyConfigMock },
}));

const { default: ConfigurationApp } = await import("../../pages/apps/ConfigurationApp.tsx");

beforeEach(() => {
  applyConfigMock.mockReset();
  schemaData = {
    plugins: [pluginFixture],
    restartRequired: false,
    overridesFile: "/home/user/.tokenring/config.yaml",
    overlayError: null,
  };
  valuesData = {
    effective: { widget: { name: "eff-name", size: 5, apiKey: { __sensitive: true, isSet: true } }, connections: { main: { url: "sqlite://x" } } },
    overrides: {},
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
});

describe("ConfigurationApp", () => {
  const renderApp = (initialEntry = "/configuration") =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ConfigurationApp />
      </MemoryRouter>,
    );

  it("lists plugins and honors the ?plugin= deep link", async () => {
    renderApp("/configuration?plugin=widget-plugin");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Widget Plugin" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Widget Plugin/ })).toBeInTheDocument();
  });

  it("saves the edited draft as a full override set", async () => {
    applyConfigMock.mockResolvedValue({ ok: true, restartRequired: false });
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(applyConfigMock).toHaveBeenCalledWith({ overrides: { widget: { name: "eff-namex" } } });
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });

  it("shows the restart banner when apply requires a restart", async () => {
    applyConfigMock.mockResolvedValue({ ok: true, restartRequired: true });
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText(/need a restart/)).toBeInTheDocument());
  });

  it("maps failed-apply issues onto fields", async () => {
    applyConfigMock.mockResolvedValue({ ok: false, issues: [{ path: ["widget", "size"], message: "Too small" }] });
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByRole("spinbutton", { name: "Size" })).toBeInTheDocument());
    await user.clear(screen.getByRole("spinbutton", { name: "Size" }));
    await user.type(screen.getByRole("spinbutton", { name: "Size" }), "0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText("Too small")).toBeInTheDocument());
    expect(screen.getByText(/1 validation issue/)).toBeInTheDocument();
  });

  it("discard restores the server overrides", async () => {
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Name" }), "x");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("eff-name");
  });

  it("shows the overlay error banner", async () => {
    schemaData = { ...schemaData, overlayError: "overrides were rejected" };
    renderApp();
    await waitFor(() => expect(screen.getByText("overrides were rejected")).toBeInTheDocument());
  });
});
