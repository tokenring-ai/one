import { useEffect, useRef } from "react";
import { plainTitle, questionAnnouncement } from "../../lib/questionSummary.ts";
import type { ChatMessage, QuestionPromptMessage } from "../../types/agent-events.ts";

/** "Working" is only worth saying for a turn that lasts; a reply that lands inside this window gets just "finished". */
const WORKING_DELAY_MS = 700;

/** History streamed in on mount predates this by more than the slack, and is never announced. */
const HISTORY_SLACK_MS = 2000;

export interface ChatAnnouncementsInput {
  announce: (message: string) => void;
  /** Who is speaking: the session title or agent name. */
  agentName: string;
  messages: readonly ChatMessage[];
  /** The agent is executing (or has queued) input. */
  busy: boolean;
  /** False until the agent's first status arrives, so the connect-time state is a baseline, not an event. */
  known: boolean;
  /** Blocking questions, announced even when the person is not looking at this chat. */
  questions: readonly QuestionPromptMessage[];
  /** The person can see this chat now. Background chats stay silent except for blocking questions. */
  attending: boolean;
}

function messageKey(message: ChatMessage): string {
  return `${message.type}:${message.timestamp}:${"requestId" in message ? message.requestId : ""}`;
}

/**
 * Turns what happens in a chat into a few short announcements: a turn started,
 * finished or failed, a batch of tool calls finished, an agent needs an answer.
 * Streamed output is deliberately not announced; the transcript is a log with
 * live updates off, so a person reads it on their own terms.
 */
export function useChatAnnouncements({ announce, agentName, messages, busy, known, questions, attending }: ChatAnnouncementsInput): void {
  const name = agentName || "The agent";
  const latest = useRef({ announce, name, attending });
  latest.current = { announce, name, attending };

  const mountedAt = useRef(Date.now());
  const workingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasBusy = useRef<boolean | null>(null);
  const seenMessages = useRef(new Set<string>());
  const pendingTools = useRef(0);
  const announcedQuestions = useRef(new Set<string>());

  useEffect(
    () => () => {
      if (workingTimer.current) clearTimeout(workingTimer.current);
    },
    [],
  );

  // A turn started: once per turn, and only if it is still going after a moment.
  useEffect(() => {
    if (!known) return;
    const before = wasBusy.current;
    wasBusy.current = busy;
    if (before === null || before === busy) return;
    if (workingTimer.current) {
      clearTimeout(workingTimer.current);
      workingTimer.current = null;
    }
    if (!busy || !latest.current.attending) return;
    workingTimer.current = setTimeout(() => {
      workingTimer.current = null;
      latest.current.announce(`${latest.current.name} is working`);
    }, WORKING_DELAY_MS);
  }, [busy, known]);

  // Turn results, failures and the end of a tool batch.
  useEffect(() => {
    const seen = seenMessages.current;
    const fresh: ChatMessage[] = [];
    for (const message of messages) {
      if (message.type !== "agent.response" && message.type !== "output.error" && message.type !== "toolCall") continue;
      const key = messageKey(message);
      if (seen.has(key)) continue;
      seen.add(key);
      if (message.timestamp < mountedAt.current - HISTORY_SLACK_MS) continue;
      fresh.push(message);
    }
    if (fresh.length === 0 && pendingTools.current === 0) return;
    const { announce: say, name: who, attending: watching } = latest.current;

    pendingTools.current += fresh.filter(m => m.type === "toolCall").length;
    const newest = [...fresh].reverse();
    const response = newest.find(m => m.type === "agent.response");
    const error = newest.find(m => m.type === "output.error");

    if (response?.type === "agent.response") {
      // The turn is over: its tool calls are folded into the result.
      pendingTools.current = 0;
      if (watching) {
        if (response.status === "error") say(`${who} failed${response.message.trim() ? `: ${plainTitle(response.message)}` : ""}`);
        else if (response.status === "cancelled") say(`${who} was cancelled`);
        else say(`${who} finished`);
      }
      return;
    }
    if (error?.type === "output.error") {
      if (watching) say(`${who} reported an error: ${plainTitle(error.message)}`);
      return;
    }
    // A batch ends when something other than a tool call follows it.
    const last = messages.at(-1);
    if (pendingTools.current > 0 && last && last.type !== "toolCall") {
      const count = pendingTools.current;
      pendingTools.current = 0;
      if (watching) say(count === 1 ? "A tool call finished" : `${count} tool calls finished`);
    }
  }, [messages]);

  // A blocking question is announced once, wherever the person is looking.
  useEffect(() => {
    const announced = announcedQuestions.current;
    const fresh = questions.filter(q => !announced.has(`${q.requestId}:${q.interactionId}`));
    if (fresh.length === 0) return;
    for (const q of fresh) announced.add(`${q.requestId}:${q.interactionId}`);
    const [first, ...rest] = fresh;
    if (!first) return;
    const text = questionAnnouncement(first, latest.current.name);
    latest.current.announce(rest.length > 0 ? `${text} (and ${rest.length} more)` : text);
  }, [questions]);
}
