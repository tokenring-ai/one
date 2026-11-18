import { formatRelativeTime as formatRelativeTimeBase } from "@tokenring-ai/utility/date/formatRelativeTime";
import { formatTimestamp as formatTimestampBase } from "@tokenring-ai/utility/date/formatTimestamp";

/** Relative phrase for conversation timestamps (past-only; future activity is treated as just now). */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  return formatRelativeTimeBase(ts, { now, future: false });
}

/** Absolute timestamp for titles and tooltips. */
export function formatTimestamp(ts: number | null | undefined): string {
  return formatTimestampBase(ts);
}

/** Service display names, gradients, and brand tokens. Re-exported from shared lib. */
export { formatServiceName, getServiceBrand, serviceGradient } from "../../lib/serviceGradient.ts";
