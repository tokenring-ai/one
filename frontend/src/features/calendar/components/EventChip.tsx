import { Bot, Calendar, GitBranch } from "lucide-react";
import { cn } from "../../../lib/utils.ts";
import type { CalendarEvent } from "../types.ts";

export default function EventChip({ event, onClick, compact = false }: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const TypeIcon = event.type === "workflow" ? GitBranch : event.type === "calendar" ? Calendar : Bot;
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-left cursor-pointer hover:opacity-90 transition-opacity truncate",
        event.color,
        compact ? "text-2xs" : "text-xs",
      )}
      aria-label={`Event: ${event.title}`}
    >
      <TypeIcon className="shrink-0" size={compact ? 8 : 10} />
      <span className="truncate">
        {compact ? "" : event.startTime ? `${event.startTime} ` : ""}
        {event.title}
      </span>
    </button>
  );
}
