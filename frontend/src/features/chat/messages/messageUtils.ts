import type { ChatMessage } from "../../../types/agent-events.ts";

export function getMessageText(msg: ChatMessage): string | null {
  switch (msg.type) {
    case "input.received":
      return msg.input.message.trim() || "[empty message]";
    case "question":
    case "agent.created":
    case "agent.stopped":
    case "agent.response":
    case "output.chat":
    case "output.reasoning":
    case "output.info":
    case "output.warning":
    case "output.error":
      return msg.message.trim() || "[empty message]";
    case "toolCall":
      return msg.summary;
    default:
      return null;
  }
}

export function getMessageDetails(msg: ChatMessage): string[] {
  return "details" in msg ? (msg.details ?? []) : [];
}

export function getInputSource(msg: ChatMessage): string | null {
  if (msg.type === "input.received" && msg.input.from) {
    return msg.input.from;
  }
  return null;
}
