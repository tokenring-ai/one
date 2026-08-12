import { isValidDateKey } from "./dateUtils.ts";
import type { CalendarEvent } from "./types.ts";

export const STORAGE_KEY = "tokenring:calendar:events";

export function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    typeof e.date === "string" &&
    isValidDateKey(e.date) &&
    typeof e.type === "string" &&
    typeof e.color === "string"
  );
}

/** Validate and normalize events loaded from localStorage. */
export function deserializeCalendarEvents(raw: string): CalendarEvent[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCalendarEvent).map(e => ({
      ...e,
      source: e.source === "rpc" ? "local" : (e.source ?? "local"),
    }));
  } catch {
    return [];
  }
}
