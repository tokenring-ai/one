import type { AgentEventEnvelope, ParsedInteractionRequest } from "@tokenring-ai/agent/AgentEvents";

export type QuestionInteraction = Extract<ParsedInteractionRequest, { type: "question" }>;

export type QuestionPromptMessage = QuestionInteraction & {
  requestId: string;
};

export type InteractionResponseMessage = Extract<AgentEventEnvelope, { type: "input.interaction" }>;

export type ChatMessage = AgentEventEnvelope | QuestionPromptMessage;

export function isQuestionPromptMessage(message: ChatMessage): message is QuestionPromptMessage {
  return message.type === "question";
}
