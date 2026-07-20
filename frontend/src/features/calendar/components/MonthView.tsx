import { useMemo } from "react";
import { cn } from "../../../lib/utils.ts";
import { WEEKDAYS_SHORT } from "../constants.ts";
import { addDays, startOfWeek, toDateKey } from "../dateUtils.ts";
import type { CalendarEvent } from "../types.ts";
import EventChip from "./EventChip.tsx";

export default function MonthView({
  year,
  month,
  today,
  events,
  onDayClick,
  onEventClick,
}: {
  year: number;
  month: number;
  today: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const todayKey = toDateKey(today);

  // Build 6-row × 7-col grid
  const firstOfMonth = new Date(year, month, 1);
  const startDay = startOfWeek(firstOfMonth);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(startDay, i));

  const byDate = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      (m[ev.date] ??= []).push(ev);
    }
    return m;
  }, [events]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-primary">
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-2xs font-semibold text-muted uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      {/* Date grid */}
      <div className="grid grid-cols-7 flex-1 min-h-0 overflow-y-auto">
        {cells.map((cell, i) => {
          const key = toDateKey(cell);
          const isToday = key === todayKey;
          const isCurrentMonth = cell.getMonth() === month;
          const dayEvents = byDate[key] ?? [];
          const showMax = 3;
          const overflow = dayEvents.length - showMax;
          return (
            <div
              key={i}
              onClick={() => onDayClick(cell)}
              className={cn(
                "border-b border-r border-primary min-h-20 p-1 cursor-pointer hover:bg-hover transition-colors",
                i % 7 === 0 && "border-l-0",
                !isCurrentMonth && "bg-secondary/40",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-sky-500 text-white font-bold",
                    !isToday && isCurrentMonth && "text-primary",
                    !isToday && !isCurrentMonth && "text-muted",
                  )}
                >
                  {cell.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, showMax).map(ev => (
                  <EventChip key={ev.id} event={ev} onClick={() => onEventClick(ev)} />
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDayClick(cell);
                    }}
                    className="text-2xs text-muted hover:text-primary transition-colors w-full text-left px-1"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
