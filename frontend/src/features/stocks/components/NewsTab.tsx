import { ExternalLink, Loader2, Newspaper } from "lucide-react";
import { useNewsRPMIndexedDataSearchResults } from "../../../rpc.ts";
import type { StockNewsItem } from "../types.ts";

interface NewsTabProps {
  symbol: string;
  symbolId?: string;
}

export default function NewsTab({ symbol, symbolId }: NewsTabProps) {
  const news = useNewsRPMIndexedDataSearchResults(
    symbolId !== undefined
      ? {
          key: "symbolID",
          value: symbolId,
        }
      : undefined,
  );

  const rows = news.data?.rows ?? [];

  if (news.isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  if (!rows.length) return <div className="py-8 text-center text-muted text-sm">No news found for {symbol}</div>;

  return (
    <div className="space-y-2">
      {rows.map((item: StockNewsItem, i: number) => {
        const slug = item.slug ?? item.Slug ?? "";
        const headline = item.headline ?? item.Headline ?? item.title ?? "(no headline)";
        const date = item.date ?? item.Date ?? item.publishDate ?? "";
        const provider = item.provider ?? item.Provider ?? item.source ?? "";
        const link = slug ? `https://www.financialcontent.com/article/${slug}` : (item.link ?? item.Link ?? "");
        return (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3 bg-secondary rounded-xl border border-primary hover:border-accent-muted transition-colors group"
          >
            <Newspaper className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary leading-snug mb-1">{headline}</p>
              <div className="flex items-center gap-3">
                {provider && <span className="text-2xs text-muted">{provider}</span>}
                {date && <span className="text-2xs text-muted font-mono">{String(date).slice(0, 10)}</span>}
              </div>
            </div>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 text-muted hover:text-accent-soft opacity-0 group-hover:opacity-100 transition-all rounded-md focus-ring cursor-pointer"
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
