import { useEffect, useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { getMessageText } from "../../features/chat/messages/messageUtils.ts";
import type { RemoteAgentStatus } from "../../hooks/useAgentEventState.ts";
import type { TurnUsage } from "../../hooks/usePerTurnUsage.ts";
import { scrollBehavior } from "../../lib/motion.ts";
import type { ChatMessage, InteractionResponseMessage, QuestionPromptMessage } from "../../types/agent-events.ts";
import { isQuestionPromptMessage } from "../../types/agent-events.ts";
import MessageComponent from "./MessageComponent.tsx";
import ToolCallGroup, { TOOL_GROUP_MIN } from "./ToolCallGroup.tsx";

interface MessageListProps {
  messages: ChatMessage[];
  agentId: string;
  agentStatus: RemoteAgentStatus;
  /** Non-empty: show only messages whose text matches (case-insensitive). */
  searchQuery?: string;
  /** Hide tool-call entries entirely. */
  hideToolCalls?: boolean;
  /** Per-turn cost/tokens keyed by the requestId of the completed `agent.response`. */
  usageByRequestId?: Map<string, TurnUsage>;
  /** Resend the input that led to a failed response. */
  onRetryInput?: (requestId: string) => void;
  /** requestId currently being retried. */
  retryingRequestId?: string | null;
  /** Load a user message back into the composer. */
  onEditInput?: (message: Extract<ChatMessage, { type: "input.received" }>) => void;
  /**
   * Branch the conversation into a new agent: before a message you sent (it goes
   * in the new agent's box) or after a finished reply. Turns are the unit an
   * agent's memory is kept in, so these are the points a branch can start from.
   */
  onBranch?: (options: { at: number; draft?: string }) => void;
}

/** Follow new output only while at the bottom; animate it unless motion is reduced. */
export function followOutputBehavior(isAtBottom: boolean): "auto" | "smooth" | false {
  return isAtBottom ? scrollBehavior() : false;
}

export type DisplayItem =
  | { type: "header" }
  | { type: "message"; data: ChatMessage }
  | { type: "tool-group"; calls: Extract<ChatMessage, { type: "toolCall" }>[]; live: boolean }
  | { type: "question-pair"; data: { question: QuestionPromptMessage; response: InteractionResponseMessage } }
  | { type: "busy"; activity?: string; queuedCount: number };

/** Folds each run of at least TOOL_GROUP_MIN consecutive tool calls into one item; the run at the end is live while the agent works. */
export function groupToolCalls(items: DisplayItem[], busy: boolean): DisplayItem[] {
  const out: DisplayItem[] = [];
  let run: Extract<ChatMessage, { type: "toolCall" }>[] = [];
  const flush = (atEnd: boolean) => {
    if (run.length >= TOOL_GROUP_MIN) out.push({ type: "tool-group", calls: run, live: atEnd && busy });
    else for (const call of run) out.push({ type: "message", data: call });
    run = [];
  };
  for (const item of items) {
    if (item.type === "message" && item.data.type === "toolCall") {
      run.push(item.data);
      continue;
    }
    flush(false);
    out.push(item);
  }
  flush(true);
  return out;
}

/** Everything a message can be found by in transcript search. */
function messageSearchText(msg: ChatMessage): string {
  if (msg.type === "toolCall") {
    return [msg.name, msg.message, ...(msg.actions ?? []), msg.result].filter(Boolean).join("\n");
  }
  if (msg.type === "input.received") {
    return msg.input.message;
  }
  const text = getMessageText(msg);
  return text ?? "";
}

export default function MessageList({
  messages,
  agentId,
  agentStatus,
  searchQuery = "",
  hideToolCalls = false,
  usageByRequestId,
  onRetryInput,
  retryingRequestId = null,
  onEditInput,
  onBranch,
}: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const hasInitializedRef = useRef(false);

  const inputByRequestId = useMemo(() => {
    const map = new Map<string, Extract<ChatMessage, { type: "input.received" }>>();
    for (const msg of messages) {
      if (msg.type === "input.received") map.set(msg.requestId, msg);
    }
    return map;
  }, [messages]);

  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [{ type: "header" }];
    const questionMap = new Map<string, QuestionPromptMessage>();
    const query = searchQuery.trim().toLowerCase();

    // Build question map using composite key (requestId:interactionId) for consistency
    // with useAgentEventState's seenQuestionIds tracking
    for (const msg of messages) {
      if (isQuestionPromptMessage(msg)) {
        const key = `${msg.requestId}:${msg.interactionId}`;
        questionMap.set(key, msg);
      }
    }

    for (const msg of messages) {
      if (isQuestionPromptMessage(msg)) {
        // Pending questions are rendered above the input, not inline in the timeline.
        continue;
      }

      if (hideToolCalls && msg.type === "toolCall") continue;

      if (query && !messageSearchText(msg).toLowerCase().includes(query)) continue;

      if (msg.type === "input.interaction") {
        // Use the same composite key for lookup
        const key = `${msg.requestId}:${msg.interactionId}`;
        const question = questionMap.get(key);
        if (question) {
          items.push({
            type: "question-pair",
            data: { question, response: msg },
          });
          continue;
        }
      }

      items.push({ type: "message", data: msg });
    }

    const busy = agentStatus.inputExecutionQueue.length > 0;
    // Fold runs of tool calls into one row each (not while searching: every match should show).
    const grouped = query ? items : groupToolCalls(items, busy);
    items.length = 0;
    items.push(...grouped);

    if (busy) {
      items.push({ type: "busy", activity: agentStatus.currentActivity, queuedCount: Math.max(0, agentStatus.inputExecutionQueue.length - 1) });
    }

    return items;
  }, [messages, agentStatus.inputExecutionQueue.length, agentStatus.currentActivity, searchQuery, hideToolCalls]);

  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return displayItems.filter(item => item.type === "message" || item.type === "question-pair").length;
  }, [displayItems, searchQuery]);

  // Scroll to bottom on initial mount when there are messages
  useEffect(() => {
    if (!hasInitializedRef.current && virtuosoRef.current && displayItems.length > 1) {
      const timer = setTimeout(() => {
        if (virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: displayItems.length - 1,
            align: "end",
          });
          hasInitializedRef.current = true;
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [displayItems.length]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={displayItems}
      followOutput={followOutputBehavior}
      initialTopMostItemIndex={displayItems.length > 1 ? displayItems.length - 1 : 0}
      itemContent={(_index, item) => {
        if (item.type === "header") {
          const firstMessage = messages.find(m => !isQuestionPromptMessage(m) && m.type !== "input.interaction");
          const hasMessages = displayItems.some(i => i.type === "message" || i.type === "question-pair" || i.type === "tool-group");

          return (
            <>
              <div className="h-3" />
              <div className="px-3 py-3 flex items-center gap-3 text-primary select-none">
                <div className="h-px bg-primary/50 flex-1" />
                <span className="text-xs uppercase tracking-widest text-muted">
                  Session Start • {firstMessage?.timestamp ? new Date(firstMessage.timestamp).toLocaleDateString() : "New Session"}
                </span>
                <div className="h-px bg-primary/50 flex-1" />
              </div>
              {searchQuery.trim() && (
                <div className="px-3 pb-2 text-center text-xs text-muted" role="status">
                  {matchCount === 1 ? "1 message matches" : `${matchCount ?? 0} messages match`} “{searchQuery.trim()}”
                </div>
              )}
              {!hasMessages && !searchQuery.trim() && (
                <div className="px-3 py-8 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-secondary mb-3">
                    <span className="text-2xl">👋</span>
                  </div>
                  <h3 className="text-base font-semibold text-primary mb-2">Welcome to TokenRing</h3>
                  <p className="text-sm text-muted mb-4 max-w-md mx-auto">
                    Start a conversation by typing a message below. Try{" "}
                    <code className="px-1.5 py-0.5 rounded bg-tertiary border border-primary text-primary text-xs">/help</code> to see available commands.
                  </p>
                </div>
              )}
            </>
          );
        }
        if (item.type === "busy") {
          return (
            <div className="flex items-center gap-3 px-5 py-3 animate-pulse">
              <div className="shrink-0 w-10 flex justify-center">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-warning rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-warning rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-warning rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
              <div className="text-muted text-sm leading-relaxed">
                {item.activity ? `${item.activity}...` : "Working..."}
                {item.queuedCount > 0 && <span className="ml-2 text-accent-soft">+{item.queuedCount} queued</span>}
              </div>
            </div>
          );
        }
        if (item.type === "tool-group") {
          return (
            <ToolCallGroup
              calls={item.calls}
              live={item.live}
              renderCall={call => <MessageComponent key={`${call.name}:${call.timestamp}`} msg={call} agentId={agentId} />}
            />
          );
        }
        if (item.type === "question-pair") {
          return <MessageComponent msg={item.data.response} agentId={agentId} question={item.data.question} response={item.data.response} />;
        }

        const msg = item.data;
        const usage = msg.type === "agent.response" && msg.status === "success" ? usageByRequestId?.get(msg.requestId) : undefined;
        const failedInput = msg.type === "agent.response" && msg.status === "error" ? inputByRequestId.get(msg.requestId) : undefined;
        const retryHandler =
          failedInput && onRetryInput
            ? () => {
                onRetryInput(failedInput.requestId);
              }
            : undefined;
        const editHandler =
          onEditInput && msg.type === "input.received"
            ? () => {
                onEditInput(msg);
              }
            : undefined;

        const branchHandler = !onBranch
          ? undefined
          : msg.type === "input.received"
            ? () => onBranch({ at: msg.timestamp - 1, draft: msg.input.message })
            : msg.type === "agent.response"
              ? () => onBranch({ at: msg.timestamp })
              : undefined;

        return (
          <MessageComponent
            msg={msg}
            agentId={agentId}
            {...(branchHandler !== undefined && { onBranch: branchHandler })}
            {...(usage !== undefined && { usage })}
            {...(retryHandler !== undefined && { onRetry: retryHandler })}
            {...(editHandler !== undefined && { onEdit: editHandler })}
            retrying={retryingRequestId !== null && msg.type === "agent.response" && retryingRequestId === msg.requestId}
          />
        );
      }}
    />
  );
}
