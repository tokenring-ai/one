import type { CalendarEventSchema } from "@tokenring-ai/calendar/CalendarProvider";
import type { z } from "zod";
import { toDateKey, toUtcDateKey } from "./dateUtils.ts";
import type { CalendarEvent } from "./types.ts";

export function rpcToLocalEvent(ev: z.output<typeof CalendarEventSchema>, provider: string): CalendarEvent {
  const start = new Date(ev.startAt);
  const end = new Date(ev.endAt);
  const allDay = ev.allDay ?? false;
  const fmt = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  // Providers store all-day starts as UTC midnight of the calendar date
  // (see GoogleCalendarProvider.parseGoogleDate). Using local getDate() would
  // shift western-hemisphere users to the previous day.
  const date = allDay ? toUtcDateKey(start) : toDateKey(start);

  return {
    id: ev.id,
    title: ev.title,
    date,
    ...(!allDay && {
      startTime: fmt(start.getHours(), start.getMinutes()),
      endTime: fmt(end.getHours(), end.getMinutes()),
    }),
    allDay,
    type: "calendar",
    color: "bg-accent",
    source: "rpc",
    provider,
    ...(ev.description && {
      description: ev.description,
    }),
    ...(ev.location && {
      location: ev.location,
    }),
  };
}
