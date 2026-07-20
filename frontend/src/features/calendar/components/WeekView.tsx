import { Bot, GitBranch } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../../lib/utils.ts";
import { HOUR_H, HOURS, WEEKDAYS_LETTER } from "../constants.ts";
import { addDays, toDateKey } from "../dateUtils.ts";
import type { CalendarEvent } from "../types.ts";
import EventChip from "./EventChip.tsx";

export default function WeekView({
  weekStart,
  today,
  events,
  onSlotClick,
  onEventClick,
}: {
  weekStart: Date;
  today: Date;
  events: CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const todayKey = toDateKey(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_H - 20;
    }
  }, []);

  const byDateHour = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!ev.startTime) continue;
      const hour = parseInt(ev.startTime.split(":")[0]!, 10);
      const k = `${ev.date}:${hour}`;
      (m[k] ??= []).push(ev);
    }
    return m;
  }, [events]);

  const allDayByDate = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (ev.allDay || !ev.startTime) (m[ev.date] ??= []).push(ev);
    }
    return m;
  }, [events]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day header */}
      <div className="flex border-b border-primary shrink-0">
        <div className="w-14 shrink-0" />
        {days.map(day => {
          const key = toDateKey(day);
          const isToday = key === todayKey;
          return (
            <div key={key} className="flex-1 py-2 text-center border-l border-primary">
              <div className={cn("text-2xs font-medium uppercase tracking-wider", isToday ? "text-sky-500" : "text-muted")}>
                {WEEKDAYS_LETTER[day.getDay()]}
              </div>
              <div
                className={cn(
                  "text-sm font-bold mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full",
                  isToday ? "bg-sky-500 text-white" : "text-primary",
                )}
              >
                {day.getDate()}
              </div>
              {/* All-day events */}
              <div className="mt-1 px-1 space-y-0.5 min-h-1">
                {(allDayByDate[key] ?? []).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} compact />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ height: `${24 * HOUR_H}px` }}>
          {/* Hour labels */}
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
          {/* Day columns */}
          {days.map(day => {
            const dayKey = toDateKey(day);
            return (
              <div key={dayKey} className="flex-1 relative border-l border-primary">
                {HOURS.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(day, h)}
                    className="absolute left-0 right-0 border-b border-primary/40 hover:bg-sky-500/5 cursor-pointer transition-colors"
                    style={{ top: `${h * HOUR_H}px`, height: `${HOUR_H}px` }}
                  />
                ))}
                {/* Events */}
                {Object.entries(byDateHour)
                  .filter(([k]) => k.startsWith(dayKey))
                  .flatMap(([, evs]) => evs)
                  .map(ev => {
                    const [h, min] = ev.startTime!.split(":").map(Number) as [number, number];
                    const [eh, emin] = ev.endTime ? (ev.endTime.split(":").map(Number) as [number, number]) : [h + 1, min];
                    const top = (h + min / 60) * HOUR_H;
                    const height = Math.max((eh - h + (emin - min) / 60) * HOUR_H, 20);
                    return (
                      <button
                        type="button"
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        className={cn(
                          "absolute left-1 right-1 rounded px-1.5 py-0.5 text-white text-2xs font-medium cursor-pointer hover:opacity-90 transition-opacity text-left overflow-hidden",
                          ev.color,
                        )}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="flex items-center gap-1 truncate">
                          {ev.type === "workflow" ? <GitBranch size={8} className="shrink-0" /> : <Bot size={8} className="shrink-0" />}
                          {ev.title}
                        </div>
                        {ev.startTime && <div className="text-white/70">{ev.startTime}</div>}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
