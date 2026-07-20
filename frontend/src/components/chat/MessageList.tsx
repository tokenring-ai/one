import { useEffect, useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { RemoteAgentStatus } from "../../hooks/useAgentEventState.ts";
import type { ChatMessage, InteractionResponseMessage, QuestionPromptMessage } from "../../types/agent-events.ts";
import { isQuestionPromptMessage } from "../../types/agent-events.ts";
import MessageComponent from "./MessageComponent.tsx";

interface MessageListProps {
  messages: ChatMessage[];
  agentId: string;
  agentStatus: RemoteAgentStatus;
}

type DisplayItem =
  | { type: "header" }
  | { type: "message"; data: ChatMessage }
  | { type: "question-pair"; data: { question: QuestionPromptMessage; response: InteractionResponseMessage } }
  | { type: "busy"; data?: string };

export default function MessageList({ messages, agentId, agentStatus }: MessageListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const hasInitializedRef = useRef(false);

  const displayItems = useMemo(() => {
    const items: DisplayItem[] = [{ type: "header" }];
    const questionMap = new Map<string, QuestionPromptMessage>();

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

    if (agentStatus.inputExecutionQueue.length > 0) {
      items.push({ type: "busy", data: agentStatus.currentActivity });
    }

    return items;
  }, [messages, agentStatus.inputExecutionQueue.length, agentStatus.currentActivity]);

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
      followOutput="smooth"
      initialTopMostItemIndex={displayItems.length > 1 ? displayItems.length - 1 : 0}
      itemContent={(_index, item) => {
        if (item.type === "header") {
          const firstMessage = messages.find(m => !isQuestionPromptMessage(m) && m.type !== "input.interaction");
          const hasMessages = displayItems.some(i => i.type === "message" || i.type === "question-pair");

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
              {!hasMessages && (
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
              <div className="text-muted text-sm leading-relaxed">{item.data}...</div>
            </div>
          );
        }
        if (item.type === "question-pair") {
          return <MessageComponent msg={item.data.response} agentId={agentId} question={item.data.question} response={item.data.response} />;
        }

        return <MessageComponent msg={item.data} agentId={agentId} />;
      }}
    />
  );
}
