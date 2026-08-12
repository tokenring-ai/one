import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const flows = [
  { name: "onboarding", designCount: 2, updatedAt: "2026-07-01T12:00:00.000Z" },
  { name: "checkout", designCount: 0, updatedAt: "2026-07-01T11:00:00.000Z" },
];

const onboardingDesigns = [
  {
    flowName: "onboarding",
    name: "index.html",
    size: 420,
    updatedAt: "2026-07-01T12:00:00.000Z",
    encoding: "utf8" as const,
    mimeType: "text/html",
  },
  {
    flowName: "onboarding",
    name: "welcome.html",
    size: 180,
    updatedAt: "2026-07-01T12:01:00.000Z",
    encoding: "utf8" as const,
    mimeType: "text/html",
  },
];

const indexDesign = {
  flowName: "onboarding",
  name: "index.html",
  content: "<!DOCTYPE html><html><body><h1>Index</h1></body></html>",
  size: 420,
  updatedAt: "2026-07-01T12:00:00.000Z",
  encoding: "utf8" as const,
  mimeType: "text/html",
};

const welcomeDesign = {
  flowName: "onboarding",
  name: "welcome.html",
  content: "<!DOCTYPE html><html><body><h1>Welcome</h1></body></html>",
  size: 180,
  updatedAt: "2026-07-01T12:01:00.000Z",
  encoding: "utf8" as const,
  mimeType: "text/html",
};

let flowsState = [...flows];
let designsByFlow: Record<string, typeof onboardingDesigns> = {
  onboarding: [...onboardingDesigns],
  checkout: [],
};
let getDesignResult: typeof indexDesign | null = indexDesign;

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({
  id: "web-design-agent-1",
  displayName: "Designer",
  description: "",
}));
const sendInput = mock(async () => ({ status: "success" as const, requestId: "req-1" }));
const deleteAgent = mock(async () => ({ status: "success" as const }));
const getDesign = mock(async (args: { flowName: string; name: string }) => {
  if (args.name === "welcome.html") return { design: welcomeDesign };
  return { design: getDesignResult };
});
const updateDesign = mock(async (args: { flowName: string; name: string; content: string }) => ({
  design: { ...indexDesign, content: args.content, updatedAt: new Date().toISOString() },
}));
const createDesign = mock(async () => ({ design: indexDesign }));
const deleteDesign = mock(async () => ({ success: true }));
const createFlow = mock(async () => ({ flow: flows[0] }));
const deleteFlow = mock(async () => ({ success: true }));
const updateWebDesignState = mock(async () => ({
  status: "success" as const,
  selectedFlowName: null,
  selectedDesignName: null,
}));
const mutateFlows = mock(async () => undefined);

void mock.module("../../rpc.ts", () => ({
  useFlows: () => ({ data: { flows: flowsState }, isLoading: false, error: undefined, mutate: mutateFlows }),
  useDesigns: (flowName: string | null) => ({
    data: flowName ? { designs: designsByFlow[flowName] ?? [] } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useWebDesignConfiguration: () => ({
    data: { agentTypes: ["web-design"] },
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useAgentList: () => ({ data: [], isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useAgentTypes: () => ({
    data: [{ type: "web-design", displayName: "Designer", description: "Web design", category: "Design", enabledTools: [] }],
    isLoading: false,
  }),
  agentRPCClient: { createAgent, sendInput, deleteAgent },
  webDesignRPCClient: {
    getWebDesignConfiguration: mock(async () => ({ agentTypes: ["web-design"] })),
    getDesign,
    updateDesign,
    createDesign,
    deleteDesign,
    createFlow,
    deleteFlow,
    updateWebDesignState,
  },
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div>Chat with {agentId}</div>,
}));

void mock.module("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string | undefined) => void }) => (
    <textarea aria-label="HTML editor" value={value} onChange={e => onChange?.(e.target.value)} />
  ),
}));

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => ["dark", mock()] as const,
}));

void mock.module("../../lib/sanitizeHtml.ts", () => ({
  sanitizeDesignHtml: (html: string) => html,
}));

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: WebDesignApp } = await import("./WebDesignApp.tsx");

function renderApp(initialPath = "/web-design") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/web-design/:flowName?/:designName?" element={<WebDesignApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WebDesignApp", () => {
  beforeEach(() => {
    flowsState = [...flows];
    designsByFlow = {
      onboarding: [...onboardingDesigns],
      checkout: [],
    };
    getDesignResult = { ...indexDesign };
    createAgent.mockClear();
    sendInput.mockClear();
    getDesign.mockClear();
    updateDesign.mockClear();
    createDesign.mockClear();
    deleteDesign.mockClear();
    createFlow.mockClear();
    deleteFlow.mockClear();
    updateWebDesignState.mockClear();
    mutateFlows.mockClear();
  });

  it("opens a design in the editor", async () => {
    renderApp("/web-design/onboarding/index.html");

    await waitFor(() => expect(getDesign).toHaveBeenCalledWith({ flowName: "onboarding", name: "index.html" }));
    const editor = await screen.findByLabelText("HTML editor");
    expect(editor).toHaveValue(indexDesign.content);
  });

  it("prompts before discarding unsaved edits when opening another design", async () => {
    const user = userEvent.setup();
    renderApp("/web-design/onboarding/index.html");

    const editor = await screen.findByLabelText("HTML editor");
    await user.clear(editor);
    await user.type(editor, "<html><body>Unsaved draft</body></html>");

    // Selected flow is auto-expanded from the route, so welcome.html is listed
    await user.click(await screen.findByText("welcome.html"));

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(getDesign).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(getDesign).toHaveBeenCalledWith({ flowName: "onboarding", name: "welcome.html" }));
  });

  it("prompts before discarding unsaved edits when creating a new file", async () => {
    const user = userEvent.setup();
    renderApp("/web-design/onboarding/index.html");

    const editor = await screen.findByLabelText("HTML editor");
    await user.clear(editor);
    await user.type(editor, "<html><body>Unsaved draft</body></html>");

    await user.click(screen.getByTitle("New file"));

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(screen.queryByText("Save File")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Save File" })).toBeInTheDocument();
    });
  });
});
