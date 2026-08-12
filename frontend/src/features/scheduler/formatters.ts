import { formatDurationBetween } from "@tokenring-ai/utility/date/formatDuration";
import { formatRelativeTime as formatRelativeTimeBase } from "@tokenring-ai/utility/date/formatRelativeTime";
import { formatTimestamp } from "@tokenring-ai/utility/date/formatTimestamp";
import { truncateText } from "@tokenring-ai/utility/string/truncateText";

/** Format a unix-ms timestamp for schedule UI display. */
export function formatScheduleTime(ts: number | null | undefined, opts?: { withSeconds?: boolean }): string {
  return formatTimestamp(ts, { ...opts, weekday: true });
}

/** Relative phrase for next/last run times (second-precision "just now"). */
export function formatRelativeTime(ts: number | null | undefined, now = Date.now()): string {
  return formatRelativeTimeBase(ts, { now, precise: true });
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
  if (task.weekdays) {
    // Capitalize weekday tokens for display (mon tue → Mon Tue)
    parts.push(
      task.weekdays
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase())
        .join(" "),
    );
  }
  if (task.dayOfMonth != null) parts.push(`day ${task.dayOfMonth}`);
  if (task.timezone) parts.push(task.timezone);
  return parts.join(" · ");
}

/** Duration between two unix-ms timestamps. */
export function formatDuration(startTime: number, endTime: number): string {
  return formatDurationBetween(startTime, endTime);
}

/** Truncate long task messages for list rows (default max 120 for schedule UI density). */
export function truncateMessage(message: string, max = 120): string {
  return truncateText(message, max);
}

/**
 * Validate a custom repeat interval against the backend parseInterval format:
 * "<number> <unit>" with unit in seconds|minutes|hours|days|weeks|months (singular or plural).
 * Number must be >= 1.
 */
export function isValidRepeatInterval(interval: string): boolean {
  const match = interval.trim().match(/^(\d+)\s+(seconds?|minutes?|hours?|days?|weeks?|months?)$/i);
  if (!match) return false;
  return Number.parseInt(match[1]!, 10) >= 1;
}

/**
 * Compare HH:mm (optional :ss) wall-clock strings. Returns minutes since midnight, or null if invalid.
 */
export function parseTimeOfDayMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
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
