export { formatDurationBetween, formatDurationMs } from "@tokenring-ai/utility/date/formatDuration";

import { formatRelativeTime as formatRelativeTimeBase } from "@tokenring-ai/utility/date/formatRelativeTime";
import { formatTimestamp } from "@tokenring-ai/utility/date/formatTimestamp";

export { truncateText } from "@tokenring-ai/utility/string/truncateText";

/** Format a unix-ms timestamp for queue UI display. */
export function formatQueueTime(ts: number | null | undefined, opts?: { withSeconds?: boolean }): string {
  return formatTimestamp(ts, opts);
}

/** Relative phrase for timestamps (second-precision "just now" for queue freshness). */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  return formatRelativeTimeBase(ts, { now, precise: true });
}
