import { Loader2 } from "lucide-react";
import { useState } from "react";
import DateRangePicker, { type DateRange } from "../../../components/ui/DateRangePicker.tsx";
import { useStockPriceHistory } from "../../../rpc.ts";
import { bufferedHistoryRange, fmt, fmtHistoryDate, fmtVol, isoDateOffset } from "../formatters.ts";
import PriceLineChart from "./PriceLineChart.tsx";

interface HistoryTabProps {
  symbol: string;
}

export default function HistoryTab({ symbol }: HistoryTabProps) {
  // UI dates are the range the user wants; API gets ±1 day buffer (initial + on apply).
  const [range, setRange] = useState<DateRange>(() => ({
    from: isoDateOffset(-90),
    to: isoDateOffset(0),
  }));
  const [fetchParams, setFetchParams] = useState(() => {
    const buffered = bufferedHistoryRange(isoDateOffset(-90), isoDateOffset(0));
    return buffered ?? { from: isoDateOffset(-91), to: isoDateOffset(1) };
  });
  const history = useStockPriceHistory(symbol, fetchParams.from, fetchParams.to);

  const applyRange = (next: DateRange) => {
    setRange(next);
    const buffered = bufferedHistoryRange(next.from, next.to);
    if (buffered) {
      setFetchParams(buffered);
    }
  };

  return (
    <div className="space-y-3">
      <DateRangePicker
        value={range}
        onChange={applyRange}
        fromAriaLabel="History start date"
        toAriaLabel="History end date"
        presets={[
          { label: "7D", days: 7 },
          { label: "30D", days: 30 },
          { label: "90D", days: 90 },
        ]}
      />

      {history.error && <div className="py-2 text-center text-red-400 text-sm">Failed to load price history</div>}

      {history.data?.rows && history.data.rows.length > 1 && (
        <div className="bg-secondary rounded-xl border border-primary p-3">
          <PriceLineChart rows={history.data.rows} />
        </div>
      )}

      {history.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : !history.data?.rows.length ? (
        <div className="py-8 text-center text-muted text-sm">No history data</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary border-b border-primary">
                {["Date", "Open", "High", "Low", "Close", "Volume"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...history.data.rows].reverse().map((row, i) => (
                <tr key={`${fmtHistoryDate(row[0])}-${i}`} className="border-b border-primary/50 hover:bg-hover transition-colors">
                  <td className="px-3 py-2 font-mono text-secondary">{fmtHistoryDate(row[0])}</td>
                  <td className="px-3 py-2 text-secondary">{fmt(row[1])}</td>
                  <td className="px-3 py-2 text-emerald-500">{fmt(row[2])}</td>
                  <td className="px-3 py-2 text-red-500">{fmt(row[3])}</td>
                  <td className="px-3 py-2 font-medium text-primary">{fmt(row[4])}</td>
                  <td className="px-3 py-2 text-muted">{fmtVol(row[5])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
