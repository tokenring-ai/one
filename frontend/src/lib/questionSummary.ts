import type { QuestionInteraction } from "../types/agent-events.ts";

/** Longest title read aloud; a long prompt is cut at a word. */
const MAX_TITLE = 140;

/** The first line of a markdown prompt as plain text, short enough to be spoken. */
export function plainTitle(markdown: string): string {
  const line = markdown.split("\n").find(l => l.trim()) ?? "";
  const text = line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= MAX_TITLE) return text;
  const cut = text.slice(0, MAX_TITLE);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), MAX_TITLE / 2))}…`;
}

/** An approval is the yes/no question tools raise (Agent.askForApproval): a tree with Approved / Not approved leaves. */
export function isApprovalQuestion(request: Pick<QuestionInteraction, "question">): boolean {
  const { question } = request;
  if (question.type !== "treeSelect") return false;
  const values = new Set(question.tree.map(node => ("value" in node ? node.value : "")));
  return values.has("Approved") && values.has("Not approved");
}

/** "Approval needed: Run rm -rf build" / "Pat is asking a question: Which branch?" */
export function questionAnnouncement(request: Pick<QuestionInteraction, "message" | "question">, agentName: string): string {
  const title = plainTitle(request.message);
  const who = agentName || "The agent";
  if (isApprovalQuestion(request)) return title ? `Approval needed from ${who}: ${title}` : `Approval needed from ${who}`;
  return title ? `${who} is asking a question: ${title}` : `${who} is asking a question`;
}
