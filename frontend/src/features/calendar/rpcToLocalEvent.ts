import type { CalendarEventSchema } from "@tokenring-ai/calendar/CalendarProvider";
import type { z } from "zod";
import { toDateKey } from "./dateUtils.ts";
import type { CalendarEvent } from "./types.ts";

export function rpcToLocalEvent(ev: z.output<typeof CalendarEventSchema>): CalendarEvent {
  const start = new Date(ev.startAt);
  const end = new Date(ev.endAt);
  const fmt = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return {
    id: ev.id,
    title: ev.title,
    date: toDateKey(start),
    ...(!ev.allDay && {
      startTime: fmt(start.getHours(), start.getMinutes()),
      endTime: fmt(end.getHours(), end.getMinutes()),
    }),
    allDay: ev.allDay ?? false,
    type: "calendar",
    color: "bg-accent",
    source: "rpc",
    ...(ev.description && {
      description: ev.description,
    }),
    ...(ev.location && {
      location: ev.location,
    }),
  };
}
