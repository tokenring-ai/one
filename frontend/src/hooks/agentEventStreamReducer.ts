import type { AgentEventEnvelope, AgentStatusSchema, InputExecutionStateSchema } from "@tokenring-ai/agent/AgentEvents";
import EnhancedMap from "@tokenring-ai/utility/map/enhancedMap";
import type { z } from "zod";
import type { ChatMessage, QuestionInteraction } from "../types/agent-events.ts";

export type RemoteAgentStatus = Omit<AgentStatus, "status"> & {
  status: AgentStatus["status"] | "connecting";
};

type AgentStatus = z.output<typeof AgentStatusSchema>;
type InputExecutionState = z.output<typeof InputExecutionStateSchema>;

export type AgentEventStreamChunk = { status: "agentNotFound" } | { status: "success"; events: AgentEventEnvelope[]; position: number };

export type AgentEventStreamState = {
  messages: ChatMessage[];
  agentStatus: RemoteAgentStatus;
  position: number;
  currentExecutionState: InputExecutionState | null | undefined;
  agentNotFound: boolean;
  inputExecutions: EnhancedMap<string, InputExecutionState>;
  /**
   * Dedup keys (`requestId:interactionId`) for question prompts already in
   * `messages`. Maintained incrementally so a chunk doesn't have to rescan the
   * whole message list to avoid re-adding a prompt.
   */
  seenQuestionIds: Set<string>;
};

export const INITIAL_AGENT_STATUS: RemoteAgentStatus = {
  type: "agent.status",
  status: "connecting",
  currentActivity: "Connecting to the agent...",
  timestamp: 0,
  inputExecutionQueue: [],
};

export function createInitialAgentEventStreamState(): AgentEventStreamState {
  return {
    messages: [],
    agentStatus: INITIAL_AGENT_STATUS,
    position: 0,
    currentExecutionState: null,
    agentNotFound: false,
    inputExecutions: new EnhancedMap(),
    seenQuestionIds: new Set(),
  };
}

function hasMessage(event: AgentEventEnvelope): event is Extract<AgentEventEnvelope, { message: string }> {
  return "message" in event;
}

/** Dedup key for a question prompt, or null when the message isn't one. */
function questionKey(message: ChatMessage): string | null {
  const m = message as { requestId?: unknown; interactionId?: unknown };
  if (typeof m.requestId === "string" && typeof m.interactionId === "string") {
    return `${m.requestId}:${m.interactionId}`;
  }
  return null;
}

export function reduceAgentEventStreamChunk(prev: AgentEventStreamState, chunk: AgentEventStreamChunk): AgentEventStreamState {
  if (chunk.status === "agentNotFound") {
    return { ...prev, agentNotFound: true };
  }

  // Copy-on-write: reuse the previous array until a message is actually added or
  // merged, so chunks that only carry status/cancel events (the common case while
  // streaming) avoid an O(n) copy of the whole message list.
  let currentMessages = prev.messages;
  const ensureWritable = (): ChatMessage[] => {
    if (currentMessages === prev.messages) {
      currentMessages = [...prev.messages];
    }
    return currentMessages;
  };

  let currentAgentStatus = prev.agentStatus;
  let currentExecutionState = prev.currentExecutionState;
  const inputExecutions = prev.inputExecutions.clone();
  const seenQuestionIds = prev.seenQuestionIds;

  const appendMessage = (event: ChatMessage) => {
    ensureWritable().push(event);
    const key = questionKey(event);
    if (key !== null) seenQuestionIds.add(key);
  };

  const mergeStreamingMessage = (event: Extract<AgentEventEnvelope, { type: "output.chat" | "output.reasoning" }>) => {
    const lastIndex = currentMessages.length - 1;
    const lastMessage = currentMessages[lastIndex];
    if (lastMessage && lastMessage.type === event.type && hasMessage(lastMessage)) {
      ensureWritable()[lastIndex] = { ...lastMessage, message: lastMessage.message + event.message, timestamp: event.timestamp };
      return;
    }
    appendMessage(event);
  };

  const addQuestionPrompts = (requestId: string, interactions: QuestionInteraction[] = []) => {
    for (const interaction of interactions) {
      const key = `${requestId}:${interaction.interactionId}`;
      if (seenQuestionIds.has(key)) continue;

      appendMessage({
        ...interaction,
        requestId,
      });
      seenQuestionIds.add(key);
    }
  };

  for (const event of chunk.events) {
    switch (event.type) {
      case "output.chat":
      case "output.reasoning":
        mergeStreamingMessage(event);
        break;
      case "agent.created":
      case "agent.stopped":
      case "agent.response":
      case "output.info":
      case "output.warning":
      case "output.error":
      case "input.received":
      case "input.interaction":
      case "toolCall":
        appendMessage(event);
        break;
      case "agent.status":
        {
          currentAgentStatus = event;
          const requestId = event.inputExecutionQueue[0];
          currentExecutionState = requestId ? inputExecutions.get(requestId) : undefined;
        }
        break;
      case "input.execution":
        if (event.status === "finished") {
          inputExecutions.delete(event.requestId);
        } else {
          const prevEvent = inputExecutions.get(event.requestId);
          inputExecutions.set(event.requestId, {
            ...prevEvent,
            ...event,
          });
          addQuestionPrompts(
            event.requestId,
            (event.availableInteractions ?? []).filter((interaction): interaction is QuestionInteraction => interaction.type === "question"),
          );
        }
        break;
      case "cancel":
        break;
      default: {
        const exhaustive: any = event satisfies never;
        throw new Error(`Unhandled event type: ${exhaustive.type}`);
      }
    }
  }

  return {
    messages: currentMessages,
    agentStatus: currentAgentStatus,
    position: chunk.position,
    currentExecutionState,
    agentNotFound: false,
    inputExecutions,
    seenQuestionIds,
  };
}
