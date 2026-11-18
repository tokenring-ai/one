import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { cn } from "../../../../lib/utils.ts";

/** Plain words for the backend's lifecycle messages, which name config keys and agent ids. */
const PHRASES: [RegExp, (match: RegExpExecArray) => string][] = [
  [/^Agent created from config: (.+) \([^)]*\)$/, m => `${m[1]} started`],
  [/^Subagent of agent \S+ created from config: (.+) \([^)]*\)$/, m => `${m[1]} started as a sub-agent`],
  [/^Recovered agent of type: .+ from checkpoint of agent \S+$/, () => "Relaunched from a checkpoint"],
  [/^Branched from agent \S+$/, () => "Branched from another agent"],
];

export function sessionEventText(message: string): string {
  for (const [pattern, phrase] of PHRASES) {
    const match = pattern.exec(message.trim());
    if (match) return phrase(match);
  }
  return message;
}

/**
 * A session's start or end, as a quiet band across the transcript rather than a
 * chat row. The backend's wording and details stay available in the tooltip.
 */
export default function SessionEvent({
  message,
  details,
  timestamp,
  ended = false,
}: {
  message: string;
  details: readonly string[];
  timestamp: number;
  ended?: boolean;
}) {
  const tooltip = [message, ...details].join("\n");
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs" role="note" title={tooltip}>
      <span className="h-px flex-1 bg-line-subtle" aria-hidden="true" />
      <span className={cn("max-w-[70%] truncate", ended ? "text-error" : "text-muted")}>
        {sessionEventText(message)} · {formatTime(timestamp)}
      </span>
      <span className="h-px flex-1 bg-line-subtle" aria-hidden="true" />
    </div>
  );
}
