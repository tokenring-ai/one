import { fmtPrice } from "../formatters.ts";

interface RangeBarProps {
  low: number | undefined;
  high: number | undefined;
  current: number | undefined;
  lowLabel?: string;
  highLabel?: string;
}

export default function RangeBar({ low, high, current, lowLabel, highLabel }: RangeBarProps) {
  if (low == null || high == null || current == null || high <= low) {
    return <div className="h-1.5 rounded-full bg-secondary border border-primary" />;
  }
  const pct = Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100));
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 rounded-full bg-secondary border border-primary overflow-hidden">
        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-emerald-500/30" />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent border border-primary shadow-md"
          style={{ left: `calc(${pct}% - 4px)` }}
        />
      </div>
      <div className="flex justify-between text-2xs text-muted font-mono">
        <span>{lowLabel ?? fmtPrice(low)}</span>
        <span>{highLabel ?? fmtPrice(high)}</span>
      </div>
    </div>
  );
}
