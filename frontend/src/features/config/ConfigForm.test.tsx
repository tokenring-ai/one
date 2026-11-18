import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { useState } from "react";
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

let valuesData: { effective: Record<string, unknown> };

beforeEach(() => {
  valuesData = {
    effective: {
      widget: { name: "eff-name", size: 5, apiKey: { __sensitive: true, isSet: true } },
      connections: { main: { url: "sqlite://x" } },
      alpha: { label: "default" },
    },
  };
});

describe("ConfigForm", () => {
  const renderForm = (draft: Record<string, unknown> = {}, issues: { path: (string | number)[]; message: string }[] = []) => {
    const onDraftChange = mock();
    render(<ConfigForm plugin={pluginFixture} draft={draft} effective={valuesData.effective} issues={issues} onDraftChange={onDraftChange} />);
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

  it("collapses map entries until the row is clicked", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole("textbox", { name: "Url" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^main/ }));
    expect(screen.getByRole("textbox", { name: "Url" })).toHaveValue("sqlite://x");

    await user.click(screen.getByRole("button", { name: /^main/ }));
    expect(screen.queryByRole("textbox", { name: "Url" })).not.toBeInTheDocument();
  });

  it("expands a newly added map entry", async () => {
    const user = userEvent.setup();
    let draft: Record<string, unknown> = {};

    const Harness = () => {
      const [current, setCurrent] = useState(draft);
      return (
        <ConfigForm
          plugin={pluginFixture}
          draft={current}
          effective={valuesData.effective}
          issues={[]}
          onDraftChange={next => {
            draft = next;
            setCurrent(next);
          }}
        />
      );
    };

    render(<Harness />);
    await user.type(screen.getByRole("textbox", { name: "Add entry to Connections" }), "replica");
    await user.click(screen.getByRole("button", { name: "Add entry" }));

    expect(draft).toEqual({ connections: { replica: {} } });
    expect(screen.getByRole("button", { name: /^replica/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps map entries with validation issues expanded", () => {
    renderForm({}, [{ path: ["connections", "main", "url"], message: "Bad url" }]);

    expect(screen.getByRole("button", { name: /^main/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Bad url");
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
