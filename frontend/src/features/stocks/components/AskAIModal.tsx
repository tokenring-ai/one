import formatError from "@tokenring-ai/utility/error/formatError";
import { BotMessageSquare, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../../components/ui/toast.tsx";
import { agentRPCClient, filesystemRPCClient, useAgentTypes } from "../../../rpc.ts";
import type { StockHistoricalRow, StockPriceTicksRow, StockQuote } from "../types.ts";

interface AskAIModalProps {
  symbol: string;
  quoteData: StockQuote | undefined;
  historyRows?: StockHistoricalRow[] | undefined;
  intradayRows?: StockPriceTicksRow[] | undefined;
  onClose: () => void;
}

export default function AskAIModal({ symbol, quoteData, historyRows, intradayRows, onClose }: AskAIModalProps) {
  const navigate = useNavigate();
  const agentTypes = useAgentTypes();
  const [selectedType, setSelectedType] = useState("");
  const [question, setQuestion] = useState(`Analyze the stock ${symbol}. What do you think about the current price action and near-term outlook?`);
  const [launching, setLaunching] = useState(false);

  const firstType = agentTypes.data?.[0]?.type ?? "";
  const effectiveType = selectedType || firstType;

  const handleLaunch = useCallback(async () => {
    if (!effectiveType || !question.trim()) return;
    setLaunching(true);
    try {
      const { id: agentId } = await agentRPCClient.createAgent({ agentType: effectiveType, headless: false });

      const contextData = {
        symbol,
        question: question.trim(),
        quote: quoteData,
        recentHistory: historyRows?.slice(-20),
        recentTicks: intradayRows?.slice(-20),
        fetchedAt: new Date().toISOString(),
      };
      const contextPath = `/tmp/tokenring-stock-${symbol}-${Date.now()}.json`;
      const fsState = await filesystemRPCClient.getFilesystemState({ agentId });
      if (fsState.status !== "success") throw new Error("Failed to get filesystem state");
      await filesystemRPCClient.writeFile({
        path: contextPath,
        content: JSON.stringify(contextData, null, 2),
        provider: fsState.provider,
      });
      await filesystemRPCClient.addFileToChat({ agentId, file: contextPath });

      // Send the user's question so the agent actually starts working on it.
      await agentRPCClient.sendInput({
        agentId,
        input: {
          from: "Stocks app",
          message: [
            `You are analyzing stock ${symbol}.`,
            `Quote/history context is attached as ${contextPath}.`,
            `User question: ${question.trim()}`,
            `Use the attached market data and available financial tools (cloudquote, newsrpm) as needed.`,
          ].join("\n"),
        },
      });

      onClose();
      void navigate(`/agent/${agentId}`);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
      setLaunching(false);
    }
  }, [effectiveType, symbol, question, quoteData, historyRows, intradayRows, navigate, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="ask-ai-title">
      <div className="bg-primary border border-primary rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <h2 id="ask-ai-title" className="text-base font-semibold text-primary">
            Ask AI about {symbol}
          </h2>
          <p className="text-xs text-muted mt-0.5">Launches a new agent with current quote + history as context</p>
        </div>

        <div>
          <label className="text-xs text-muted font-medium block mb-1" htmlFor="ask-ai-question">
            Your question
          </label>
          <textarea
            id="ask-ai-question"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={3}
            className="w-full text-sm bg-secondary border border-primary rounded-lg px-3 py-2 text-primary focus:border-accent outline-none resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-muted font-medium block mb-1" htmlFor="ask-ai-type">
            Agent type
          </label>
          <select
            id="ask-ai-type"
            value={effectiveType}
            onChange={e => setSelectedType(e.target.value)}
            className="w-full text-sm bg-secondary border border-primary rounded-lg px-3 py-2 text-primary focus:border-accent outline-none cursor-pointer"
          >
            {agentTypes.data?.map(t => (
              <option key={t.type} value={t.type}>
                {t.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="flex-1 px-4 py-2 text-sm bg-secondary hover:bg-hover text-secondary border border-primary rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching || !effectiveType || !question.trim()}
            className="flex-1 px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <BotMessageSquare className="w-4 h-4" />}
            Launch Agent
          </button>
        </div>
      </div>
    </div>
  );
}
