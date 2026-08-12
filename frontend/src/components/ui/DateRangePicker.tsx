import { RefreshCw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils.ts";

export interface DateRange {
  /** ISO date string (YYYY-MM-DD) */
  from: string;
  /** ISO date string (YYYY-MM-DD) */
  to: string;
}

export interface DateRangePreset {
  label: string;
  /** Number of days before today for the start date (end is always today) */
  days: number;
}

export interface DateRangePickerProps {
  /** Current date range (applied / external value) */
  value: DateRange;
  /** Called when the range is applied (passes a validated range) */
  onChange: (range: DateRange) => void;
  /** Visible label for the start date input */
  fromLabel?: string;
  /** Visible label for the end date input */
  toLabel?: string;
  /** Text between the two date inputs (default: "to") */
  separator?: string;
  /** Label for the apply button (default: "Apply") */
  applyLabel?: string;
  /**
   * Maximum allowed range in calendar days (difference between to and from).
   * `null` or omitted means unlimited.
   */
  maxDays?: number | null;
  /** Preset quick-select buttons (e.g. "7D", "30D", "90D") */
  presets?: DateRangePreset[];
  /**
   * When true, valid draft changes apply immediately and the Apply button is hidden.
   * Preset clicks always apply immediately regardless of this flag.
   */
  autoApply?: boolean;
  /** Optional className for the outer wrapper */
  className?: string;
  /** aria-label for the start date input */
  fromAriaLabel?: string;
  /** aria-label for the end date input */
  toAriaLabel?: string;
  "data-testid"?: string;
}

const inputClassName = "text-xs bg-secondary border border-primary rounded-lg px-3 py-1.5 text-primary focus:border-accent outline-none";

/** Format a Date as local calendar YYYY-MM-DD (avoids UTC skew from toISOString). */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO date (YYYY-MM-DD) offset by `days` from a base date (local calendar). */
function isoDateOffset(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return toLocalIsoDate(d);
}

/** Parse YYYY-MM-DD as a local calendar date; returns null if invalid. */
function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  // Reject non-canonical values (e.g. 2026-02-31 rolling into March)
  if (toLocalIsoDate(d) !== iso.trim()) return null;
  return d;
}

/** Whole calendar days between two ISO dates (to − from). */
function dayDiff(from: string, to: string): number | null {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function validateDateRange(range: DateRange, maxDays?: number | null): string | null {
  if (!range.from || !range.to) {
    return "Select both start and end dates";
  }
  if (!parseIsoDate(range.from) || !parseIsoDate(range.to)) {
    return "Invalid date range";
  }
  if (range.from > range.to) {
    return "Start date must be on or before end date";
  }
  if (maxDays != null && maxDays >= 0) {
    const diff = dayDiff(range.from, range.to);
    if (diff != null && diff > maxDays) {
      return `Range cannot exceed ${maxDays} day${maxDays === 1 ? "" : "s"}`;
    }
  }
  return null;
}

/**
 * Paired start/end date inputs with validation, optional presets, and an apply button.
 * Draft edits are local until Apply (unless autoApply is set); errors clear on input.
 */
export default function DateRangePicker({
  value,
  onChange,
  fromLabel,
  toLabel,
  separator = "to",
  applyLabel = "Apply",
  maxDays = null,
  presets,
  autoApply = false,
  className,
  fromAriaLabel = "Start date",
  toAriaLabel = "End date",
  "data-testid": testId,
}: DateRangePickerProps) {
  const baseId = useId();
  const fromId = `${baseId}-from`;
  const toId = `${baseId}-to`;
  const errorId = `${baseId}-error`;

  const [draft, setDraft] = useState<DateRange>(value);
  const [error, setError] = useState<string | null>(null);

  // Keep draft in sync when the external value changes (e.g. parent reset).
  useEffect(() => {
    setDraft(value);
  }, [value.from, value.to]);

  const commit = (next: DateRange): boolean => {
    const message = validateDateRange(next, maxDays);
    if (message) {
      setError(message);
      return false;
    }
    setError(null);
    onChange(next);
    return true;
  };

  const updateDraft = (patch: Partial<DateRange>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(null);
    if (autoApply) {
      // Only commit when the range is complete and valid; leave incomplete ranges silent.
      const message = validateDateRange(next, maxDays);
      if (!message) {
        onChange(next);
      }
    }
  };

  const handleApply = () => {
    commit(draft);
  };

  const handlePreset = (days: number) => {
    const next: DateRange = {
      from: isoDateOffset(-days),
      to: isoDateOffset(0),
    };
    setDraft(next);
    commit(next);
  };

  const hasLabels = Boolean(fromLabel || toLabel);

  return (
    <div className={cn("space-y-1", className)} data-testid={testId}>
      <div className="flex items-center gap-2 flex-wrap">
        {presets && presets.length > 0 ? (
          <div className="flex items-center gap-1" role="group" aria-label="Date range presets">
            {presets.map(preset => (
              <button
                key={`${preset.label}-${preset.days}`}
                type="button"
                onClick={() => handlePreset(preset.days)}
                className="px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md hover:bg-hover transition-colors cursor-pointer focus-ring"
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className={cn("flex items-center gap-2 flex-wrap", hasLabels && "items-end")}>
          <div className="flex flex-col gap-0.5">
            {fromLabel ? (
              <label htmlFor={fromId} className="text-xs text-muted">
                {fromLabel}
              </label>
            ) : null}
            <input
              id={fromId}
              type="date"
              value={draft.from}
              onChange={e => updateDraft({ from: e.target.value })}
              className={inputClassName}
              aria-label={fromAriaLabel}
              aria-invalid={error != null}
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          <span className={cn("text-xs text-muted", hasLabels && "pb-1.5")}>{separator}</span>

          <div className="flex flex-col gap-0.5">
            {toLabel ? (
              <label htmlFor={toId} className="text-xs text-muted">
                {toLabel}
              </label>
            ) : null}
            <input
              id={toId}
              type="date"
              value={draft.to}
              onChange={e => updateDraft({ to: e.target.value })}
              className={inputClassName}
              aria-label={toAriaLabel}
              aria-invalid={error != null}
              aria-describedby={error ? errorId : undefined}
            />
          </div>

          {!autoApply ? (
            <button
              type="button"
              onClick={handleApply}
              className={cn(
                "px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 focus-ring",
                hasLabels && "mb-0",
              )}
            >
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
              {applyLabel}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div id={errorId} role="alert" className="py-1 text-center text-red-400 text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
