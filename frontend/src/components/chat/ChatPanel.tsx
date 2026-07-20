import type { ChatAttachment } from "@tokenring-ai/agent/AgentEvents";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentEventState } from "../../hooks/useAgentEventState.ts";
import { agentRPCClient, useAvailableCommands, useCommandHistory } from "../../rpc.ts";
import { useChatInput } from "../ChatInputContext.tsx";
import FileBrowserOverlay from "../overlay/file-browser.tsx";
import { toastManager } from "../ui/toast.tsx";
import AutoScrollContainer from "./AutoScrollContainer.tsx";
import ChatFooter from "./ChatFooter.tsx";
import ConnectionStatusBanner from "./ConnectionStatusBanner.tsx";
import DeletedAgentRestorePanel from "./DeletedAgentRestorePanel.tsx";
import MessageList from "./MessageList.tsx";
import PendingQuestions from "./PendingQuestions.tsx";

interface ChatPanelProps {
  agentId: string;
}

export default function ChatPanel({ agentId }: ChatPanelProps) {
  const { getInput, setInput: setPersistedInput, clearInput } = useChatInput();
  const [input, setInputState] = useState(() => getInput(agentId));
  const [showHistory, setShowHistory] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [inputError, setInputError] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const setInput = (value: string) => {
    setInputState(value);
    setPersistedInput(agentId, value);
  };

  const { messages, agentStatus, currentExecutionState, isConnecting, connectionError, reconnectAttempts, agentNotFound, manualReconnect } =
    useAgentEventState(agentId);
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);

  const idle = agentStatus.status === "running" && agentStatus.inputExecutionQueue.length === 0;

  const commandHistory = useCommandHistory(agentId);
  const availableCommands = useAvailableCommands(agentId);

  const filteredAvailableCommands = useMemo(() => {
    let ret: string[] = [];
    if (input.startsWith("/") && availableCommands.data) {
      ret = availableCommands.data
        .filter(cmd => cmd.name.toLowerCase().startsWith(input.slice(1).toLowerCase()))
        .map(cmd => cmd.name)
        .sort();
      if (ret.length === 0) {
        ret = ["help"];
      } else if (ret.length < 4) {
        ret.push(...ret.map(cmd => `help ${cmd}`));
      }
    }
    return ret;
  }, [availableCommands.data, input]);

  const handleSubmit = async (attachments?: ChatAttachment[]) => {
    const hasAttachments = attachments !== undefined && attachments.length > 0;
    const message = input.trim();
    if (!message && !hasAttachments) {
      setInputError(true);
      setTimeout(() => setInputError(false), 1000);
      return;
    }
    if (!idle) return;
    const previousInput = input;
    setInput("");
    clearInput(agentId);
    setInputError(false);
    try {
      await agentRPCClient.sendInput({
        agentId,
        input: {
          from: "Chat webapp user",
          message,
          ...(hasAttachments && { attachments }),
        },
      });
      if (message) {
        const newHistory = [...(commandHistory.data || []), message].slice(-50);
        await commandHistory.mutate(newHistory);
      }
      if (hasAttachments) {
        setSubmitFeedback({ message: `Sent ${attachments.length} attachment(s)`, type: "success" });
        setTimeout(() => setSubmitFeedback(null), 2000);
      }
    } catch (error) {
      setInput(previousInput);
      toastManager.error(formatError(error), { duration: 5000 });
      setSubmitFeedback({ message: "Failed to send", type: "error" });
      setTimeout(() => setSubmitFeedback(null), 2000);
    }
  };

  if (agentNotFound) {
    return (
      <div className="h-full flex flex-col">
        <DeletedAgentRestorePanel agentId={agentId} />

        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="mb-6 max-w-md">
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4 shadow-card">
              <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Agent not found</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-primary mb-2">Agent No Longer Running</h1>
            <p className="text-sm text-muted">
              The agent <code className="px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-primary font-mono text-xs">{agentId}</code> could not
              be found. It may have been stopped or removed.
              <br />
              If checkpoints are available, you can restore it using the controls above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNavigating(true);
              void navigate("/agents");
            }}
            disabled={isNavigating}
            className="px-5 py-2.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-primary rounded-button transition-colors focus-ring font-medium flex items-center gap-2 shadow-button-primary"
            aria-busy={isNavigating}
          >
            {isNavigating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Navigating...</span>
              </>
            ) : (
              <span>Browse Available Agents</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ConnectionStatusBanner
        isConnecting={isConnecting}
        connectionError={connectionError}
        reconnectAttempts={reconnectAttempts}
        onReconnect={manualReconnect}
      />

      <FileBrowserOverlay agentId={agentId} isOpen={showFileBrowser} onClose={() => setShowFileBrowser(false)} />

      <div className="flex flex-col flex-1 min-h-0">
        <AutoScrollContainer>
          <MessageList messages={messages} agentId={agentId} agentStatus={agentStatus} />
        </AutoScrollContainer>

        <PendingQuestions
          questions={
            currentExecutionState?.availableInteractions
              ?.filter(interaction => interaction.type === "question")
              .map(question => ({
                ...question,
                requestId: currentExecutionState.requestId,
              })) || []
          }
          agentId={agentId}
        />

        <ChatFooter
          agentId={agentId}
          input={input}
          setInput={setInput}
          inputError={inputError}
          setInputError={setInputError}
          idle={idle}
          statusMessage={agentStatus.currentActivity}
          availableCommands={filteredAvailableCommands}
          commandHistory={commandHistory.data || []}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          setShowFileBrowser={setShowFileBrowser}
          onSubmit={handleSubmit}
          submitFeedback={submitFeedback}
        />
      </div>
    </div>
  );
}
