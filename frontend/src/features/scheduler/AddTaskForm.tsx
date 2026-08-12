import formatError from "@tokenring-ai/utility/error/formatError";
import { Plus, X } from "lucide-react";
import type { SubmitEvent } from "react";
import { useMemo, useState } from "react";
import FormActionBar from "../../components/ui/FormActionBar.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { schedulerRPCClient } from "../../rpc.ts";
import { COMMON_TIMEZONES, isValidRepeatInterval, parseTimeOfDayMinutes, REPEAT_PRESETS, WEEKDAY_OPTIONS } from "./formatters.ts";

type AddTaskFormProps = {
  agentId: string;
  existingNames: string[];
  onCreated: () => void;
  onCancel: () => void;
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function AddTaskForm({ agentId, existingNames, onCreated, onCancel }: AddTaskFormProps) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [repeatPreset, setRepeatPreset] = useState<string>("1 day");
  const [customRepeat, setCustomRepeat] = useState("");
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [timezone, setTimezone] = useState(detectTimezone);
  const [saving, setSaving] = useState(false);

  const timezones = useMemo(() => {
    const tz = detectTimezone();
    const set = new Set<string>([...COMMON_TIMEZONES, tz]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, []);

  const toggleWeekday = (id: string) => {
    setWeekdays(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName) {
      toastManager.error("Task name is required", { duration: 3000 });
      return;
    }
    if (existingNames.includes(trimmedName)) {
      toastManager.error(`A task named "${trimmedName}" already exists`, { duration: 4000 });
      return;
    }
    if (!trimmedMessage) {
      toastManager.error("Task message is required", { duration: 3000 });
      return;
    }

    const repeat = repeatPreset === "custom" ? customRepeat.trim() || undefined : repeatPreset === "" ? undefined : repeatPreset;

    if (repeatPreset === "custom" && !repeat) {
      toastManager.error("Enter a custom interval (e.g. 2 hours)", { duration: 3000 });
      return;
    }
    if (repeat && !isValidRepeatInterval(repeat)) {
      toastManager.error('Interval must look like "2 hours", "30 minutes", or "1 day"', { duration: 4000 });
      return;
    }

    const afterTrimmed = after.trim();
    const beforeTrimmed = before.trim();
    if (afterTrimmed) {
      const afterMins = parseTimeOfDayMinutes(afterTrimmed);
      if (afterMins == null) {
        toastManager.error("Earliest time must be a valid time (HH:mm)", { duration: 3000 });
        return;
      }
    }
    if (beforeTrimmed) {
      const beforeMins = parseTimeOfDayMinutes(beforeTrimmed);
      if (beforeMins == null) {
        toastManager.error("Latest time must be a valid time (HH:mm)", { duration: 3000 });
        return;
      }
    }
    if (afterTrimmed && beforeTrimmed) {
      const afterMins = parseTimeOfDayMinutes(afterTrimmed)!;
      const beforeMins = parseTimeOfDayMinutes(beforeTrimmed)!;
      if (afterMins >= beforeMins) {
        toastManager.error("Earliest time must be before latest time", { duration: 4000 });
        return;
      }
    }

    const day = dayOfMonth.trim() ? Number(dayOfMonth) : undefined;
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      toastManager.error("Day of month must be a whole number between 1 and 31", { duration: 3000 });
      return;
    }

    setSaving(true);
    try {
      const result = await schedulerRPCClient.addTask({
        agentId,
        name: trimmedName,
        task: {
          message: trimmedMessage,
          lastRunTime: 0,
          ...(repeat ? { repeat } : {}),
          ...(afterTrimmed ? { after: afterTrimmed } : {}),
          ...(beforeTrimmed ? { before: beforeTrimmed } : {}),
          ...(weekdays.length > 0 ? { weekdays: weekdays.join(" ") } : {}),
          ...(day != null ? { dayOfMonth: day } : {}),
          ...(timezone ? { timezone } : {}),
        },
      });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      toastManager.success(result.message, { duration: 3000 });
      onCreated();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent transition-all";

  return (
    <form onSubmit={e => void handleSubmit(e)} className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">Add scheduled task</h3>
          <p className="text-xs text-muted mt-0.5">Runs on this agent when the scheduler is active</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1.5 text-muted hover:text-primary rounded-md focus-ring cursor-pointer" aria-label="Cancel">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted">Task name</span>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Daily standup brief" className={inputClass} autoFocus required />
        </label>

        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted">Message / prompt</span>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Summarize overnight CI failures and open a draft status update."
            rows={3}
            className={cn(inputClass, "resize-y min-h-[4.5rem]")}
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Repeat</span>
          <select value={repeatPreset} onChange={e => setRepeatPreset(e.target.value)} className={inputClass}>
            {REPEAT_PRESETS.map(p => (
              <option key={p.value || "once"} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {repeatPreset === "custom" ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Custom interval</span>
            <input
              type="text"
              value={customRepeat}
              onChange={e => setCustomRepeat(e.target.value)}
              placeholder="2 hours"
              className={inputClass}
              aria-describedby="custom-interval-hint"
            />
            <span id="custom-interval-hint" className="text-xs text-muted">
              Format: number + unit (e.g. 15 minutes, 2 hours, 1 day)
            </span>
          </label>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Timezone</span>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass}>
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        )}

        {repeatPreset === "custom" ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Timezone</span>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputClass}>
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Earliest time (HH:mm)</span>
          <input type="time" value={after} onChange={e => setAfter(e.target.value)} className={inputClass} />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Latest time (HH:mm)</span>
          <input type="time" value={before} onChange={e => setBefore(e.target.value)} className={inputClass} />
        </label>

        <div className="sm:col-span-2 space-y-1.5">
          <span className="text-xs font-medium text-muted">Weekdays (optional)</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map(day => {
              const active = weekdays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleWeekday(day.id)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md border transition-colors focus-ring cursor-pointer",
                    active
                      ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-300"
                      : "bg-tertiary border-primary text-muted hover:text-primary",
                  )}
                  aria-pressed={active}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted">Day of month (optional)</span>
          <input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} placeholder="e.g. 1" className={inputClass} />
        </label>
      </div>

      <FormActionBar onCancel={onCancel} submitLabel="Add task" submitIcon={Plus} loading={saving} variant="indigo" />
    </form>
  );
}
