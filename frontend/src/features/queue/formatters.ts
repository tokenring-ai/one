/** Format a unix-ms timestamp for queue UI display. */
export function formatQueueTime(ts: number | null | undefined, opts?: { withSeconds?: boolean }): string {
  if (ts == null || ts <= 0) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(opts?.withSeconds ? { second: "2-digit" } : {}),
  });
}

/** Relative phrase for timestamps. */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  if (ts == null || ts <= 0) return "—";
  const delta = ts - now;
  const abs = Math.abs(delta);
  const seconds = Math.round(abs / 1000);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  let unit: string;
  if (seconds < 60) unit = "just now";
  else if (minutes < 60) unit = `${minutes}m`;
  else if (hours < 48) unit = `${hours}h`;
  else unit = `${days}d`;

  if (unit === "just now") return unit;
  return delta >= 0 ? `in ${unit}` : `${unit} ago`;
}

/** Duration given a millisecond value (e.g. durationMs). */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin ? `${hours}h ${remMin}m` : `${hours}h`;
}

/** Duration between two unix-ms timestamps. */
export function formatDurationBetween(start: number | null | undefined, end: number | null | undefined): string {
  if (start == null || end == null) return "—";
  return formatDurationMs(Math.max(0, end - start));
}

/** Truncate long strings for list rows. */
export function truncateText(text: string, max = 140): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}
