import { Bot, Clock, GitBranch, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { cn } from "../../../lib/utils.ts";
import { useAgentTypes, useWorkflows } from "../../../rpc.ts";
import { EVENT_COLORS } from "../constants.ts";
import type { CalendarEvent } from "../types.ts";

export interface EventModalProps {
  event: CalendarEvent | null;
  defaultDate: string;
  defaultHour: number | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onRun: (event: CalendarEvent) => void;
  running: boolean;
}

export default function EventModal({ event, defaultDate, defaultHour, onClose, onSave, onDelete, onRun, running }: EventModalProps) {
  const agentTypes = useAgentTypes();
  const workflows = useWorkflows();

  const isNew = !event;
  const defaultTime = defaultHour != null ? `${String(defaultHour).padStart(2, "0")}:00` : undefined;

  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(event?.startTime ?? defaultTime ?? "09:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? !defaultTime);
  const [type, setType] = useState<"agent" | "workflow" | "calendar">(event?.type ?? "workflow");
  const [agentType, setAgentType] = useState(event?.agentType ?? "");
  const [workflowKey, setWorkflowKey] = useState(event?.workflowKey ?? "");
  const [color, setColor] = useState(event?.color ?? EVENT_COLORS[0]!.value);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = () => {
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
    onSave({
      id: event?.id ?? crypto.randomUUID(),
      title: title.trim(),
      date,
      ...(!allDay && startTime && { startTime }),
      ...(!allDay && endTime && { endTime }),
      allDay,
      type,
      ...(type === "agent" && { agentType }),
      ...(type === "workflow" && { workflowKey }),
      color,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-primary border border-primary rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 className="text-base font-bold text-primary">{isNew ? "New Scheduled Event" : "Edit Event"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Title</label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="Event title…"
              className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
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
                className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="rounded accent-sky-500" />
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
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Type */}
          <div>
            <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Run type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("workflow")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                  type === "workflow" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-primary text-muted hover:border-sky-500/40 hover:text-primary",
                )}
              >
                <GitBranch size={14} /> Workflow
              </button>
              <button
                type="button"
                onClick={() => setType("agent")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                  type === "agent" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-primary text-muted hover:border-sky-500/40 hover:text-primary",
                )}
              >
                <Bot size={14} /> Agent
              </button>
            </div>
          </div>

          {/* Workflow / Agent selector */}
          {type === "workflow" ? (
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
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
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
          ) : (
            <div>
              <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">Agent type</label>
              {agentTypes.isLoading ? (
                <div className="flex items-center gap-2 text-muted text-xs py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  value={agentType}
                  onChange={e => setAgentType(e.target.value)}
                  className="w-full bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-colors"
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

          {/* Color */}
          <div>
            <label className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Color</label>
            <div className="flex gap-2">
              {EVENT_COLORS.map(c => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all cursor-pointer focus:outline-none",
                    c.value,
                    color === c.value ? "ring-2 ring-offset-2 ring-offset-primary ring-white/70 scale-110" : "hover:scale-105",
                  )}
                  aria-label={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={() => onRun(event!)}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
              Run now
            </button>
          )}
          {!isNew && (
            <button
              type="button"
              onClick={() => onDelete(event!.id)}
              className="flex items-center gap-1.5 px-3 py-2 border border-rose-500/40 hover:bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
