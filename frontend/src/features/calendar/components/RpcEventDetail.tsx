import { Calendar, CalendarDays, Loader2, MapPin, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { CalendarEvent } from "../types.ts";

export default function RpcEventDetail({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    const ok = window.confirm(`Delete “${event.title}”? This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete(event);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!deleting) onClose();
      }}
    >
      <div className="bg-primary border border-primary rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={16} className="shrink-0 text-accent" />
            <h2 className="text-base font-bold text-primary truncate">{event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="shrink-0 p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={14} className="shrink-0" />
            <span>
              {event.date}
              {event.allDay ? " · All day" : event.startTime ? ` · ${event.startTime}${event.endTime ? ` – ${event.endTime}` : ""}` : ""}
            </span>
          </div>
          {event.provider && <p className="text-2xs text-muted">Provider: {event.provider}</p>}
          {event.location && (
            <div className="flex items-start gap-2 text-sm text-muted">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && <p className="text-xs text-primary/80 pt-1 whitespace-pre-wrap">{event.description}</p>}
          {!event.location && !event.description && <p className="text-2xs text-muted italic">No additional details</p>}
        </div>
        <div className="px-5 pb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary transition-colors">
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(event)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
