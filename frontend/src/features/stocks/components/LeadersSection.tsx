import { ArrowDownRight, ArrowUpRight, Loader2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { useStockLeaders } from "../../../rpc.ts";
import { changeSign, fmt, fmtPrice, fmtVol } from "../formatters.ts";
import type { StockQuote } from "../types.ts";

interface LeadersSectionProps {
  onSymbolSelect: (s: string) => void;
}

export default function LeadersSection({ onSymbolSelect }: LeadersSectionProps) {
  const [leaderTab, setLeaderTab] = useState<"MOSTACTIVE" | "PERCENTGAINERS" | "PERCENTLOSERS">("MOSTACTIVE");
  const leaders = useStockLeaders(leaderTab, 10);

  const tabs = [
    { key: "MOSTACTIVE" as const, label: "Most Active", icon: <Zap className="w-3 h-3" /> },
    { key: "PERCENTGAINERS" as const, label: "Top Gainers", icon: <TrendingUp className="w-3 h-3" /> },
    { key: "PERCENTLOSERS" as const, label: "Top Losers", icon: <TrendingDown className="w-3 h-3" /> },
  ];

  const rows = leaders.data?.rows ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {tabs.map(t => (
          <button
            type="button"
            key={t.key}
            onClick={() => setLeaderTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring ${
              leaderTab === t.key ? "bg-accent text-white" : "bg-secondary text-muted hover:text-primary border border-primary"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {leaders.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : !rows.length ? (
        <div className="py-6 text-center text-muted text-sm">No data</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary border-b border-primary">
                <th className="px-3 py-2 text-left text-muted font-semibold">Symbol</th>
                <th className="px-3 py-2 text-left text-muted font-semibold">Company</th>
                <th className="px-3 py-2 text-right text-muted font-semibold">Price</th>
                <th className="px-3 py-2 text-right text-muted font-semibold">Change</th>
                <th className="px-3 py-2 text-right text-muted font-semibold">Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: StockQuote | null, i: number) => {
                if (!row) return null;
                const sym = row.Symbol ?? "";
                const name = row.Name ?? "";
                const price = row.Price ?? "";
                const change = row.Change ?? "";
                const changePct = row.ChangePercent ?? "";
                const vol = row.Volume ?? "";
                const isUp = Number(change) >= 0;
                return (
                  <tr
                    key={i}
                    onClick={() => sym && onSymbolSelect(sym.toUpperCase())}
                    className="border-b border-primary/50 hover:bg-hover transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 font-bold text-accent-soft">{sym}</td>
                    <td className="px-3 py-2 text-secondary truncate max-w-40">{name}</td>
                    <td className="px-3 py-2 text-right font-medium text-primary">${fmtPrice(price)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                      <span className="flex items-center justify-end gap-0.5">
                        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {changeSign(change)}
                        {fmt(change)} ({changeSign(changePct)}
                        {fmt(changePct)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted">{fmtVol(vol)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
