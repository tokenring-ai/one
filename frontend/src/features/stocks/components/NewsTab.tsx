import { ExternalLink, Loader2, Newspaper } from "lucide-react";
import { useMemo } from "react";
import { useNewsRPMIndexedDataSearchResults, useStockHeadlines } from "../../../rpc.ts";
import type { StockNewsItem } from "../types.ts";

interface NewsTabProps {
  symbol: string;
  symbolId?: string;
}

function normalizeItem(item: StockNewsItem | Record<string, unknown>): {
  key: string;
  headline: string;
  date: string;
  provider: string;
  link: string;
} {
  const row = item as StockNewsItem;
  const slug = row.slug ?? row.Slug ?? "";
  const headline = row.headline ?? row.Headline ?? row.title ?? "(no headline)";
  const rawDate = row.date ?? row.Date ?? row.publishDate ?? "";
  const date = rawDate ? String(rawDate).slice(0, 10) : "";
  const provider = row.provider ?? row.Provider ?? row.source ?? "";
  const link = slug ? `https://www.financialcontent.com/article/${slug}` : (row.link ?? row.Link ?? "");
  return {
    key: slug || `${headline}-${date}-${provider}`,
    headline,
    date,
    provider,
    link,
  };
}

export default function NewsTab({ symbol, symbolId }: NewsTabProps) {
  // Prefer SymbolID when available; always also search NormalizedTicker as fallback path.
  const byId = useNewsRPMIndexedDataSearchResults(
    symbolId
      ? {
          key: "symbolID",
          value: symbolId,
          count: 30,
          order: "date",
        }
      : undefined,
  );

  const byTicker = useNewsRPMIndexedDataSearchResults(
    !symbolId || (byId.data && !byId.data.rows.length)
      ? {
          key: "NormalizedTicker",
          value: symbol.toUpperCase(),
          count: 30,
          order: "date",
        }
      : undefined,
  );

  // CloudQuote headlines endpoint only after primary NewsRPM searches finish empty
  const primaryPending = Boolean(symbolId && byId.isLoading) || byTicker.isLoading;
  const primaryEmpty = !byId.data?.rows.length && !byTicker.data?.rows.length;
  const headlines = useStockHeadlines(!primaryPending && primaryEmpty ? symbol.toUpperCase() : undefined, 25);

  const rows = useMemo(() => {
    if (byId.data?.rows.length) return byId.data.rows as StockNewsItem[];
    if (byTicker.data?.rows.length) return byTicker.data.rows as StockNewsItem[];
    const raw: unknown = headlines.data?.data;
    if (Array.isArray(raw)) return raw as StockNewsItem[];
    if (raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)) {
      return (raw as { rows: StockNewsItem[] }).rows;
    }
    return [];
  }, [byId.data, byTicker.data, headlines.data]);

  const isLoading = byId.isLoading || byTicker.isLoading || headlines.isLoading;
  const error = byId.error || byTicker.error || headlines.error;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (error && !rows.length) {
    return <div className="py-8 text-center text-red-400 text-sm">Failed to load news for {symbol}</div>;
  }

  if (!rows.length) {
    return <div className="py-8 text-center text-muted text-sm">No news found for {symbol}</div>;
  }

  return (
    <div className="space-y-2">
      {rows.map((item, i) => {
        const n = normalizeItem(item);
        return (
          <div
            key={n.key || i}
            className="flex items-start gap-3 px-4 py-3 bg-secondary rounded-xl border border-primary hover:border-accent-muted transition-colors group"
          >
            <Newspaper className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary leading-snug mb-1">{n.headline}</p>
              <div className="flex items-center gap-3">
                {n.provider && <span className="text-2xs text-muted">{n.provider}</span>}
                {n.date && <span className="text-2xs text-muted font-mono">{n.date}</span>}
              </div>
            </div>
            {n.link && (
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 text-muted hover:text-accent-soft opacity-0 group-hover:opacity-100 transition-all rounded-md focus-ring cursor-pointer"
                aria-label={`Open article: ${n.headline}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
