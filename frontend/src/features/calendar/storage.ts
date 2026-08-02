import { isValidDateKey } from "./dateUtils.ts";
import type { CalendarEvent } from "./types.ts";

export const STORAGE_KEY = "tokenring:calendar:events";

function isCalendarEvent(value: unknown): value is CalendarEvent {
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

export function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
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

export function saveEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Quota or private mode — ignore; in-memory state still works for the session
  }
}
