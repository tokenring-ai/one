import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import type { ViewDefinition } from "../../layout/define.ts";

const toolsData = {
  tools: {
    "filesystem/readFile": { displayName: "filesystem/readFile", description: "Read a file from the workspace" },
    "filesystem/writeFile": { displayName: "filesystem/writeFile", description: "Write a file to the workspace" },
    "git/status": { displayName: "git/status", description: "" },
  },
};

const modelsData = {
  modelsByProvider: {
    openai: {
      "openai/gpt-4o": {
        status: "online" as const,
        available: true,
        modelSpec: { modelId: "gpt-4o", providerDisplayName: "openai" },
      },
      "openai/gpt-4o-mini": {
        status: "online" as const,
        available: true,
        modelSpec: { modelId: "gpt-4o-mini", providerDisplayName: "openai" },
      },
    },
    anthropic: {
      "anthropic/claude-sonnet": {
        status: "offline" as const,
        available: false,
        modelSpec: { modelId: "claude-sonnet", providerDisplayName: "anthropic" },
      },
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
const setModel = mock(async (args: { agentId: string; model: string }) => {
  currentModel = args.model;
  return { status: "success" as const, success: true };
});
const setToolApproval = mock(async (args: { agentId: string; autoToolApprovalLevel?: number; toolApprovalMode?: "ask" | "reject" | "auto" }) => {
  approval = { ...approval, ...(args.autoToolApprovalLevel !== undefined ? { autoToolApprovalLevel: args.autoToolApprovalLevel } : {}) };
  if (args.toolApprovalMode) approval = { ...approval, toolApprovalMode: args.toolApprovalMode };
  return { status: "success" as const, ...approval };
});
const mutateModel = mock(async () => undefined);
const mutateApproval = mock(async () => undefined);
let currentModel: string | null = "openai/gpt-4o";
let approval: { autoToolApprovalLevel: number; toolApprovalMode: "ask" | "reject" | "auto" } = { autoToolApprovalLevel: 2, toolApprovalMode: "ask" };
const mutateTools = mock(async () => undefined);
const mutateEnabledTools = mock(async () => undefined);
const mutateHooks = mock(async () => undefined);
const mutateEnabledHooks = mock(async () => undefined);
const mutateModels = mock(async () => undefined);
const mutateAgents = mock(async () => undefined);
const mutateToolDefinitions = mock(async () => undefined);
const mutateToolDefinition = mock(async () => undefined);

const subAgent = {
  forwardChatOutput: false,
  forwardStatusMessages: true,
  forwardSystemOutput: false,
  forwardHumanRequests: true,
  forwardReasoning: false,
  forwardInputCommands: true,
  timeout: 0,
  maxResponseLength: 10000,
  minContextLength: 1000,
};

type ToolDefinitionRecord = {
  name: string;
  displayName: string;
  description: string;
  category: string;
  agentType: string;
  inputArguments: Record<string, { description: string; defaultValue?: string }>;
  steps: string[];
  updatedAt: string;
  subAgent: typeof subAgent;
};

let toolDefinitions: ToolDefinitionRecord[] = [];
const emptyKindModels = {
  modelsByProvider: {} as Record<
    string,
    Record<
      string,
      {
        status: "offline" | "online";
        available: boolean;
        modelSpec: { modelId: string; providerDisplayName: string };
      }
    >
  >,
};
let embeddingModels: typeof emptyKindModels = emptyKindModels;
let transcriptionModels: typeof emptyKindModels = emptyKindModels;
let rerankingModels: typeof emptyKindModels = emptyKindModels;

const createToolDefinition = mock(async (args: { name: string; tool: Omit<ToolDefinitionRecord, "name" | "updatedAt"> }) => {
  const tool: ToolDefinitionRecord = { ...args.tool, name: args.name, updatedAt: "2026-01-02T00:00:00.000Z", subAgent: args.tool.subAgent ?? subAgent };
  toolDefinitions = [...toolDefinitions, tool];
  return { tool };
});
const updateToolDefinition = mock(async (args: { name: string; tool: Omit<ToolDefinitionRecord, "name" | "updatedAt"> }) => {
  toolDefinitions = toolDefinitions.map(tool => (tool.name === args.name ? { ...tool, ...args.tool, name: args.name } : tool));
  return { tool: toolDefinitions.find(tool => tool.name === args.name)! };
});
const deleteToolDefinition = mock(async (args: { name: string }) => {
  const existed = toolDefinitions.some(tool => tool.name === args.name);
  toolDefinitions = toolDefinitions.filter(tool => tool.name !== args.name);
  return { success: existed };
});

let enabledToolList: string[] = [];
let enabledHookList: string[] = [];
let agentList: (typeof agent)[] | undefined = [agent];
let enabledToolsLoading = false;
let enabledToolsError: Error | undefined;
let enabledHooksError: Error | undefined;
let toolsRecord: typeof toolsData = toolsData;

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, mutate: mutateAgents }),
  useAvailableTools: () => ({ data: toolsRecord, isLoading: false, error: undefined, mutate: mutateTools }),
  useEnabledTools: () => ({
    data: enabledToolsLoading || enabledToolsError ? undefined : { status: "success" as const, tools: enabledToolList },
    isLoading: enabledToolsLoading,
    error: enabledToolsError,
    mutate: mutateEnabledTools,
  }),
  useChatModelsByProvider: () => ({ data: modelsData, isLoading: false, error: undefined, mutate: mutateModels }),
  useEmbeddingModelsByProvider: () => ({ data: embeddingModels, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useTranscriptionModelsByProvider: () => ({ data: transcriptionModels, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useRerankingModelsByProvider: () => ({ data: rerankingModels, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useToolDirectory: () => ({ data: { directory: "/workspace/.tokenring/tools" }, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useToolDefinitions: () => ({ data: toolDefinitions, isLoading: false, error: undefined, mutate: mutateToolDefinitions }),
  useToolDefinition: (name: string | null) => {
    const tool = name ? toolDefinitions.find(item => item.name === name) : undefined;
    return {
      data: !name ? undefined : tool ? { status: "success" as const, tool } : { status: "toolNotFound" as const },
      isLoading: false,
      error: undefined,
      mutate: mutateToolDefinition,
    };
  },
  useAvailableHooks: () => ({ data: hooksData, isLoading: false, error: undefined, mutate: mutateHooks }),
  useEnabledHooks: () => ({
    data: enabledHooksError ? undefined : { status: "success" as const, hooks: enabledHookList },
    isLoading: false,
    error: enabledHooksError,
    mutate: mutateEnabledHooks,
  }),
  useModel: () => ({
    data: { status: "success" as const, model: currentModel, modelSpec: {} },
    isLoading: false,
    error: undefined,
    mutate: mutateModel,
  }),
  useToolApproval: () => ({ data: { status: "success" as const, ...approval }, isLoading: false, error: undefined, mutate: mutateApproval }),
  useToolApprovalLevels: () => ({
    data: {
      levels: [
        { level: 1, description: "Completely harmless" },
        { level: 2, description: "Minimal risk" },
        { level: 3, description: "Low risk" },
      ],
    },
    isLoading: false,
    error: undefined,
    mutate: mock(),
  }),
  chatRPCClient: { enableTools, disableTools, setModel, setToolApproval, createToolDefinition, updateToolDefinition, deleteToolDefinition },
  lifecycleRPCClient: { enableHooks, disableHooks },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
    info: mock(),
  },
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { SERVICES_VIEWS } = await import("./views.ts");
const { SERVICES_APP } = await import("./manifest.ts");
const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { defineView } = await import("../../layout/define.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const [servicesToolsView, servicesModelsView, servicesHooksView] = SERVICES_VIEWS as [ViewDefinition, ViewDefinition, ViewDefinition];
const { resetServicesAgentId, setServicesAgentId } = await import("../../features/services/servicesStore.ts");
const { useServicesAgent } = await import("../../features/services/useServicesAgent.ts");

const renderTools = () => renderLayoutView(servicesToolsView);
const renderModels = () => renderLayoutView(servicesModelsView);
const renderHooks = () => renderLayoutView(servicesHooksView);

describe("Services views", () => {
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
    enabledToolList = ["filesystem/readFile"];
    enabledHookList = ["checkpoint/auto"];
    agentList = [agent];
    enabledToolsLoading = false;
    enabledToolsError = undefined;
    enabledHooksError = undefined;
    toolsRecord = toolsData;
    currentModel = "openai/gpt-4o";
    approval = { autoToolApprovalLevel: 2, toolApprovalMode: "ask" };
    setModel.mockClear();
    setToolApproval.mockClear();
    createToolDefinition.mockClear();
    updateToolDefinition.mockClear();
    deleteToolDefinition.mockClear();
    mutateToolDefinitions.mockClear();
    toolDefinitions = [];
    embeddingModels = { modelsByProvider: {} };
    transcriptionModels = { modelsByProvider: {} };
    rerankingModels = { modelsByProvider: {} };
    resetServicesAgentId();
  });

  it("shows and changes the selected agent's model", async () => {
    const user = userEvent.setup();
    renderModels();

    const select = screen.getByLabelText("Agent model") as HTMLSelectElement;
    expect(select.value).toBe("openai/gpt-4o");
    // An unreachable model is listed but cannot be picked.
    expect((screen.getByRole("option", { name: "anthropic/claude-sonnet (unavailable)" }) as HTMLOptionElement).disabled).toBe(true);

    await user.selectOptions(select, "openai/gpt-4o-mini");
    await waitFor(() => expect(setModel).toHaveBeenCalledWith({ agentId: "agent-1", model: "openai/gpt-4o-mini" }));
    expect(mutateModel).toHaveBeenCalled();
  });

  it("hides the model picker without an agent", () => {
    agentList = [];
    renderModels();
    expect(screen.queryByLabelText("Agent model")).not.toBeInTheDocument();
  });

  it("shows and changes the agent's tool approval level and mode", async () => {
    const user = userEvent.setup();
    renderTools();

    const level = screen.getByLabelText("Go ahead without asking up to safety level") as HTMLSelectElement;
    expect(level.value).toBe("2");
    await user.selectOptions(level, "3");
    await waitFor(() => expect(setToolApproval).toHaveBeenCalledWith({ agentId: "agent-1", autoToolApprovalLevel: 3 }));

    await user.selectOptions(screen.getByLabelText("Above that level, do this"), "reject");
    await waitFor(() => expect(setToolApproval).toHaveBeenCalledWith({ agentId: "agent-1", toolApprovalMode: "reject" }));
    expect(mutateApproval).toHaveBeenCalled();
  });

  it("shows tool descriptions and searches them", async () => {
    const user = userEvent.setup();
    renderTools();

    expect(screen.getByText("Read a file from the workspace")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Filter tools"), "write a file");
    expect(screen.getByText("Write a file to the workspace")).toBeInTheDocument();
    expect(screen.queryByText("Read a file from the workspace")).not.toBeInTheDocument();
  });

  it("filters to the agent's enabled tools", async () => {
    const user = userEvent.setup();
    renderTools();

    const pill = screen.getByRole("button", { name: /Enabled only/ });
    expect(pill).toHaveAttribute("aria-pressed", "false");
    await user.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("readFile")).toBeInTheDocument();
    expect(screen.queryByText("writeFile")).not.toBeInTheDocument();
    expect(screen.queryByText("git")).not.toBeInTheDocument();
  });

  it("disables the enabled-only filter without an agent", () => {
    agentList = [];
    renderTools();
    expect(screen.getByRole("button", { name: /Enabled only/ })).toBeDisabled();
  });

  it("shows tool toggles as loading until the agent's enable state arrives", () => {
    enabledToolsLoading = true;
    renderTools();

    // Nothing is claimed off while the stream is still connecting.
    expect(screen.getAllByRole("button", { name: /^(Enable|Disable) / }).length).toBeGreaterThan(0);
    for (const button of screen.getAllByRole("button", { name: /^(Enable|Disable) / })) expect(button).toBeDisabled();
  });

  it("surfaces an enabled-tools failure with a retry and locks the toggles", async () => {
    const user = userEvent.setup();
    enabledToolsError = new Error("stream broke");
    renderTools();

    expect(screen.getByText("Could not load which tools are enabled")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /^(Enable|Disable) / })) expect(button).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutateEnabledTools).toHaveBeenCalled();
  });

  it("surfaces an enabled-hooks failure with a retry", async () => {
    const user = userEvent.setup();
    enabledHooksError = new Error("stream broke");
    renderHooks();

    expect(screen.getByText("Could not load which hooks are enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Auto checkpoint/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutateEnabledHooks).toHaveBeenCalled();
  });

  it("asks before disabling a whole package of tools", async () => {
    const user = userEvent.setup();
    enabledToolList = ["filesystem/readFile", "filesystem/writeFile"];
    renderTools();

    await user.click(screen.getByRole("button", { name: "Disable all" }));
    expect(await screen.findByText("Disable 2 tools?")).toBeInTheDocument();
    expect(disableTools).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Disable all" }).at(-1)!);
    await waitFor(() => expect(disableTools).toHaveBeenCalledWith({ agentId: "agent-1", tools: ["filesystem/readFile", "filesystem/writeFile"] }));
  });

  it("asks before disabling every hook", async () => {
    const user = userEvent.setup();
    enabledHookList = ["checkpoint/auto", "memory/summarize"];
    renderHooks();

    await user.click(screen.getByRole("button", { name: "Disable all" }));
    expect(await screen.findByText("Disable 2 hooks?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(disableHooks).not.toHaveBeenCalled();
  });

  it("points an empty tool catalog at Configuration and Agents", async () => {
    const user = userEvent.setup();
    toolsRecord = { tools: {} } as unknown as typeof toolsData;
    const app = renderTools();

    expect(screen.getByText("No tools available")).toBeInTheDocument();
    expect(screen.getByText(/Tools are actions agents can call/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Agents" })).toHaveAttribute("href", "/agents");
    await user.click(screen.getByRole("link", { name: "Open Configuration" }));
    expect(app.location().pathname).toBe("/configuration");
  });

  it("shows tools grouped by package with enable state for the selected agent", async () => {
    renderTools();

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
    renderTools();

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
    renderTools();

    const search = screen.getByLabelText("Filter tools");
    await user.type(search, "git");

    expect(screen.getByText("git")).toBeInTheDocument();
    expect(screen.queryByText("filesystem")).not.toBeInTheDocument();
  });

  it("shows models with availability filters", async () => {
    const user = userEvent.setup();
    renderModels();

    expect(screen.getByText("openai")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("anthropic")).toBeInTheDocument();
    expect(screen.getAllByText("online")).toHaveLength(2);
    expect(screen.getByText("offline")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Available/ }));
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(screen.queryByText("anthropic")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Unavailable/ }));
    expect(screen.queryByText("gpt-4o")).not.toBeInTheDocument();
    expect(screen.getByText("claude-sonnet")).toBeInTheDocument();
  });

  it("lists hooks and can disable an enabled hook", async () => {
    const user = userEvent.setup();
    renderHooks();

    expect(screen.getByText("Auto checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Saves checkpoints on idle")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 enabled")).toBeInTheDocument();

    const disableBtn = screen.getByRole("button", { name: "Disable Auto checkpoint" });
    await user.click(disableBtn);

    await waitFor(() => {
      expect(disableHooks).toHaveBeenCalledWith({ agentId: "agent-1", hooks: ["checkpoint/auto"] });
    });
  });

  it("works in browse-only mode when no agents exist", async () => {
    const user = userEvent.setup();
    agentList = [];
    const app = renderTools();

    expect(screen.getByText(/No agents/i)).toBeInTheDocument();
    expect(screen.getByText("filesystem")).toBeInTheDocument();
    // No On/Off buttons without an agent, but a pointer to why
    expect(screen.queryByRole("button", { name: /Enable /i })).not.toBeInTheDocument();
    expect(screen.getByText("Select an agent above to turn tools on or off.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Agents" }));
    expect(app.location().pathname).toBe("/agents");
  });

  it("keeps a manually expanded package open after enabling a tool", async () => {
    const user = userEvent.setup();
    renderTools();

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
  it("keeps the agent selection while the agent list is loading or resetting", () => {
    const second = { ...agent, id: "agent-2", displayName: "Code Engineer #2" };
    agentList = [agent, second];
    setServicesAgentId("agent-2");
    // A stream reset: the list is unknown, not empty.
    agentList = undefined;
    const { result, rerender } = renderHook(() => useServicesAgent());
    expect(result.current.selectedAgentId).toBe("agent-2");
    agentList = [agent, second];
    rerender();
    // Not cleared and then jumped to the first agent.
    expect(result.current.selectedAgentId).toBe("agent-2");
    // A genuinely empty list still clears it.
    agentList = [];
    rerender();
    expect(result.current.selectedAgentId).toBeNull();
  });

  it("lists embedding, transcription, and reranking models", () => {
    embeddingModels = {
      modelsByProvider: {
        voyage: {
          "voyage/embed-1": { status: "online", available: true, modelSpec: { modelId: "embed-1", providerDisplayName: "voyage" } },
        },
      },
    };
    transcriptionModels = {
      modelsByProvider: {
        openai: {
          "openai/whisper-1": { status: "online", available: true, modelSpec: { modelId: "whisper-1", providerDisplayName: "openai" } },
        },
      },
    };
    rerankingModels = {
      modelsByProvider: {
        cohere: {
          "cohere/rerank-v3": { status: "offline", available: false, modelSpec: { modelId: "rerank-v3", providerDisplayName: "cohere" } },
        },
      },
    };
    renderModels();

    expect(screen.getByRole("region", { name: "Embedding models" })).toHaveTextContent("embed-1");
    expect(screen.getByRole("region", { name: "Transcription models" })).toHaveTextContent("whisper-1");
    expect(screen.getByRole("region", { name: "Reranking models" })).toHaveTextContent("rerank-v3");
    expect(screen.queryByText("No embedding models.")).not.toBeInTheDocument();
  });

  it("creates, updates, and deletes a tool definition", async () => {
    const user = userEvent.setup();
    toolDefinitions = [
      {
        name: "review_code",
        displayName: "Review Code",
        description: "Reviews a diff",
        category: "Review",
        agentType: "code-reviewer",
        inputArguments: { diff: { description: "The diff" } },
        steps: ["Review {{ diff }}"],
        updatedAt: "2026-01-01T00:00:00.000Z",
        subAgent,
      },
    ];
    renderTools();

    expect(screen.getByText("/workspace/.tokenring/tools")).toBeInTheDocument();
    expect(screen.getByText("Reviews a diff")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New tool" }));
    await user.type(screen.getByLabelText("Name"), "lint_file");
    await user.type(screen.getByLabelText("Display name"), "Lint a file");
    await user.type(screen.getByLabelText("Description"), "Lints one file");
    await user.type(screen.getByLabelText("Agent type"), "code");
    await user.type(screen.getByLabelText("Step 1"), "Lint the file");
    await user.click(screen.getByRole("button", { name: "Save tool" }));

    await waitFor(() =>
      expect(createToolDefinition).toHaveBeenCalledWith({
        name: "lint_file",
        tool: {
          agentType: "code",
          displayName: "Lint a file",
          description: "Lints one file",
          category: "User-Created Tools",
          inputArguments: {},
          steps: ["Lint the file"],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /Review Code/ }));
    const displayName = screen.getByLabelText("Display name");
    await user.clear(displayName);
    await user.type(displayName, "Review carefully");
    await user.click(screen.getByRole("button", { name: "Save tool" }));

    await waitFor(() =>
      expect(updateToolDefinition).toHaveBeenCalledWith({
        name: "review_code",
        tool: expect.objectContaining({
          displayName: "Review carefully",
          agentType: "code-reviewer",
          description: "Reviews a diff",
          category: "Review",
          steps: ["Review {{ diff }}"],
          inputArguments: { diff: { description: "The diff" } },
          subAgent,
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Delete tool" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteToolDefinition).toHaveBeenCalledWith({ name: "review_code" }));
  });

  it("opens Tools, Models and Hooks at /services with the Logs tab beside Hooks", () => {
    const logs = defineView({ id: "app-logs", kind: "widget", title: "Logs", icon: SERVICES_VIEWS[0]!.icon, component: () => <p>log stub</p> });
    const registry = createLayoutRegistry({ apps: [SERVICES_APP], views: [...SERVICES_VIEWS, logs], kinds: [...CORE_KINDS] });
    const app = renderLayoutApp({ registry, url: "/services" });
    expect(app.location().pathname).toBe("/services");
    expect(screen.getByLabelText("Agent model")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter tools")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Hooks/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Logs/ })).toBeInTheDocument();
  });
});
