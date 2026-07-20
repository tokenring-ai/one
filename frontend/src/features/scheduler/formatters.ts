/** Format a unix-ms timestamp for schedule UI display. */
export function formatScheduleTime(ts: number | null | undefined, opts?: { withSeconds?: boolean }): string {
  if (ts == null || ts <= 0) return "—";
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(opts?.withSeconds ? { second: "2-digit" } : {}),
  });
}

/** Relative phrase for next/last run times. */
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

/** Human summary of schedule constraints. */
export function formatScheduleSummary(task: {
  repeat?: string | undefined;
  after?: string | undefined;
  before?: string | undefined;
  weekdays?: string | undefined;
  dayOfMonth?: number | undefined;
  timezone?: string | undefined;
}): string {
  const parts: string[] = [];
  if (task.repeat) parts.push(`Every ${task.repeat}`);
  else parts.push("One-time");

  if (task.after || task.before) {
    const window = [task.after ?? "…", task.before ?? "…"].join("–");
    parts.push(window);
  }
  if (task.weekdays) parts.push(task.weekdays);
  if (task.dayOfMonth != null) parts.push(`day ${task.dayOfMonth}`);
  if (task.timezone) parts.push(task.timezone);
  return parts.join(" · ");
}

/** Duration between two unix-ms timestamps. */
export function formatDuration(startTime: number, endTime: number): string {
  const ms = Math.max(0, endTime - startTime);
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

/** Truncate long task messages for list rows. */
export function truncateMessage(message: string, max = 120): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export const WEEKDAY_OPTIONS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
] as const;

export const REPEAT_PRESETS = [
  { value: "", label: "One-time" },
  { value: "5 minutes", label: "Every 5 minutes" },
  { value: "15 minutes", label: "Every 15 minutes" },
  { value: "30 minutes", label: "Every 30 minutes" },
  { value: "1 hour", label: "Every hour" },
  { value: "6 hours", label: "Every 6 hours" },
  { value: "1 day", label: "Every day" },
  { value: "1 week", label: "Every week" },
  { value: "custom", label: "Custom interval…" },
] as const;

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
] as const;
