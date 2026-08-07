import { Building2, Clock, DollarSign, Globe } from "lucide-react";
import { changeSign, fmt, fmtMarketCap, fmtPrice, fmtTs, fmtVol } from "../formatters.ts";
import type { StockHistoricalRow, StockQuote } from "../types.ts";
import PriceLineChart from "./PriceLineChart.tsx";
import RangeBar from "./RangeBar.tsx";
import StatCard from "./StatCard.tsx";

interface OverviewTabProps {
  quote: StockQuote | undefined;
  quoteLoading?: boolean;
  quoteError?: boolean;
  history: StockHistoricalRow[] | undefined;
  historyLoading?: boolean;
  historyError?: boolean;
}

function money(n: number | null | undefined): string {
  return n != null && !Number.isNaN(Number(n)) ? `$${fmtPrice(n)}` : "—";
}

export default function OverviewTab({ quote, quoteLoading, quoteError, history, historyLoading, historyError }: OverviewTabProps) {
  if (quoteLoading && !quote) {
    return <div className="py-8 text-center text-muted text-sm">Loading quote…</div>;
  }
  if (quoteError && !quote) {
    return <div className="py-8 text-center text-red-400 text-sm">Failed to load quote</div>;
  }
  if (!quote) return <div className="py-8 text-center text-muted text-sm">No quote data</div>;

  const price = quote.Price;
  const peRatio = quote.Price && quote.EPS ? quote.Price / quote.EPS : null;
  const dividendYield = quote.AnnualDividend && quote.Price ? (quote.AnnualDividend / quote.Price) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="px-4 py-3 bg-secondary rounded-xl border border-primary">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs uppercase tracking-wide text-muted">Day Range</span>
            <span className="text-xs text-muted font-mono">
              {money(quote.Low)} – {money(quote.High)}
            </span>
          </div>
          <RangeBar
            low={quote.Low}
            high={quote.High}
            current={price}
            lowLabel={quote.Low != null ? `L ${money(quote.Low)}` : "L —"}
            highLabel={quote.High != null ? `H ${money(quote.High)}` : "H —"}
          />
        </div>
        <div className="px-4 py-3 bg-secondary rounded-xl border border-primary">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs uppercase tracking-wide text-muted">52-Week Range</span>
            <span className="text-xs text-muted font-mono">
              {money(quote.Low52)} – {money(quote.High52)}
            </span>
          </div>
          <RangeBar
            low={quote.Low52}
            high={quote.High52}
            current={price}
            lowLabel={quote.Low52 != null ? `L ${money(quote.Low52)}` : "L —"}
            highLabel={quote.High52 != null ? `H ${money(quote.High52)}` : "H —"}
          />
        </div>
      </div>

      {history && history.length > 1 ? (
        <div className="bg-secondary rounded-xl border border-primary p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wide text-muted">Recent Price</span>
            <span className="text-xs text-muted">{history.length} sessions</span>
          </div>
          <PriceLineChart rows={history} />
        </div>
      ) : historyLoading ? (
        <div className="bg-secondary rounded-xl border border-primary p-3 h-32 flex items-center justify-center text-sm text-muted">Loading price history…</div>
      ) : historyError ? (
        <div className="bg-secondary rounded-xl border border-primary p-3 h-20 flex items-center justify-center text-sm text-red-400">
          Failed to load price history
        </div>
      ) : null}

      <div>
        <div className="text-xs uppercase tracking-wide text-muted font-bold mb-2 px-1">Key Stats</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <StatCard label="Open" value={money(quote.Open)} />
          <StatCard label="Prev Close" value={money(quote.PrevClose)} />
          <StatCard label="Volume" value={fmtVol(quote.Volume)} sub={quote.AverageVolume ? `Avg ${fmtVol(quote.AverageVolume)}` : undefined} />
          <StatCard label="Market Cap" value={fmtMarketCap(quote.Price, quote.SharesOutstanding)} />
          <StatCard label="P/E Ratio" value={peRatio != null ? fmt(peRatio) : "—"} sub={quote.EPS != null ? `EPS $${fmt(quote.EPS)}` : undefined} />
          <StatCard
            label="Dividend Yield"
            value={dividendYield != null ? `${fmt(dividendYield)}%` : "—"}
            sub={quote.AnnualDividend != null ? `Annual $${fmt(quote.AnnualDividend)}` : undefined}
          />
          <StatCard
            label="50-Day MA"
            value={money(quote.MovingAverage50)}
            accent={price && quote.MovingAverage50 ? (price >= quote.MovingAverage50 ? "up" : "down") : "neutral"}
          />
          <StatCard
            label="200-Day MA"
            value={money(quote.MovingAverage200)}
            accent={price && quote.MovingAverage200 ? (price >= quote.MovingAverage200 ? "up" : "down") : "neutral"}
          />
          <StatCard label="Bid" value={money(quote.Bid)} sub={quote.BidSize ? `× ${fmtVol(quote.BidSize)}` : undefined} />
          <StatCard label="Ask" value={money(quote.Ask)} sub={quote.AskSize ? `× ${fmtVol(quote.AskSize)}` : undefined} />
          <StatCard
            label="After Hours"
            value={money(quote.AfterHoursPrice)}
            sub={quote.AfterHoursTradeTime ? fmtTs(quote.AfterHoursTradeTime, "datetime") : undefined}
          />
          <StatCard label="Shares Out" value={quote.SharesOutstanding ? fmtVol(quote.SharesOutstanding) : "—"} />
        </div>
      </div>

      {(quote.StartingPrice1W ||
        quote.StartingPrice1M ||
        quote.StartingPrice3M ||
        quote.StartingPrice6M ||
        quote.StartingPrice52 ||
        quote.StartingPriceYTD) && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted font-bold mb-2 px-1">Performance</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(
              [
                ["1W", quote.StartingPrice1W],
                ["1M", quote.StartingPrice1M],
                ["3M", quote.StartingPrice3M],
                ["6M", quote.StartingPrice6M],
                ["YTD", quote.StartingPriceYTD],
                ["52W", quote.StartingPrice52],
              ] as const
            ).map(([label, start]) => {
              if (!start || !price) {
                return <StatCard key={label} label={label} value="—" />;
              }
              const pct = ((price - start) / start) * 100;
              return <StatCard key={label} label={label} value={`${changeSign(pct)}${fmt(pct)}%`} accent={pct >= 0 ? "up" : "down"} />;
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted px-1">
        {quote.ExchangeName && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> {quote.ExchangeName}
            {quote.ExchangeShortName && <span className="text-muted/60">({quote.ExchangeShortName})</span>}
          </div>
        )}
        {quote.SecurityTypeName && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3 h-3" /> {quote.SecurityTypeName}
            {quote.NominalCurrencyCode && <span className="text-muted/60">· {quote.NominalCurrencyCode}</span>}
          </div>
        )}
        {(quote as { CLWebsite?: string }).CLWebsite && (
          <a
            href={
              (quote as { CLWebsite?: string }).CLWebsite!.startsWith("http")
                ? (quote as { CLWebsite?: string }).CLWebsite
                : `https://${(quote as { CLWebsite?: string }).CLWebsite}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-accent-soft transition-colors"
          >
            <Globe className="w-3 h-3" /> {(quote as { CLWebsite?: string }).CLWebsite}
          </a>
        )}
        {quote.LastTradeTime && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Last trade {fmtTs(quote.LastTradeTime, "datetime")}
          </div>
        )}
      </div>
    </div>
  );
}
