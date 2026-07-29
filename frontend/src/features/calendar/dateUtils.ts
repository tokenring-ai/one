/** Local calendar date key YYYY-MM-DD */
export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
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
 * Build ISO start/end datetimes from a local event date + optional times.
 * All-day events use local midnight → next midnight.
 * Timed events with no endTime default to 1 hour after start.
 */
export function eventRangeToIso(opts: { date: string; allDay?: boolean; startTime?: string; endTime?: string }): { startAt: string; endAt: string } {
  const [y, mo, d] = opts.date.split("-").map(Number) as [number, number, number];

  if (opts.allDay || !opts.startTime) {
    const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
    const end = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  const startParts = parseTime(opts.startTime) ?? { h: 9, m: 0 };
  const start = new Date(y, mo - 1, d, startParts.h, startParts.m, 0, 0);

  let end: Date;
  const endParts = parseTime(opts.endTime);
  if (endParts) {
    end = new Date(y, mo - 1, d, endParts.h, endParts.m, 0, 0);
    // If end is not after start, push end by 1 hour
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
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
