import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStockPriceHistory } from "../../../rpc.ts";
import { bufferedHistoryRange, fmt, fmtHistoryDate, fmtVol, isoDateOffset } from "../formatters.ts";
import PriceLineChart from "./PriceLineChart.tsx";

interface HistoryTabProps {
  symbol: string;
}

export default function HistoryTab({ symbol }: HistoryTabProps) {
  // UI dates are the range the user wants; API gets ±1 day buffer (initial + on apply).
  const [from, setFrom] = useState(() => isoDateOffset(-90));
  const [to, setTo] = useState(() => isoDateOffset(0));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [fetchParams, setFetchParams] = useState(() => {
    const buffered = bufferedHistoryRange(isoDateOffset(-90), isoDateOffset(0));
    return buffered ?? { from: isoDateOffset(-91), to: isoDateOffset(1) };
  });
  const history = useStockPriceHistory(symbol, fetchParams.from, fetchParams.to);

  const apply = () => {
    if (!from || !to) {
      setRangeError("Select both start and end dates");
      return;
    }
    if (from > to) {
      setRangeError("Start date must be on or before end date");
      return;
    }
    const buffered = bufferedHistoryRange(from, to);
    if (!buffered) {
      setRangeError("Invalid date range");
      return;
    }
    setRangeError(null);
    setFetchParams(buffered);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={from}
          onChange={e => {
            setFrom(e.target.value);
            setRangeError(null);
          }}
          className="text-xs bg-secondary border border-primary rounded-lg px-3 py-1.5 text-primary focus:border-accent outline-none"
          aria-label="History start date"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date"
          value={to}
          onChange={e => {
            setTo(e.target.value);
            setRangeError(null);
          }}
          className="text-xs bg-secondary border border-primary rounded-lg px-3 py-1.5 text-primary focus:border-accent outline-none"
          aria-label="History end date"
        />
        <button
          type="button"
          onClick={apply}
          className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Apply
        </button>
      </div>

      {rangeError && <div className="py-1 text-center text-red-400 text-sm">{rangeError}</div>}
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
