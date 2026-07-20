import type { CloudQuoteQuoteHistoricalItemSchema, CloudQuoteQuoteSchema } from "@tokenring-ai/cloudquote/schema";
import type { z } from "zod";

export type StockQuote = z.infer<typeof CloudQuoteQuoteSchema>;
export type StockHistoricalRow = z.infer<typeof CloudQuoteQuoteHistoricalItemSchema>;
export type StockPriceTicksRow = [number, number, number];
export type StockPriceHistoryRow = z.infer<typeof CloudQuoteQuoteHistoricalItemSchema>;

export interface StockNewsItem {
  slug?: string;
  Slug?: string;
  headline?: string;
  Headline?: string;
  title?: string;
  date?: string | number;
  Date?: string | number;
  publishDate?: string | number;
  provider?: string;
  Provider?: string;
  source?: string;
  link?: string;
  Link?: string;
}

export type Tab = "overview" | "chart" | "history" | "news";
