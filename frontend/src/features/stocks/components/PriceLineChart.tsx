import { fmt, parseHistoryDate } from "../formatters.ts";
import type { StockHistoricalRow } from "../types.ts";

interface PriceLineChartProps {
  rows: StockHistoricalRow[];
}

export default function PriceLineChart({ rows }: PriceLineChartProps) {
  const W = 800,
    H = 200,
    PL = 56,
    PR = 12,
    PT = 8,
    PB = 32;

  const closes = rows.map(r => Number(r[4]) || 0);
  if (closes.length < 2) {
    return <div className="flex items-center justify-center h-32 text-muted text-sm">No chart data</div>;
  }

  const minP = Math.min(...closes);
  const maxP = Math.max(...closes);
  const range = maxP - minP || 1;

  const xS = (i: number) => PL + (i / (closes.length - 1)) * (W - PL - PR);
  const yS = (p: number) => PT + (1 - (p - minP) / range) * (H - PT - PB);

  const linePath = closes.map((p, i) => `${i === 0 ? "M" : "L"} ${xS(i)} ${yS(p)}`).join(" ");
  const areaPath = `${linePath} L ${xS(closes.length - 1)} ${H - PB} L ${xS(0)} ${H - PB} Z`;

  const yTicks = [minP, minP + range / 4, minP + range / 2, minP + (3 * range) / 4, maxP];

  const dates = rows.map(r => {
    const ts = parseHistoryDate(r[0] as number | string);
    return ts ? new Date(ts).toISOString().slice(0, 10) : "";
  });
  const labelCount = 6;
  const xLabelIndices = Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1)) * (dates.length - 1)));

  const isUp = closes[closes.length - 1]! >= closes[0]!;
  const lineColor = isUp ? "#10b981" : "#ef4444";
  const fillColor = lineColor;
  const gradId = `grad-${isUp ? "up" : "dn"}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 select-none" aria-label="Price chart">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <line key={i} x1={PL} y1={yS(t)} x2={W - PR} y2={yS(t)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      {yTicks.map((t, i) => (
        <text key={i} x={PL - 6} y={yS(t) + 4} fontSize={10} fill="currentColor" opacity={0.5} textAnchor="end">
          ${fmt(t)}
        </text>
      ))}
      {xLabelIndices.map(idx =>
        dates[idx] ? (
          <text key={idx} x={xS(idx)} y={H - 8} fontSize={10} fill="currentColor" opacity={0.5} textAnchor="middle">
            {dates[idx].slice(2)}
          </text>
        ) : null,
      )}
    </svg>
  );
}
