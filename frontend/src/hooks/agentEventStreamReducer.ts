import type { AgentEventEnvelope, AgentStatusSchema, InputExecutionStateSchema } from "@tokenring-ai/agent/AgentEvents";
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
  inputExecutions: Map<string, InputExecutionState>;
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
    inputExecutions: new Map(),
  };
}

function hasMessage(event: AgentEventEnvelope): event is Extract<AgentEventEnvelope, { message: string }> {
  return "message" in event;
}

export function reduceAgentEventStreamChunk(prev: AgentEventStreamState, chunk: AgentEventStreamChunk): AgentEventStreamState {
  if (chunk.status === "agentNotFound") {
    return { ...prev, agentNotFound: true };
  }

  const currentMessages = [...prev.messages];
  let currentAgentStatus = prev.agentStatus;
  let currentExecutionState = prev.currentExecutionState;
  const inputExecutions = new Map(prev.inputExecutions);

  const appendMessage = (event: ChatMessage) => {
    currentMessages.push(event);
  };

  const mergeStreamingMessage = (event: Extract<AgentEventEnvelope, { type: "output.chat" | "output.reasoning" }>) => {
    const lastIndex = currentMessages.length - 1;
    const lastMessage = currentMessages[lastIndex];
    if (lastMessage && lastMessage.type === event.type && hasMessage(lastMessage)) {
      currentMessages[lastIndex] = { ...lastMessage, message: lastMessage.message + event.message, timestamp: event.timestamp };
      return;
    }
    appendMessage(event);
  };

  const seenQuestionIds = new Set(
    currentMessages
      .filter((message): message is ChatMessage & { requestId: string; interactionId: string } => "interactionId" in message)
      .map(message => `${message.requestId}:${message.interactionId}`),
  );

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
  };
}
