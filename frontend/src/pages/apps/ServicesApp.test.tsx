import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const toolsData = {
  tools: {
    "filesystem/readFile": { displayName: "filesystem/readFile" },
    "filesystem/writeFile": { displayName: "filesystem/writeFile" },
    "git/status": { displayName: "git/status" },
  },
};

const modelsData = {
  modelsByProvider: {
    openai: {
      "openai/gpt-4o": { status: "ready", available: true, hot: true },
      "openai/gpt-4o-mini": { status: "ready", available: true, hot: false },
    },
    anthropic: {
      "anthropic/claude-sonnet": { status: "missing-key", available: false, hot: false },
    },
  },
};

const hooksData = {
  hooks: {
    "checkpoint/auto": { displayName: "Auto checkpoint", description: "Saves checkpoints on idle" },
    "memory/summarize": { displayName: "Memory summarize", description: "Summarizes long context" },
  },
};

const agent = {
  id: "agent-1",
  createdAt: 1_700_000_000_000,
  agentType: "code",
  displayName: "Code Engineer #1",
  description: "Writes code",
  idle: true,
  currentActivity: "",
};

const enableTools = mock(async (args: { agentId: string; tools: string[] }) => {
  for (const tool of args.tools) {
    if (!enabledToolList.includes(tool)) enabledToolList.push(tool);
  }
  return { status: "success" as const, tools: [...enabledToolList] };
});
const disableTools = mock(async (args: { agentId: string; tools: string[] }) => {
  enabledToolList = enabledToolList.filter(tool => !args.tools.includes(tool));
  return { status: "success" as const, tools: [...enabledToolList] };
});
const enableHooks = mock(async (args: { agentId: string; hooks: string[] }) => {
  for (const hook of args.hooks) {
    if (!enabledHookList.includes(hook)) enabledHookList.push(hook);
  }
  return { status: "success" as const, hooks: [...enabledHookList] };
});
const disableHooks = mock(async (args: { agentId: string; hooks: string[] }) => {
  enabledHookList = enabledHookList.filter(hook => !args.hooks.includes(hook));
  return { status: "success" as const, hooks: [...enabledHookList] };
});
const mutateTools = mock(async () => undefined);
const mutateEnabledTools = mock(async () => undefined);
const mutateHooks = mock(async () => undefined);
const mutateEnabledHooks = mock(async () => undefined);
const mutateModels = mock(async () => undefined);
const mutateAgents = mock(async () => undefined);
const mutateLogs = mock(async () => undefined);

let enabledToolList: string[] = [];
let enabledHookList: string[] = [];
let agentList: (typeof agent)[] = [agent];
let logEntries: Array<{ timestamp: number; level: "info" | "error"; message: string }> = [
  { timestamp: 1_700_000_000_000, level: "info", message: "App started" },
  { timestamp: 1_700_000_001_000, level: "error", message: "Plugin failed to load" },
];

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, mutate: mutateAgents }),
  useAvailableTools: () => ({ data: toolsData, isLoading: false, error: undefined, mutate: mutateTools }),
  useEnabledTools: () => ({
    data: { status: "success" as const, tools: enabledToolList },
    isLoading: false,
    mutate: mutateEnabledTools,
  }),
  useChatModelsByProvider: () => ({ data: modelsData, isLoading: false, error: undefined, mutate: mutateModels }),
  useAvailableHooks: () => ({ data: hooksData, isLoading: false, error: undefined, mutate: mutateHooks }),
  useEnabledHooks: () => ({
    data: { status: "success" as const, hooks: enabledHookList },
    isLoading: false,
    mutate: mutateEnabledHooks,
  }),
  useAppLogs: () => ({
    data: { logs: logEntries },
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateLogs,
  }),
  chatRPCClient: { enableTools, disableTools },
  lifecycleRPCClient: { enableHooks, disableHooks },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
  },
}));

const { default: ServicesApp } = await import("./ServicesApp.tsx");

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/services"]}>
      <Routes>
        <Route path="/services" element={<ServicesApp />} />
        <Route path="/agent/:agentId" element={<div>Agent page</div>} />
        <Route path="/agents" element={<div>Agents list page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ServicesApp", () => {
  beforeEach(() => {
    enableTools.mockClear();
    disableTools.mockClear();
    enableHooks.mockClear();
    disableHooks.mockClear();
    mutateTools.mockClear();
    mutateEnabledTools.mockClear();
    mutateHooks.mockClear();
    mutateEnabledHooks.mockClear();
    mutateModels.mockClear();
    mutateAgents.mockClear();
    mutateLogs.mockClear();
    enabledToolList = ["filesystem/readFile"];
    enabledHookList = ["checkpoint/auto"];
    agentList = [agent];
    logEntries = [
      { timestamp: 1_700_000_000_000, level: "info", message: "App started" },
      { timestamp: 1_700_000_001_000, level: "error", message: "Plugin failed to load" },
    ];
  });

  it("shows tools grouped by package with enable state for the selected agent", async () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "Services" })).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    expect(screen.getByText("git")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();

    // Enabled tools auto-expand their package; short name + full tool id both render
    expect(screen.getByText("readFile")).toBeInTheDocument();
    expect(screen.getByText("filesystem/readFile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable readFile" })).toBeInTheDocument();
  });

  it("enables a disabled tool for the selected agent", async () => {
    const user = userEvent.setup();
    renderApp();

    // git is collapsed when it has no enabled tools — open it
    const gitToggle = screen.getByRole("button", { name: /git/i });
    if (!screen.queryByRole("button", { name: "Enable status" })) {
      await user.click(gitToggle);
    }

    await user.click(screen.getByRole("button", { name: "Enable status" }));

    await waitFor(() => {
      expect(enableTools).toHaveBeenCalledWith({ agentId: "agent-1", tools: ["git/status"] });
    });
    expect(mutateEnabledTools).toHaveBeenCalled();
  });

  it("filters tools by search query", async () => {
    const user = userEvent.setup();
    renderApp();

    const search = screen.getByLabelText("Filter tools");
    await user.type(search, "git");

    expect(screen.getByText("git")).toBeInTheDocument();
    expect(screen.queryByText("filesystem")).not.toBeInTheDocument();
  });

  it("shows models with availability and hot filters", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Models" }));

    expect(screen.getByText("openai")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("hot")).toBeInTheDocument();
    expect(screen.getByText("anthropic")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Hot/i }));
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.queryByText("gpt-4o-mini")).not.toBeInTheDocument();
    expect(screen.queryByText("anthropic")).not.toBeInTheDocument();
  });

  it("lists hooks and can disable an enabled hook", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Hooks" }));

    expect(screen.getByText("Auto checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Saves checkpoints on idle")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 enabled")).toBeInTheDocument();

    const disableBtn = screen.getByRole("button", { name: "Disable Auto checkpoint" });
    await user.click(disableBtn);

    await waitFor(() => {
      expect(disableHooks).toHaveBeenCalledWith({ agentId: "agent-1", hooks: ["checkpoint/auto"] });
    });
  });

  it("streams logs and filters by error level", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Logs" }));

    expect(screen.getByText("App started")).toBeInTheDocument();
    expect(screen.getByText("Plugin failed to load")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Error/i }));

    expect(screen.queryByText("App started")).not.toBeInTheDocument();
    expect(screen.getByText("Plugin failed to load")).toBeInTheDocument();
  });

  it("works in browse-only mode when no agents exist", async () => {
    const user = userEvent.setup();
    agentList = [];
    renderApp();

    expect(screen.getByText(/No agents/i)).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    // No On/Off buttons without an agent
    expect(screen.queryByRole("button", { name: /Enable /i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Agents" }));
    expect(screen.getByText("Agents list page")).toBeInTheDocument();
  });

  it("keeps a manually expanded package open after enabling a tool", async () => {
    const user = userEvent.setup();
    renderApp();

    // git starts collapsed (no enabled tools there); open it, then enable a tool elsewhere
    if (!screen.queryByRole("button", { name: "Enable status" })) {
      await user.click(screen.getByRole("button", { name: /git/i }));
    }
    expect(screen.getByRole("button", { name: "Enable status" })).toBeInTheDocument();

    // Enabling another package's tool used to re-run auto-expand and collapse git
    await user.click(screen.getByRole("button", { name: "Enable writeFile" }));
    await waitFor(() => {
      expect(enableTools).toHaveBeenCalledWith({ agentId: "agent-1", tools: ["filesystem/writeFile"] });
    });

    expect(screen.getByRole("button", { name: "Enable status" })).toBeInTheDocument();
  });
});
