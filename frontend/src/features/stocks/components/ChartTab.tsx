import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStockPriceChart, useStockPriceHistory, useStockPriceTicks } from "../../../rpc.ts";
import { historyRange } from "../formatters.ts";
import type { StockHistoricalRow } from "../types.ts";
import PriceLineChart from "./PriceLineChart.tsx";

interface ChartTabProps {
  symbol: string;
}

type IntervalKey = "1" | "5" | "daily" | "daily3m" | "weekly";

const INTERVALS: { label: string; value: IntervalKey; months?: number; useTicks?: boolean }[] = [
  { label: "1D", value: "1", useTicks: true },
  { label: "5D", value: "5", useTicks: true },
  { label: "1M", value: "daily", months: 1 },
  { label: "3M", value: "daily3m", months: 3 },
  { label: "1Y", value: "weekly", months: 12 },
];

/** Map intraday ticks [ts, price, vol] → OHLC-shaped rows for PriceLineChart. */
function ticksToHistoryRows(ticks: [number, number, number][]): StockHistoricalRow[] {
  return ticks.map(([ts, price, vol]) => [ts, price, price, price, price, vol, price] as StockHistoricalRow);
}

export default function ChartTab({ symbol }: ChartTabProps) {
  const [chartInterval, setChartInterval] = useState<IntervalKey>("daily");
  /** 0 = dark external, 1 = RPC chart URL, 2 = local SVG from market data */
  const [chartStage, setChartStage] = useState<0 | 1 | 2>(0);

  const selected = INTERVALS.find(i => i.value === chartInterval) ?? INTERVALS[2]!;
  const range = useMemo(() => historyRange(selected.months ?? 3), [selected.months]);

  const chart = useStockPriceChart(symbol, chartInterval);
  const ticks = useStockPriceTicks(selected.useTicks ? symbol : undefined);
  const history = useStockPriceHistory(selected.useTicks ? undefined : symbol, range.from, range.to);

  // Dark-themed financialcontent chart; RPC returns a light-theme URL as secondary.
  const darkChartUrl = `https://chart.financialcontent.com/Chart?shwidth=3&fillshx=0&height=200&lncolor=6366f1&interval=${chartInterval}&fillshy=0&gtcolor=6366f1&vucolor=10b981&bvcolor=1e293b&gmcolor=334155&shcolor=475569&grcolor=0f172a&vdcolor=ef4444&brcolor=0f172a&gbcolor=0f172a&lnwidth=2&volume=1&pvcolor=ef4444&mkcolor=ef4444&itcolor=94a3b8&fillalpha=20&ticker=${encodeURIComponent(symbol)}&Client=stocks&txcolor=94a3b8&output=svg&bgcolor=1e293b&arcolor=null&type=0&width=800`;
  const rpcChartUrl = chart.data?.svgDataUri;
  const imageUrl = chartStage === 0 ? darkChartUrl : chartStage === 1 ? rpcChartUrl : undefined;

  // If stage 1 has no RPC URL after load/error, fall through to local market-data chart.
  useEffect(() => {
    if (chartStage === 1 && !chart.isLoading && !rpcChartUrl) {
      setChartStage(2);
    }
  }, [chartStage, chart.isLoading, rpcChartUrl]);

  const localRows = useMemo(() => {
    if (selected.useTicks) {
      const rows = ticks.data?.rows ?? [];
      // 1D: last session-ish portion when dense
      if (chartInterval === "1" && rows.length > 400) {
        return ticksToHistoryRows(rows.slice(-400) as [number, number, number][]);
      }
      return ticksToHistoryRows(rows as [number, number, number][]);
    }
    return history.data?.rows ?? [];
  }, [selected.useTicks, ticks.data?.rows, history.data?.rows, chartInterval]);

  const dataLoading = selected.useTicks ? ticks.isLoading : history.isLoading;
  const dataError = selected.useTicks ? ticks.error : history.error;

  const imgKey = `${symbol}-${chartInterval}-${chartStage}`;
  const waitingOnImagePipeline = chartStage === 1 && (chart.isLoading || !rpcChartUrl);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {INTERVALS.map(iv => (
          <button
            type="button"
            key={iv.value}
            onClick={() => {
              setChartInterval(iv.value);
              setChartStage(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-ring ${
              chartInterval === iv.value ? "bg-accent text-white" : "bg-secondary text-muted hover:text-primary border border-primary"
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>

      <div className="bg-secondary rounded-xl border border-primary overflow-hidden">
        {imageUrl ? (
          <img
            key={imgKey}
            src={imageUrl}
            alt={`${symbol} price chart`}
            className="w-full h-48 object-contain bg-secondary"
            onError={() => {
              // Always try RPC chart after dark external fails; only then fall back to local SVG.
              setChartStage(prev => (prev === 0 ? 1 : 2));
            }}
          />
        ) : waitingOnImagePipeline || dataLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-muted" />
          </div>
        ) : dataError && localRows.length < 2 ? (
          <div className="flex justify-center items-center h-48 text-sm text-red-400 px-4 text-center">Failed to load chart data</div>
        ) : localRows.length > 1 ? (
          <div className="p-3">
            <PriceLineChart rows={localRows} />
          </div>
        ) : (
          <div className="flex justify-center items-center h-48 text-sm text-muted">No chart data for {symbol}</div>
        )}
      </div>

      {chartStage === 2 && localRows.length > 1 && (
        <p className="text-2xs text-muted px-1">Showing local chart from market data (external chart unavailable).</p>
      )}
    </div>
  );
}
