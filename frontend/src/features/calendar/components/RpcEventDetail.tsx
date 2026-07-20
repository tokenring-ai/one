import { Calendar, CalendarDays, MapPin, X } from "lucide-react";
import type { CalendarEvent } from "../types.ts";

export default function RpcEventDetail({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-primary border border-primary rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={16} className="shrink-0 text-accent" />
            <h2 className="text-base font-bold text-primary truncate">{event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={14} className="shrink-0" />
            <span>
              {event.date}
              {event.allDay ? " · All day" : event.startTime ? ` · ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : ""}
            </span>
          </div>
          {event.location && (
            <div className="flex items-start gap-2 text-sm text-muted">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && <p className="text-xs text-primary/80 pt-1 whitespace-pre-wrap">{event.description}</p>}
        </div>
      </div>
    </div>
  );
}
