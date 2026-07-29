/** Relative phrase for conversation timestamps. */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (ts == null || ts <= 0) return "—";
  const delta = ts - now;
  const abs = Math.abs(delta);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let unit: string;
  if (minutes < 1) unit = "just now";
  else if (minutes < 60) unit = `${minutes}m`;
  else if (hours < 48) unit = `${hours}h`;
  else unit = `${days}d`;

  if (unit === "just now") return unit;
  return delta >= 0 ? `in ${unit}` : `${unit} ago`;
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

/** Short label for a `service:id` target suitable for dense list rows. */
export function formatTargetLabel(target: string): string {
  const { service, id } = splitTarget(target);
  if (!service) return target;
  return `${service}:${id}`;
}
