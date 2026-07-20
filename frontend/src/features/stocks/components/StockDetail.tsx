import { ArrowDownRight, ArrowUpRight, BarChart2, BotMessageSquare, Clock, Loader2, Newspaper, TrendingUp } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useStockPriceHistory, useStockPriceTicks, useStockQuote } from "../../../rpc.ts";
import { changeSign, fmt, fmtPrice, fmtTs } from "../formatters.ts";
import type { Tab } from "../types.ts";
import AskAIModal from "./AskAIModal.tsx";
import ChartTab from "./ChartTab.tsx";
import HistoryTab from "./HistoryTab.tsx";
import NewsTab from "./NewsTab.tsx";
import OverviewTab from "./OverviewTab.tsx";

interface StockDetailProps {
  symbol: string;
  onClear: () => void;
}

export default function StockDetail({ symbol, onClear }: StockDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [showAskAI, setShowAskAI] = useState(false);

  const quote = useStockQuote([symbol]);
  const history = useStockPriceHistory(symbol);
  const ticks = useStockPriceTicks(symbol);

  const quoteRow = quote.data?.rows[0];

  const price = quoteRow?.Price;
  const change = quoteRow?.Change;
  const changePct = quoteRow?.ChangePercent;
  const companyName = quoteRow?.Name ?? symbol;
  const isUp = Number(change) > 0;
  const isDown = Number(change) < 0;
  const isFlat = !(isUp || isDown);

  const logo =
    (quoteRow as { CLLogoBright128?: string; CLIconBright128?: string } | null)?.CLLogoBright128 ??
    (quoteRow as { CLIconBright128?: string } | null)?.CLIconBright128;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: "chart", label: "Chart", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: "history", label: "History", icon: <Clock className="w-3.5 h-3.5" /> },
    { key: "news", label: "News", icon: <Newspaper className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 px-4 py-4 bg-secondary border border-primary rounded-2xl">
        <div className="flex items-start gap-3 min-w-0">
          {logo && (
            <div className="w-12 h-12 rounded-lg bg-primary border border-primary flex items-center justify-center overflow-hidden shrink-0">
              <img src={logo} alt={`${symbol} logo`} className="w-full h-full object-contain p-1" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="text-lg font-bold text-accent-soft">{symbol}</span>
              {companyName !== symbol && <span className="text-sm text-secondary truncate">{companyName}</span>}
              {quoteRow?.ExchangeShortName && (
                <span className="text-2xs px-1.5 py-0.5 bg-primary border border-primary rounded text-muted">{quoteRow.ExchangeShortName}</span>
              )}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              {quote.isLoading && !quoteRow ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted" />
              ) : price != null ? (
                <>
                  <span className="text-3xl font-bold text-primary">${fmtPrice(price)}</span>
                  {!isFlat && (
                    <span className={`flex items-center gap-0.5 text-sm font-medium ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                      {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {changeSign(change)}
                      {fmt(change)} ({changeSign(changePct)}
                      {fmt(changePct)}%)
                    </span>
                  )}
                  {quoteRow?.LastTradeTime && <span className="text-2xs text-muted">· {fmtTs(quoteRow.LastTradeTime, "datetime")}</span>}
                </>
              ) : (
                <span className="text-sm text-muted">Price unavailable</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowAskAI(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
          >
            <BotMessageSquare className="w-3.5 h-3.5" />
            Ask AI
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-2 text-xs text-muted hover:text-primary bg-secondary border border-primary rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-primary pb-0 mb-1">
        {tabs.map(t => (
          <button
            type="button"
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer focus-ring ${
              tab === t.key ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "overview" && <OverviewTab quote={quoteRow} history={history.data?.rows} />}
        {tab === "chart" && <ChartTab symbol={symbol} />}
        {tab === "history" && <HistoryTab symbol={symbol} />}
        {tab === "news" && <NewsTab symbol={symbol} {...(quoteRow?.SymbolID !== undefined && { symbolId: quoteRow.SymbolID })} />}
      </div>

      {showAskAI && (
        <AskAIModal symbol={symbol} quoteData={quoteRow} historyRows={history.data?.rows} intradayRows={ticks.data?.rows} onClose={() => setShowAskAI(false)} />
      )}
    </div>
  );
}
