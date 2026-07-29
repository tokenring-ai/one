export function pricePrecision(n: number | null | undefined): number {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10) return 2;
  if (abs >= 1) return 3;
  return 4;
}

export function fmt(n: number | string | null | undefined, digits = 2) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPrice(n: number | string | null | undefined) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return fmt(n, pricePrecision(Number(n)));
}

export function fmtVol(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!v) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export function fmtMarketCap(price?: number, shares?: number): string {
  if (!price || !shares) return "—";
  const cap = price * shares;
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${fmt(cap)}`;
}

export function changeSign(v: number | string | null | undefined): string {
  return Number(v) >= 0 ? "+" : "";
}

export function fmtTs(ts: number | null | undefined, kind: "date" | "datetime" = "date"): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return kind === "datetime" ? d.toLocaleString() : d.toLocaleDateString();
}

/**
 * Normalize a history/tick timestamp to epoch milliseconds.
 * CloudQuote typically returns ms; some feeds use µs/ns or seconds.
 */
export function parseHistoryDate(v: number | string): number {
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  // nanoseconds (~1e18) → ms
  if (v > 1e16) return v / 1e6;
  // microseconds (~1e15) → ms
  if (v > 1e14) return v / 1e3;
  // seconds (~1e9) → ms
  if (v > 0 && v < 1e11) return v * 1000;
  // already milliseconds (~1e12)
  return v;
}

/** Format a history row date (epoch ms or YYYY-MM-DD) for display. */
export function fmtHistoryDate(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const ts = parseHistoryDate(v as number | string);
  if (!ts) return String(v);
  return new Date(ts).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

/** ISO date (YYYY-MM-DD) offset by `days` from today (local). */
export function isoDateOffset(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * CloudQuote getPriceHistory works best with a 1-day buffer on each side.
 * Returns { from, to } suitable for the RPC.
 */
export function historyRange(monthsBack: number): { from: string; to: string } {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date();
  start.setMonth(start.getMonth() - monthsBack);
  start.setDate(start.getDate() - 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
