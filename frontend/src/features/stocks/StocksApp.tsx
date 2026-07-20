import { useCallback, useState } from "react";
import LeadersSection from "./components/LeadersSection.tsx";
import StockDetail from "./components/StockDetail.tsx";
import SymbolSearchBox from "./components/SymbolSearchBox.tsx";

const QUICK_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "SPY"];

export default function StocksApp() {
  const [inputValue, setInputValue] = useState("");
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);

  const handleSymbolSelect = useCallback((sym: string) => {
    const upper = sym.toUpperCase();
    setInputValue(upper);
    setActiveSymbol(upper);
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-y-auto">
      <div className="flex-1 py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-primary text-2xl font-bold tracking-tight mb-1">Stocks</h1>
            <p className="text-xs text-muted mb-4">Real-time quotes, charts, history, and news</p>

            <div className="flex gap-2">
              <SymbolSearchBox value={inputValue} onChange={setInputValue} onSelect={handleSymbolSelect} />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_SYMBOLS.map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => handleSymbolSelect(s)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer focus-ring border ${
                    activeSymbol === s
                      ? "bg-accent-subtle border-accent text-accent-soft"
                      : "bg-secondary border-primary text-muted hover:text-primary hover:border-accent-strong"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {activeSymbol && (
            <StockDetail
              symbol={activeSymbol}
              onClear={() => {
                setActiveSymbol(null);
                setInputValue("");
              }}
            />
          )}

          <div>
            <p className="text-2xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Market Leaders</p>
            <LeadersSection onSymbolSelect={handleSymbolSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}
