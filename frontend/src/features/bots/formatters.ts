/** Relative phrase for conversation timestamps. */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (ts == null || ts <= 0) return "—";
  const delta = now - ts;
  const minutes = Math.round(delta / 60_000);
  const hours = Math.round(delta / 3_600_000);
  const days = Math.round(delta / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 48) return `${hours}h ago`;
  return `${days}d ago`;
}

/** Absolute timestamp, for titles and tooltips. */
export function formatTimestamp(ts: number | null | undefined): string {
  if (ts == null || ts <= 0) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
