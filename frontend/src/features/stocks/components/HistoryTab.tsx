import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStockPriceHistory } from "../../../rpc.ts";
import { fmt, fmtHistoryDate, fmtVol, historyRange, isoDateOffset } from "../formatters.ts";
import PriceLineChart from "./PriceLineChart.tsx";

interface HistoryTabProps {
  symbol: string;
}

export default function HistoryTab({ symbol }: HistoryTabProps) {
  const defaults = historyRange(3);
  // UI dates are the range the user wants; API gets ±1 day buffer on apply.
  const [from, setFrom] = useState(isoDateOffset(-90));
  const [to, setTo] = useState(isoDateOffset(0));
  const [fetchParams, setFetchParams] = useState(() => ({
    from: defaults.from,
    to: defaults.to,
  }));
  const history = useStockPriceHistory(symbol, fetchParams.from, fetchParams.to);

  const apply = () => {
    // Buffer ±1 day for CloudQuote price history API
    const fromDate = new Date(from);
    fromDate.setDate(fromDate.getDate() - 1);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1);
    setFetchParams({
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="text-xs bg-secondary border border-primary rounded-lg px-3 py-1.5 text-primary focus:border-accent outline-none"
          aria-label="History start date"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
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

      {history.error && <div className="py-2 text-center text-red-400 text-sm">Failed to load price history</div>}

      {history.data?.rows && history.data.rows.length > 0 && (
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
