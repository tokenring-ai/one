import { createInitialAgentEventStreamState, reduceAgentEventStreamChunk } from "../hooks/agentEventStreamReducer.ts";
import { agentRPCClient } from "../rpc.ts";
import type { ChatMessage } from "../types/agent-events.ts";
import { downloadTextFile, transcriptExportFileName, transcriptToJson, transcriptToMarkdown } from "./transcriptExport.ts";

export type TranscriptFormat = "markdown" | "json";

/** An agent's whole transcript, for exporting it without opening its chat. Null when the agent is gone. */
export async function fetchAgentTranscript(agentId: string): Promise<ChatMessage[] | null> {
  const chunk = await agentRPCClient.getAgentEvents({ agentId, fromPosition: 0 });
  if (chunk.status === "agentNotFound") return null;
  return reduceAgentEventStreamChunk(createInitialAgentEventStreamState(), chunk).messages;
}

export function formatTranscript(messages: ChatMessage[], format: TranscriptFormat): string {
  return format === "markdown" ? transcriptToMarkdown(messages) : transcriptToJson(messages);
}

export function downloadTranscript(messages: ChatMessage[], format: TranscriptFormat): void {
  if (format === "markdown") downloadTextFile(transcriptExportFileName(messages, "md"), transcriptToMarkdown(messages), "text/markdown;charset=utf-8");
  else downloadTextFile(transcriptExportFileName(messages, "json"), transcriptToJson(messages), "application/json;charset=utf-8");
}
