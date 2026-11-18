import type { ChatMessage, InteractionResponseMessage, QuestionPromptMessage } from "../types/agent-events.ts";

const SKIPPED_TYPES = new Set(["agent.status", "input.execution", "cancel"]);

/** First user message (truncated), for naming exports. */
export function transcriptTitle(messages: ChatMessage[]): string {
  const firstInput = messages.find((m): m is Extract<ChatMessage, { type: "input.received" }> => m.type === "input.received");
  const text = (firstInput?.input.message ?? "New session").trim();
  const collapsed = text.replace(/\s+/g, " ");
  return collapsed.length > 60 ? `${collapsed.slice(0, 60)}…` : collapsed || "New session";
}

export function transcriptExportFileName(messages: ChatMessage[], extension: string): string {
  const slug = transcriptTitle(messages)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || "transcript"}-${stamp}.${extension}`;
}

function attachmentsFootnote(message: ChatMessage & { input?: { attachments?: { name: string }[] }; attachments?: { name: string }[] }): string {
  const names = message.input?.attachments?.map(a => a.name) ?? message.attachments?.map(a => a.name) ?? [];
  return names.length > 0 ? `\n\n_Attachments: ${names.join(", ")}_` : "";
}

export function transcriptToMarkdown(messages: ChatMessage[]): string {
  const responsesByInteractionId = new Map<string, InteractionResponseMessage>();
  for (const message of messages) {
    if (message.type === "input.interaction") {
      responsesByInteractionId.set(message.interactionId, message);
    }
  }

  const lines: string[] = [`# ${transcriptTitle(messages)}`, "", `_Exported ${new Date().toLocaleString()}_`, ""];

  let lastOutputChat = "";
  for (const message of messages) {
    if (SKIPPED_TYPES.has(message.type)) continue;

    switch (message.type) {
      case "input.received":
        lines.push("## User", "", message.input.message.trim() || "_(empty message)_", attachmentsFootnote(message), "");
        break;
      case "output.chat":
        lastOutputChat = message.message;
        lines.push("**Agent:**", "", message.message, "");
        break;
      case "output.reasoning":
        if (message.message.trim()) {
          lines.push("<details><summary>Thinking</summary>", "", message.message, "", "</details>", "");
        }
        break;
      case "agent.response":
        // A successful response usually repeats the final output.chat text; only
        // add it when it carries something new (or is an error/cancellation).
        if (message.status !== "success" || (message.message.trim() && message.message !== lastOutputChat)) {
          const label = message.status === "error" ? "**Agent (error):**" : message.status === "cancelled" ? "**Agent (cancelled):**" : "**Agent:**";
          lines.push(label, "", message.message.trim() || `_(no content)_`, "");
        }
        break;
      case "toolCall":
        lines.push(`> 🔧 ${message.message}`);
        break;
      case "output.info":
        lines.push(`> ℹ️ ${message.message}`, "");
        break;
      case "output.warning":
        lines.push(`> ⚠️ ${message.message}`, "");
        break;
      case "output.error":
        lines.push(`> ❌ ${message.message}`, "");
        break;
      case "agent.created":
      case "agent.stopped":
        lines.push(`_${message.message}_`, "");
        break;
      case "question": {
        const question = message as QuestionPromptMessage;
        const response = responsesByInteractionId.get(question.interactionId);
        lines.push(`**Question:** ${question.message}`);
        lines.push("");
        if (response) {
          lines.push(`**Answer:** ${JSON.stringify(response.result ?? null)}`, "");
        }
        break;
      }
      default:
        break;
    }
  }

  return (
    lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

export function transcriptToJson(messages: ChatMessage[]): string {
  return `${JSON.stringify({ title: transcriptTitle(messages), exportedAt: new Date().toISOString(), messages }, null, 2)}\n`;
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
