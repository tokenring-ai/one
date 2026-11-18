import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { Check, GitBranch } from "lucide-react";
import type { TurnUsage } from "../../../../hooks/usePerTurnUsage.ts";

const COMPLETE = /^Response Complete \[Tokens in: ([\d,]+), out: ([\d,]+), total: ([\d,]+)\]/;

/** True for the chat command's end-of-turn status ("Response Complete [Tokens …]"), which carries no answer of its own. */
export function isTurnCompleteMessage(message: string): boolean {
  return COMPLETE.test(message);
}

function tokensFrom(message: string): number | null {
  const total = COMPLETE.exec(message)?.[3];
  return total ? Number(total.replaceAll(",", "")) : null;
}

/**
 * The end of a finished turn: one quiet line under the reply (tokens, cost, time)
 * instead of a chat row repeating the token counts, plus the branch point.
 */
export default function TurnEnd({
  message,
  timestamp,
  usage,
  onBranch,
}: {
  message: string;
  timestamp: number;
  usage?: TurnUsage | undefined;
  onBranch?: (() => void) | undefined;
}) {
  const tokens = usage?.totalTokens ?? tokensFrom(message);
  const cost = usage?.costTotal;
  const parts = [
    tokens !== null && tokens > 0 ? `${tokens.toLocaleString()} tokens` : null,
    cost !== undefined && cost > 0 ? `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(3)}` : null,
    formatTime(timestamp),
  ].filter(Boolean);
  return (
    <div className="group flex items-center gap-2 px-3 pt-0.5 pb-3 pl-12 text-xs text-muted" role="note" aria-label="Turn finished">
      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      <span className="tabular-nums">{parts.join(" · ")}</span>
      {onBranch && (
        <button
          type="button"
          onClick={onBranch}
          className="grid h-5 w-5 place-items-center rounded text-muted opacity-100 transition-opacity hover:bg-hover hover:text-fg focus-ring md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          title="Branch: a new agent with the conversation up to here"
          aria-label="Branch from here"
        >
          <GitBranch className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
