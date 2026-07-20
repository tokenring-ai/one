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

export function parseHistoryDate(v: number | string): number {
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (v > 1e15) return v / 1e6;
  if (v > 1e12) return v / 1e3;
  return v;
}
