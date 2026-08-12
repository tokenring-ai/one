import { useMemo } from "react";
import LaunchAgentModal from "../../../components/ui/LaunchAgentModal.tsx";
import type { StockHistoricalRow, StockPriceTicksRow, StockQuote } from "../types.ts";

interface AskAIModalProps {
  symbol: string;
  quoteData: StockQuote | undefined;
  historyRows?: StockHistoricalRow[] | undefined;
  intradayRows?: StockPriceTicksRow[] | undefined;
  onClose: () => void;
}

export default function AskAIModal({ symbol, quoteData, historyRows, intradayRows, onClose }: AskAIModalProps) {
  const contextData = useMemo(
    () => ({
      symbol,
      quote: quoteData,
      recentHistory: historyRows?.slice(-20),
      recentTicks: intradayRows?.slice(-20),
    }),
    [symbol, quoteData, historyRows, intradayRows],
  );

  return (
    <LaunchAgentModal
      title={`Ask AI about ${symbol}`}
      description="Launches a new agent with current quote + history as context"
      defaultQuestion={`Analyze the stock ${symbol}. What do you think about the current price action and near-term outlook?`}
      contextData={contextData}
      contextFileName={`tokenring-stock-${symbol}-\${timestamp}.json`}
      messagePrefix={[`You are analyzing stock ${symbol}.`, `Use the attached market data and available financial tools (cloudquote, newsrpm) as needed.`].join(
        "\n",
      )}
      messageSource="Stocks app"
      onClose={onClose}
    />
  );
}
