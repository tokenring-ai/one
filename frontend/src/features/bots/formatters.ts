import { formatRelativeTime as formatRelativeTimeBase } from "@tokenring-ai/utility/date/formatRelativeTime";
import { formatTimestamp as formatTimestampBase } from "@tokenring-ai/utility/date/formatTimestamp";

/** Relative phrase for conversation timestamps. */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  return formatRelativeTimeBase(ts, { now });
}

/** Absolute timestamp, for titles and tooltips. */
export function formatTimestamp(ts: number | null | undefined): string {
  return formatTimestampBase(ts);
}

const DIRECT_MESSAGE_LABELS = {
  listed: "Listed users only",
  anyone: "Anyone",
  none: "Disabled",
} as const;

export function formatDirectMessagePolicy(policy: "listed" | "anyone" | "none"): string {
  return DIRECT_MESSAGE_LABELS[policy];
}

/** Splits a `service:id` target, tolerating ids that contain colons. */
export function splitTarget(target: string): { service: string; id: string } {
  const separator = target.indexOf(":");
  if (separator < 0) return { service: "", id: target };
  return { service: target.slice(0, separator), id: target.slice(separator + 1) };
}

/** Short label for a `service:id` target suitable for dense list rows. */
export function formatTargetLabel(target: string): string {
  const { service, id } = splitTarget(target);
  if (!service) return target;
  return `${service}:${id}`;
}
