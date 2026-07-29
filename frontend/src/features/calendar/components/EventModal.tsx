import { Bot, Calendar, Clock, GitBranch, Loader2, MapPin, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { useAgentTypes, useWorkflows } from "../../../rpc.ts";
import { EVENT_COLORS } from "../constants.ts";
import { addOneHour } from "../dateUtils.ts";
import type { CalendarEvent, CalendarEventType } from "../types.ts";

export interface EventModalProps {
  event: CalendarEvent | null;
  defaultDate: string;
  defaultHour: number | null;
  /** When set, calendar-type events can be saved to this provider via RPC */
  provider: string | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void | Promise<void>;
  onDelete: (event: CalendarEvent) => void | Promise<void>;
  onRun: (event: CalendarEvent) => void;
  running: boolean;
  saving?: boolean;
}

export default function EventModal({ event, defaultDate, defaultHour, provider, onClose, onSave, onDelete, onRun, running, saving = false }: EventModalProps) {
  const agentTypes = useAgentTypes();
  const workflows = useWorkflows();

  const isNew = !event;
  const isRpc = event?.source === "rpc";
  const defaultTime = defaultHour != null ? `${String(defaultHour).padStart(2, "0")}:00` : undefined;

  // RPC events are always calendar-type; prefer calendar when a provider is available
  const defaultType: CalendarEventType = isRpc ? "calendar" : (event?.type ?? (provider ? "calendar" : "workflow"));

  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(event?.startTime ?? defaultTime ?? "09:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? (defaultTime ? addOneHour(defaultTime) : "10:00"));
  const [allDay, setAllDay] = useState(event?.allDay ?? !defaultTime);
  const [type, setType] = useState<CalendarEventType>(defaultType);
  const [agentType, setAgentType] = useState(event?.agentType ?? "");
  const [workflowKey, setWorkflowKey] = useState(event?.workflowKey ?? "");
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0]!.value);
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [busy, setBusy] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const disabled = busy || saving || running;

  const handleSave = async () => {
    if (!title.trim()) {
      toastManager.error("Title is required");
      return;
    }
    if (type === "workflow" && !workflowKey) {
      toastManager.error("Select a workflow");
      return;
    }
    if (type === "agent" && !agentType) {
      toastManager.error("Select an agent type");
      return;
    }
    if (!allDay && !startTime) {
      toastManager.error("Start time is required");
      return;
    }

    // Existing RPC events stay on the provider; new calendar events go to provider when available
    const useRpc = isRpc || (isNew && type === "calendar" && Boolean(provider));
    const next: CalendarEvent = {
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      date,
      ...(!allDay && startTime && { startTime }),
      ...(!allDay && endTime && { endTime }),
      allDay,
      type,
      color,
      source: useRpc ? "rpc" : "local",
      ...(useRpc && { provider: event?.provider ?? provider! }),
      ...(type === "agent" && { agentType }),
      ...(type === "workflow" && { workflowKey }),
      ...(description.trim() && { description: description.trim() }),
      ...(location.trim() && { location: location.trim() }),
    };

    setBusy(true);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const ok = window.confirm(`Delete “${event.title}”? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    try {
      await onDelete(event);
    } finally {
      setBusy(false);
    }
  };

  const showRun = !isNew && !isRpc && (type === "workflow" || type === "agent");
  const typeLocked = isRpc; // provider events stay calendar-type

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-primary border border-primary rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0 shrink-0">
          <h2 className="text-base font-bold text-primary">{isNew ? "New Event" : isRpc ? "Edit Calendar Event" : "Edit Event"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Title</label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void handleSave()}
              placeholder="Event title…"
              disabled={disabled}
              className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Date + All-day */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={disabled}
                className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
              />
            </div>
            <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} disabled={disabled} className="rounded accent-sky-500" />
              <span className="text-xs text-primary">All day</span>
            </label>
          </div>

          {/* Time */}
          {!allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
                />
              </div>
              <div className="flex-1">
                <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Type — locked for RPC events */}
          {!typeLocked && (
            <div>
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Event type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType("calendar")}
                  disabled={disabled}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer disabled:opacity-50",
                    type === "calendar" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-primary text-muted hover:border-sky-500/40 hover:text-primary",
                  )}
                >
                  <Calendar size={14} /> Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setType("workflow")}
                  disabled={disabled}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer disabled:opacity-50",
                    type === "workflow" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-primary text-muted hover:border-sky-500/40 hover:text-primary",
                  )}
                >
                  <GitBranch size={14} /> Workflow
                </button>
                <button
                  type="button"
                  onClick={() => setType("agent")}
                  disabled={disabled}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer disabled:opacity-50",
                    type === "agent" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-primary text-muted hover:border-sky-500/40 hover:text-primary",
                  )}
                >
                  <Bot size={14} /> Agent
                </button>
              </div>
              {type === "calendar" && (
                <p className="text-2xs text-muted mt-1.5">
                  {provider ? `Saves to provider “${provider}”.` : "No calendar provider connected — saved locally only."}
                </p>
              )}
            </div>
          )}

          {/* Calendar fields */}
          {type === "calendar" && (
            <>
              <div>
                <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={10} /> Location
                  </span>
                </label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Optional location…"
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional notes…"
                  rows={3}
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors resize-y disabled:opacity-50"
                />
              </div>
            </>
          )}

          {/* Workflow / Agent selector */}
          {type === "workflow" && (
            <div>
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Workflow</label>
              {workflows.isLoading ? (
                <div className="flex items-center gap-2 text-muted text-xs py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (workflows.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted py-1">
                  No workflows defined in <code>.tokenring/workflows/</code>
                </p>
              ) : (
                <select
                  value={workflowKey}
                  onChange={e => setWorkflowKey(e.target.value)}
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
                >
                  <option value="">Select a workflow…</option>
                  {workflows.data!.map(w => (
                    <option key={w.name} value={w.name}>
                      {w.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {type === "agent" && (
            <div>
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Agent type</label>
              {agentTypes.isLoading ? (
                <div className="flex items-center gap-2 text-muted text-xs py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (agentTypes.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted py-1">No agent types available.</p>
              ) : (
                <select
                  value={agentType}
                  onChange={e => setAgentType(e.target.value)}
                  disabled={disabled}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors disabled:opacity-50"
                >
                  <option value="">Select an agent type…</option>
                  {agentTypes.data?.map(t => (
                    <option key={t.type} value={t.type}>
                      {t.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Color — local display color (RPC events keep accent) */}
          {!isRpc && (
            <div>
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Color</label>
              <div className="flex gap-2">
                {EVENT_COLORS.map(c => (
                  <button
                    type="button"
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    disabled={disabled}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all cursor-pointer focus:outline-none disabled:opacity-50",
                      c.value,
                      color === c.value ? "ring-2 ring-offset-2 ring-offset-primary ring-white/70 scale-110" : "hover:scale-105",
                    )}
                    aria-label={c.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2 shrink-0 border-t border-primary pt-3">
          {showRun && (
            <button
              type="button"
              onClick={() => onRun(event!)}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
              Run now
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {(busy || saving) && <Loader2 size={13} className="animate-spin" />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
