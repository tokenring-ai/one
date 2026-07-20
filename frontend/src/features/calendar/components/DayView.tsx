import { Bot, GitBranch } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../../lib/utils.ts";
import { HOUR_H, HOURS, MONTHS, WEEKDAYS_SHORT } from "../constants.ts";
import { toDateKey } from "../dateUtils.ts";
import type { CalendarEvent } from "../types.ts";
import EventChip from "./EventChip.tsx";

export default function DayView({
  date,
  today,
  events,
  onSlotClick,
  onEventClick,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const dayKey = toDateKey(date);
  const isToday = dayKey === toDateKey(today);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_H - 20;
  }, []);

  const dayEvents = useMemo(() => events.filter(ev => ev.date === dayKey && ev.startTime), [events, dayKey]);

  const allDay = useMemo(() => events.filter(ev => ev.date === dayKey && (ev.allDay || !ev.startTime)), [events, dayKey]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-primary shrink-0">
        <div className={cn("text-2xl font-bold w-12 h-12 flex items-center justify-center rounded-full", isToday ? "bg-sky-500 text-white" : "text-primary")}>
          {date.getDate()}
        </div>
        <div>
          <div className={cn("text-sm font-semibold", isToday ? "text-sky-500" : "text-primary")}>{WEEKDAYS_SHORT[date.getDay()]}</div>
          <div className="text-2xs text-muted">
            {MONTHS[date.getMonth()]} {date.getFullYear()}
          </div>
        </div>
        {allDay.length > 0 && (
          <div className="ml-4 flex gap-1 flex-wrap">
            {allDay.map(ev => (
              <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} compact />
            ))}
          </div>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${24 * HOUR_H}px` }}>
          <div className="w-14 shrink-0 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start justify-end pr-2 text-2xs text-muted"
                style={{ top: `${h * HOUR_H}px`, height: `${HOUR_H}px` }}
              >
                {h === 0 ? "" : `${h % 12 || 12}${h < 12 ? "am" : "pm"}`}
              </div>
            ))}
          </div>
          <div className="flex-1 relative border-l border-primary">
            {HOURS.map(h => (
              <div
                key={h}
                onClick={() => onSlotClick(date, h)}
                className="absolute left-0 right-0 border-b border-primary/40 hover:bg-sky-500/5 cursor-pointer transition-colors"
                style={{ top: `${h * HOUR_H}px`, height: `${HOUR_H}px` }}
              />
            ))}
            {dayEvents.map(ev => {
              const [h, min] = ev.startTime!.split(":").map(Number) as [number, number];
              const [eh, emin] = ev.endTime ? (ev.endTime.split(":").map(Number) as [number, number]) : [h + 1, min];
              const top = (h + min / 60) * HOUR_H;
              const height = Math.max((eh - h + (emin - min) / 60) * HOUR_H, 24);
              return (
                <button
                  type="button"
                  key={ev.id}
                  onClick={e => {
                    e.stopPropagation();
                    onEventClick(ev);
                  }}
                  className={cn(
                    "absolute left-2 right-2 rounded-lg px-2 py-1 text-white text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity text-left overflow-hidden shadow-sm",
                    ev.color,
                  )}
                  style={{ top: `${top}px`, height: `${height}px` }}
                >
                  <div className="flex items-center gap-1.5 truncate font-semibold">
                    {ev.type === "workflow" ? <GitBranch size={10} className="shrink-0" /> : <Bot size={10} className="shrink-0" />}
                    {ev.title}
                  </div>
                  {ev.startTime && (
                    <div className="text-white/80 text-2xs">
                      {ev.startTime}
                      {ev.endTime ? ` – ${ev.endTime}` : ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
