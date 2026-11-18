import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types/agent-events.ts";

/** Cost + token totals of one completed AI response, as exposed by `streamChatUsage`. */
export interface TurnUsage {
  costTotal: number;
  totalTokens: number;
}

interface UsageSnapshot {
  costTotal: number;
  totalTokens: number;
}

/**
 * Binds the "most recent response" usage exposed by `streamChatUsage` to the
 * `agent.response` events in the transcript, yielding per-turn usage chips.
 *
 * The backend stream only ever describes the latest completed turn, so each
 * changed snapshot is attached to the newest response event that does not have
 * an entry yet. Binding happens when the usage update arrives — the response
 * event usually lands within the same tick, in either order. A turn that
 * completes without changing usage stays unbound (no chip) rather than showing
 * a previous turn's numbers.
 */
export function usePerTurnUsage(usageStatus: string | null | undefined, usageSnapshot: UsageSnapshot | null, messages: ChatMessage[]): Map<string, TurnUsage> {
  const [usageByRequestId, setUsageByRequestId] = useState<Map<string, TurnUsage>>(new Map());
  const usageByRequestIdRef = useRef(usageByRequestId);
  const lastSnapshotRef = useRef<UsageSnapshot | null>(null);
  const successResponsesRef = useRef<ChatMessage[]>([]);
  successResponsesRef.current = messages.filter(m => m.type === "agent.response" && m.status === "success");

  // On each actually-changed usage snapshot, bind it to the newest unbound
  // response: the snapshot describes exactly the turn that just completed.
  useEffect(() => {
    if (usageStatus !== "success" || !usageSnapshot) return;
    const last = lastSnapshotRef.current;
    if (last && last.costTotal === usageSnapshot.costTotal && last.totalTokens === usageSnapshot.totalTokens) return;
    lastSnapshotRef.current = usageSnapshot;

    const current = usageByRequestIdRef.current;
    let target: Extract<ChatMessage, { type: "agent.response" }> | null = null;
    for (let i = successResponsesRef.current.length - 1; i >= 0; i--) {
      const response = successResponsesRef.current[i]! as Extract<ChatMessage, { type: "agent.response" }>;
      if (!current.has(response.requestId)) {
        target = response;
        break;
      }
    }
    if (!target) return;

    const next = new Map(current);
    next.set(target.requestId, { costTotal: usageSnapshot.costTotal, totalTokens: usageSnapshot.totalTokens });
    usageByRequestIdRef.current = next;
    setUsageByRequestId(next);
  }, [usageStatus, usageSnapshot]);

  return usageByRequestId;
}
