import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The AI edit panel against a fake agent catalog. Only the `writer` type may
 * back AI editing; when it is missing the panel explains how to get one rather
 * than quietly starting some other agent.
 */

let agentTypes: Array<{ type: string }> = [];
const createAgent = mock(async (_args: { agentType: string; answerTimeoutSeconds?: number | null }) => ({ id: "agent-1" }));
const sendInput = mock(async () => ({ status: "success" as const, requestId: "req-1" }));
const abortCurrentOperation = mock(async (_args: { agentId: string; message: string }) => ({ status: "success" as const }));
const cancelInput = mock(async (_args: { agentId: string; requestId: string }) => ({ status: "success" as const }));
const toastError = mock();
let streamSignal: AbortSignal | null = null;
let resolveStreamStarted: (() => void) | null = null;

const actualRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...actualRpc,
  useFilesystemProviders: () => ({ data: { providers: ["local"] }, isLoading: false }),
  filesystemRPCClient: {},
  // The writer agent's chat opens beside the document.
  useAgentList: () => ({
    data: [{ id: "agent-1", displayName: "Writer", agentType: "writer", idle: true, currentActivity: "", createdAt: 1 }],
    isLoading: false,
    error: undefined,
    mutate: async () => undefined,
  }),
  useAgentCheckpointList: () => ({ data: undefined, isLoading: false, error: undefined, mutate: async () => undefined }),
  chatRPCClient: {},
  checkpointRPCClient: {},
  agentRPCClient: {
    getAgentTypes: async () => agentTypes,
    createAgent,
    deleteAgent: async () => ({ status: "success" }),
    getAgentEvents: async () => ({ status: "success", position: 0 }),
    sendInput,
    abortCurrentOperation,
    cancelInput,
    // oxlint-disable-next-line require-yield -- the stream only ever waits, then aborts
    streamAgentEvents: async function* (_args: { agentId: string }, signal?: AbortSignal) {
      streamSignal = signal ?? null;
      await new Promise<void>((_resolve, reject) => {
        const abort = () => reject(new DOMException("The operation was aborted", "AbortError"));
        if (!signal) return;
        if (signal.aborted) {
          abort();
          return;
        }
        signal.addEventListener("abort", abort, { once: true });
        resolveStreamStarted?.();
      });
    },
  },
}));

const actualToast = await import("../../components/ui/toast.tsx");
void mock.module("../../components/ui/toast.tsx", () => ({
  ...actualToast,
  toastManager: { success: mock(), error: toastError, warning: mock(), info: mock() },
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div data-testid={`chat-panel:${agentId}`} />,
}));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { DOCUMENTS_APP } = await import("./manifest.ts");
const { DOCUMENTS_KINDS } = await import("./kinds.ts");
const { DOCUMENTS_VIEWS } = await import("./views.ts");
const { resetDocumentsStore, setAiPrompt, setSelection } = await import("../../features/documents/documentsStore.ts");

const registry = createLayoutRegistry({ apps: [DOCUMENTS_APP], views: [...DOCUMENTS_VIEWS, ...CHAT_VIEWS], kinds: [...CORE_KINDS, ...DOCUMENTS_KINDS] });
const renderAiPanel = () => renderLayoutApp({ registry, url: "/documents/ai" });

describe("Document AI edit view", () => {
  beforeEach(() => {
    createAgent.mockClear();
    sendInput.mockClear();
    abortCurrentOperation.mockClear();
    cancelInput.mockClear();
    toastError.mockClear();
    streamSignal = null;
    resolveStreamStarted = null;
    resetDocumentsStore();
  });

  it("explains a missing writer type with links instead of starting another agent", async () => {
    agentTypes = [{ type: "coding" }];
    renderAiPanel();
    expect(await screen.findByText(/AI editing needs a “writer” agent type/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New agent/ })).toHaveAttribute("href", "/agents/new");
    expect(screen.getByRole("link", { name: /Browse marketplace/ })).toHaveAttribute("href", "/marketplace/agent");
    expect(createAgent).not.toHaveBeenCalled();
    // One explanation, not a banner plus the panel's own copy.
    expect(screen.getAllByText("AI editing unavailable")).toHaveLength(1);
    expect(screen.queryByText(/No "writer" agent type is configured/)).toBeNull();
  });

  it("starts a writer agent when one is configured", async () => {
    agentTypes = [{ type: "coding" }, { type: "writer" }];
    renderAiPanel();
    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "writer", answerTimeoutSeconds: 0 }));
    expect(await screen.findByText("Select text to edit with AI")).toBeInTheDocument();
    // The background writer agent works behind the panel; no chat is opened for it (as before the port).
    expect(screen.queryByTestId("chat-panel:agent-1")).toBeNull();
  });

  it("stops the writer agent when an edit is cancelled", async () => {
    agentTypes = [{ type: "writer" }];
    const started = new Promise<void>(resolve => {
      resolveStreamStarted = resolve;
    });
    renderAiPanel();
    expect(await screen.findByText("Select text to edit with AI")).toBeInTheDocument();
    act(() => {
      setSelection({ start: 0, end: 5, text: "hello" });
      setAiPrompt("tighten");
    });
    // The editor footer offers "Ask AI" too; the AI panel's own button comes last in the DOM.
    await userEvent.click((await screen.findAllByRole("button", { name: /^Ask AI$/i })).at(-1)!);
    await started;
    await userEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(cancelInput).toHaveBeenCalledWith({ agentId: "agent-1", requestId: "req-1" });
      expect(abortCurrentOperation).toHaveBeenCalledWith({ agentId: "agent-1", message: "User cancelled the document AI edit" });
    });
    expect(streamSignal?.aborted).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });
});
