/** Local calendar date key YYYY-MM-DD */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UTC calendar date key YYYY-MM-DD (for all-day events stored as UTC midnight). */
export function toUtcDateKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** True when value is a YYYY-MM-DD calendar date. */
export function isValidDateKey(date: string | undefined): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return false;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Reject impossible days (e.g. 2026-02-31)
  const check = new Date(y, mo - 1, d);
  return check.getFullYear() === y && check.getMonth() === mo - 1 && check.getDate() === d;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  // Normalize to local midnight so range math is stable
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Parse "HH:MM" into hours and minutes; returns null if invalid. */
export function parseTime(time: string | undefined): { h: number; m: number } | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/**
 * Duration in hours for a timed event within a day column.
 * Overnight ends (end clock time ≤ start) span until midnight.
 */
export function eventDurationHours(startTime: string, endTime?: string): number {
  const start = parseTime(startTime);
  if (!start) return 1;
  const end = endTime ? parseTime(endTime) : null;
  if (!end) return 1;
  let hours = end.h - start.h + (end.m - start.m) / 60;
  if (hours <= 0) {
    // Overnight or zero-length: show until end of day
    hours = 24 - start.h - start.m / 60;
  }
  return Math.max(hours, 1 / 60);
}

/**
 * Build ISO start/end datetimes from a local event date + optional times.
 *
 * All-day events use UTC midnight → next UTC midnight so date-only providers
 * (e.g. Google Calendar via toISOString().slice(0,10)) keep the calendar day
 * independent of the user's timezone.
 *
 * Timed events use local wall-clock time; missing endTime defaults to +1 hour.
 */
export function eventRangeToIso(opts: { date: string; allDay?: boolean; startTime?: string; endTime?: string }): { startAt: string; endAt: string } {
  if (!isValidDateKey(opts.date)) {
    throw new Error(`Invalid event date: ${opts.date as string}`);
  }

  const [y, mo, d] = opts.date.split("-").map(Number) as [number, number, number];

  if (opts.allDay || !opts.startTime) {
    // UTC midnight of the calendar date — survives provider date-only conversion
    const startAt = `${opts.date}T00:00:00.000Z`;
    const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
    return { startAt, endAt: end.toISOString() };
  }

  const startParts = parseTime(opts.startTime) ?? { h: 9, m: 0 };
  const start = new Date(y, mo - 1, d, startParts.h, startParts.m, 0, 0);

  let end: Date;
  const endParts = parseTime(opts.endTime);
  if (endParts) {
    end = new Date(y, mo - 1, d, endParts.h, endParts.m, 0, 0);
    // If end is not after start, treat as next-day end (or at least +1 hour)
    if (end.getTime() <= start.getTime()) {
      end = new Date(y, mo - 1, d + 1, endParts.h, endParts.m, 0, 0);
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
    }
  } else {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

/** Add one hour to an "HH:MM" string (wraps within the day for display defaults). */
export function addOneHour(time: string): string {
  const parts = parseTime(time);
  if (!parts) return "10:00";
  const total = parts.h * 60 + parts.m + 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes since midnight for an "HH:MM" string; 0 if invalid. */
export function timeToMinutes(time: string): number {
  const parts = parseTime(time);
  if (!parts) return 0;
  return parts.h * 60 + parts.m;
}

export type EventLayoutSlot = {
  /** 0-based column index within the overlapping cluster */
  col: number;
  /** Total concurrent columns in this cluster */
  totalCols: number;
};

/**
 * Assign horizontal columns for timed events that overlap within a single day.
 * Non-overlapping clusters get independent column counts so events can use full width.
 */
export function layoutOverlappingEvents(events: Array<{ id: string; startTime?: string; endTime?: string }>): Map<string, EventLayoutSlot> {
  const timed = events.filter((e): e is { id: string; startTime: string; endTime?: string } => Boolean(e.startTime));
  const getEnd = (ev: { startTime: string; endTime?: string }) => {
    const start = timeToMinutes(ev.startTime);
    if (!ev.endTime) return start + 60;
    const end = timeToMinutes(ev.endTime);
    // Overnight or zero-length: treat as at least 1 minute so packing still works
    return end > start ? end : start + 1;
  };

  const sorted = [...timed].sort((a, b) => {
    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);
    if (aStart !== bStart) return aStart - bStart;
    // Longer events first for more stable packing
    return getEnd(b) - getEnd(a);
  });

  // Group into clusters where consecutive events overlap (transitive)
  const clusters: (typeof timed)[] = [];
  let current: (typeof timed)[number][] = [];
  let clusterEnd = -1;

  for (const ev of sorted) {
    const start = timeToMinutes(ev.startTime);
    const end = getEnd(ev);
    if (current.length === 0 || start < clusterEnd) {
      current.push(ev);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      clusters.push(current);
      current = [ev];
      clusterEnd = end;
    }
  }
  if (current.length > 0) clusters.push(current);

  const layout = new Map<string, EventLayoutSlot>();

  for (const cluster of clusters) {
    // Greedy: place each event in the first free column
    const colEnds: number[] = [];
    const colById = new Map<string, number>();

    for (const ev of cluster) {
      const start = timeToMinutes(ev.startTime);
      const end = getEnd(ev);
      let col = colEnds.findIndex(ce => ce <= start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(end);
      } else {
        colEnds[col] = end;
      }
      colById.set(ev.id, col);
    }

    const totalCols = Math.max(colEnds.length, 1);
    for (const [id, col] of colById) {
      layout.set(id, { col, totalCols });
    }
  }

  return layout;
}
