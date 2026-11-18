import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

type Json = Record<string, unknown>;
type ConfigWriteResult = { ok: true } | { ok: false; issues: { path: (string | number)[]; message: string }[] };

const mutateValues = mock(async () => undefined);
const toastError = mock((_msg: string, _opts?: unknown) => "toast-id");
const updateConfigLayer = mock(async (_scope: string, _mutate: (overrides: Json) => Json): Promise<ConfigWriteResult> => ({ ok: true }));
const formatConfigIssues = mock((issues: { path: (string | number)[]; message: string }[]) =>
  issues.map(issue => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("\n"),
);

let valuesData: {
  effective: Json;
  overrides: { global: Json; workspace: Json };
};

void mock.module("../rpc.ts", () => ({
  useConfigValues: () => ({ data: valuesData, isLoading: false, error: undefined, mutate: mutateValues }),
  useChatModelsByProvider: () => ({
    data: {
      modelsByProvider: {
        openai: {
          "openai/gpt-4o": {
            available: true,
            status: "online",
            modelSpec: { modelId: "gpt-4o", providerDisplayName: "openai" },
          },
          "openai/gpt-4o-mini": {
            available: true,
            status: "online",
            modelSpec: { modelId: "gpt-4o-mini", providerDisplayName: "openai" },
          },
        },
      },
    },
    isLoading: false,
  }),
  useToolApprovalLevels: () => ({
    data: {
      levels: [
        { level: 6, description: "Might delete non-temporary files or data" },
        { level: 10, description: "Absolutely destructive system command" },
      ],
    },
    isLoading: false,
  }),
}));

void mock.module("../lib/configWrites.ts", () => ({
  updateConfigLayer,
  formatConfigIssues,
}));

void mock.module("./ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: toastError, info: mock(), warning: mock() },
}));

const { default: ChatSettingsDropdown, CHAT_CONFIG_HREF, mergeChatOverrides } = await import("./ChatSettingsDropdown.tsx");

function seedValues(overrides?: { global?: Json; workspace?: Json }) {
  valuesData = {
    effective: {
      chat: {
        defaultModels: ["openai/*"],
        agentDefaults: {
          model: "openai/gpt-4o",
          parallelTools: false,
          allowRemoteAttachments: true,
          maxSteps: 0,
          autoToolApprovalLevel: 6,
          toolApprovalMode: "auto",
          compaction: { policy: "ask", compactionThreshold: 0.5, background: false },
        },
      },
    },
    overrides: {
      global: overrides?.global ?? {},
      workspace: overrides?.workspace ?? {},
    },
  };
}

function renderDropdown() {
  return render(
    <MemoryRouter>
      <ChatSettingsDropdown />
    </MemoryRouter>,
  );
}

async function openPanel() {
  await userEvent.click(screen.getByRole("button", { name: "Chat defaults" }));
  // Radix names the content from the trigger (aria-labelledby), so query the subtitle instead.
  expect(await screen.findByText("Applies to new agents")).toBeInTheDocument();
}

describe("mergeChatOverrides", () => {
  it("merges agentDefaults without clobbering sibling chat keys", () => {
    const next = mergeChatOverrides(
      { chat: { defaultModels: ["openai/*"], agentDefaults: { model: "openai/gpt-4o" } }, other: 1 },
      { agentDefaults: { parallelTools: true } },
    );

    expect(next).toEqual({
      other: 1,
      chat: {
        defaultModels: ["openai/*"],
        agentDefaults: { model: "openai/gpt-4o", parallelTools: true },
      },
    });
  });

  it("merges compaction and deletes undefined keys", () => {
    const next = mergeChatOverrides(
      { chat: { agentDefaults: { compaction: { policy: "ask", focus: "keep" } } } },
      { agentDefaults: { compaction: { policy: "never", applyThreshold: undefined } } },
    );

    expect(next).toEqual({
      chat: {
        agentDefaults: {
          compaction: { policy: "never", focus: "keep" },
        },
      },
    });
  });
});

describe("ChatSettingsDropdown", () => {
  beforeEach(() => {
    seedValues();
    updateConfigLayer.mockReset();
    updateConfigLayer.mockImplementation(async (_scope: string, _mutate: (overrides: Json) => Json): Promise<ConfigWriteResult> => ({ ok: true }));
    mutateValues.mockReset();
    toastError.mockReset();
    formatConfigIssues.mockClear();
  });

  it("renders the trigger and keeps the panel closed by default", () => {
    renderDropdown();

    expect(screen.getByRole("button", { name: "Chat defaults" })).toBeInTheDocument();
    expect(screen.queryByText("Applies to new agents")).not.toBeInTheDocument();
  });

  it("opens with primary fields populated from effective config", async () => {
    renderDropdown();
    await openPanel();

    expect(screen.getByText("Applies to new agents")).toBeInTheDocument();
    expect(screen.getByLabelText("Default model")).toHaveValue("openai/gpt-4o");
    expect(within(screen.getByRole("group", { name: "Compaction policy" })).getByRole("button", { name: "Ask" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "When an action needs approval" })).getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Enable parallel tool execution" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("slider", { name: "Go ahead without asking up to this safety level" })).toHaveValue("6");
  });

  it("writes parallelTools to the workspace layer by default", async () => {
    let written: { scope?: string; overrides?: Json } = {};
    updateConfigLayer.mockImplementation(async (scope: string, mutate: (overrides: Json) => Json) => {
      written = { scope, overrides: mutate({ filesystem: { root: "/tmp" } }) };
      return { ok: true as const };
    });

    renderDropdown();
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Enable parallel tool execution" }));

    await waitFor(() => expect(updateConfigLayer).toHaveBeenCalledTimes(1));
    expect(written.scope).toBe("workspace");
    expect(written.overrides).toEqual({
      filesystem: { root: "/tmp" },
      chat: { agentDefaults: { parallelTools: true } },
    });
    await waitFor(() => expect(mutateValues).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
  });

  it("writes toolApprovalMode to the selected scope", async () => {
    let written: { scope?: string; overrides?: Json } = {};
    updateConfigLayer.mockImplementation(async (scope: string, mutate: (overrides: Json) => Json) => {
      written = { scope, overrides: mutate({}) };
      return { ok: true as const };
    });

    renderDropdown();
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Global" }));
    await userEvent.click(within(screen.getByRole("group", { name: "When an action needs approval" })).getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(updateConfigLayer).toHaveBeenCalledTimes(1));
    expect(written.scope).toBe("global");
    expect(written.overrides).toEqual({
      chat: { agentDefaults: { toolApprovalMode: "ask" } },
    });
  });

  it("surfaces applyConfig validation issues and does not mutate on failure", async () => {
    updateConfigLayer.mockResolvedValueOnce({
      ok: false as const,
      issues: [{ path: ["chat", "agentDefaults", "maxCost"], message: "Expected number" }],
    });

    renderDropdown();
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Enable parallel tool execution" }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]![0]).toBe("chat.agentDefaults.maxCost: Expected number");
    expect(mutateValues).not.toHaveBeenCalled();
  });

  it("links to the full chat configuration page", async () => {
    renderDropdown();
    await openPanel();

    const link = screen.getByRole("link", { name: /Open full chat configuration/i });
    expect(link).toHaveAttribute("href", CHAT_CONFIG_HREF);
    expect(CHAT_CONFIG_HREF).toBe("/configuration/%40tokenring-ai%2Fchat");
  });

  it("notes when workspace overrides would shadow a global edit", async () => {
    seedValues({ workspace: { chat: { agentDefaults: { model: "openai/gpt-4o-mini" } } } });

    renderDropdown();
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Global" }));

    expect(screen.getByRole("status")).toHaveTextContent("Workspace configuration overrides these values");
  });
});
