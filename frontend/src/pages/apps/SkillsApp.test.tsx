import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const codeAgentType = {
  type: "code",
  displayName: "Code Engineer",
  description: "Writes and reviews code",
  category: "Engineering",
  enabledTools: [],
};

const runningAgent = {
  id: "agent-1",
  createdAt: 1_700_000_000_000,
  agentType: "code",
  displayName: "Code Engineer #1",
  description: "Writes and reviews code",
  idle: true,
  currentActivity: "",
};

const sampleSkills = [
  {
    name: "code-review",
    slug: "code-review",
    description: "Reviews a pull request",
    enabled: true,
    sourceUrl: "https://example.com/code-review.zip",
    userInvocable: true,
    argumentHint: "pr-url",
    context: undefined,
    agent: undefined,
  },
  {
    name: "summarize",
    slug: "summarize",
    description: "Summarizes selected text",
    enabled: false,
    sourceUrl: undefined,
    userInvocable: true,
    argumentHint: undefined,
    context: "fork",
    agent: "general-purpose",
  },
  {
    name: "internal-hook",
    slug: "internal-hook",
    description: "Internal only",
    enabled: true,
    sourceUrl: undefined,
    userInvocable: false,
    argumentHint: undefined,
    context: undefined,
    agent: undefined,
  },
];

const mutateSkills = mock(async () => undefined);
const mutateAgents = mock(async () => undefined);
const mutateEnabled = mock(async () => undefined);
const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({
  id: "agent-2",
  displayName: "New",
  description: "",
}));
const downloadSkill = mock(async (_args: { agentId: string; zipUrl: string }) => ({
  status: "success" as const,
  skill: { ...sampleSkills[0]!, name: "new-skill", slug: "new-skill", enabled: true },
}));
const enableSkill = mock(async (args: { agentId: string; name: string }) => ({
  status: "success" as const,
  skill: { ...sampleSkills.find(s => s.name === args.name)!, enabled: true },
}));
const disableSkill = mock(async (args: { agentId: string; name: string }) => ({
  status: "success" as const,
  skill: { ...sampleSkills.find(s => s.name === args.name)!, enabled: false },
}));
const deleteSkill = mock(async (_args: { agentId: string; name: string }) => ({
  status: "success" as const,
  success: true,
  message: "deleted",
}));
const resetSkill = mock(async (args: { agentId: string; name: string }) => ({
  status: "success" as const,
  skill: { ...sampleSkills.find(s => s.name === args.name)!, enabled: true },
}));
const sendInput = mock(async (_args: { agentId: string; input: { from: string; message: string } }) => ({
  status: "success" as const,
  requestId: "req-1",
}));
const getAgentTypes = mock(async () => [codeAgentType]);

let agentList: (typeof runningAgent)[] = [runningAgent];
let skillsList = [...sampleSkills];
let enabledNames = sampleSkills.filter(s => s.enabled).map(s => s.name);

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, mutate: mutateAgents }),
  useAgentTypes: () => ({ data: [codeAgentType], isLoading: false, mutate: mock() }),
  useSkills: () => ({
    data: { status: "success" as const, skills: skillsList },
    isLoading: false,
    error: undefined,
    mutate: mutateSkills,
  }),
  useEnabledSkills: () => ({
    data: { status: "success" as const, skills: enabledNames },
    isLoading: false,
    mutate: mutateEnabled,
  }),
  agentRPCClient: { createAgent, getAgentTypes, sendInput },
  skillsRPCClient: { downloadSkill, enableSkill, disableSkill, deleteSkill, resetSkill },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const successToast = mock((_msg: string, _opts?: { duration?: number }) => undefined);
const errorToast = mock((_msg: string, _opts?: { duration?: number }) => undefined);
const warningToast = mock((_msg: string, _opts?: { duration?: number }) => undefined);
void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: successToast,
    error: errorToast,
    warning: warningToast,
    info: mock(),
  },
}));

const { default: SkillsApp } = await import("./SkillsApp.tsx");

function renderApp(initialPath = "/skills") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/skills" element={<SkillsApp />} />
        <Route path="/agent/:agentId" element={<div>Agent page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SkillsApp", () => {
  beforeEach(() => {
    agentList = [runningAgent];
    skillsList = sampleSkills.map(s => ({ ...s }));
    enabledNames = sampleSkills.filter(s => s.enabled).map(s => s.name);
    mutateSkills.mockClear();
    mutateAgents.mockClear();
    mutateEnabled.mockClear();
    createAgent.mockClear();
    downloadSkill.mockClear();
    enableSkill.mockClear();
    disableSkill.mockClear();
    deleteSkill.mockClear();
    resetSkill.mockClear();
    sendInput.mockClear();
    getAgentTypes.mockClear();
    successToast.mockClear();
    errorToast.mockClear();
    warningToast.mockClear();
  });

  it("lists installed skills with counts", () => {
    renderApp();

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("3 installed")).toBeInTheDocument();
    expect(screen.getByText("2 enabled")).toBeInTheDocument();
    expect(screen.getByText("/code-review")).toBeInTheDocument();
    expect(screen.getByText("/summarize")).toBeInTheDocument();
    expect(screen.getByText("/internal-hook")).toBeInTheDocument();
    expect(screen.getByText("Reviews a pull request")).toBeInTheDocument();
  });

  it("filters skills by search query", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("Filter skills"), "summar");
    expect(screen.getByText("/summarize")).toBeInTheDocument();
    expect(screen.queryByText("/code-review")).not.toBeInTheDocument();
    expect(screen.queryByText("/internal-hook")).not.toBeInTheDocument();
  });

  it("filters skills by enabled status tab", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /Disabled/i }));
    expect(screen.getByText("/summarize")).toBeInTheDocument();
    expect(screen.queryByText("/code-review")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Enabled/i }));
    expect(screen.getByText("/code-review")).toBeInTheDocument();
    expect(screen.getByText("/internal-hook")).toBeInTheDocument();
    expect(screen.queryByText("/summarize")).not.toBeInTheDocument();
  });

  it("enables a disabled skill", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Enable summarize" }));

    await waitFor(() => expect(enableSkill).toHaveBeenCalledWith({ agentId: "agent-1", name: "summarize" }));
    expect(mutateSkills).toHaveBeenCalled();
  });

  it("disables an enabled skill", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Disable code-review" }));

    await waitFor(() => expect(disableSkill).toHaveBeenCalledWith({ agentId: "agent-1", name: "code-review" }));
  });

  it("downloads a skill from a zip URL", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("Skill zip URL"), "https://example.com/new-skill.zip");
    await user.click(screen.getByRole("button", { name: /Download/i }));

    await waitFor(() => expect(downloadSkill).toHaveBeenCalledWith({ agentId: "agent-1", zipUrl: "https://example.com/new-skill.zip" }));
    expect(successToast).toHaveBeenCalled();
  });

  it("deletes a skill after confirmation", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Delete summarize" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Permanently remove/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSkill).toHaveBeenCalledWith({ agentId: "agent-1", name: "summarize" }));
  });

  it("resets a skill that has a source URL", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Reset code-review" }));

    await waitFor(() => expect(resetSkill).toHaveBeenCalledWith({ agentId: "agent-1", name: "code-review" }));
  });

  it("tries a skill: enables if needed, sends /command, navigates to agent", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Try summarize" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Try /summarize")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Arguments/), "focus on risks");
    await user.click(within(dialog).getByRole("button", { name: "Run skill" }));

    await waitFor(() => expect(enableSkill).toHaveBeenCalledWith({ agentId: "agent-1", name: "summarize" }));
    await waitFor(() =>
      expect(sendInput).toHaveBeenCalledWith({
        agentId: "agent-1",
        input: { from: "Skills dashboard", message: "/summarize focus on risks" },
      }),
    );
    expect(screen.getByText("Agent page")).toBeInTheDocument();
  });

  it("creates an agent when none exist and installing", async () => {
    const user = userEvent.setup();
    agentList = [];
    renderApp();

    expect(screen.getByRole("button", { name: "Create agent" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Skill zip URL"), "https://example.com/skill.zip");
    await user.click(screen.getByRole("button", { name: /Download/i }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "code", headless: false }));
    await waitFor(() => expect(downloadSkill).toHaveBeenCalledWith({ agentId: "agent-2", zipUrl: "https://example.com/skill.zip" }));
  });

  it("hides try for non-user-invocable skills", () => {
    renderApp();
    expect(screen.queryByRole("button", { name: "Try internal-hook" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try code-review" })).toBeInTheDocument();
  });
});
