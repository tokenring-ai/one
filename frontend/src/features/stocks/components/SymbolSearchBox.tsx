import { Building2, Loader2, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFindStock } from "../../../rpc.ts";
import { changeSign, fmt, fmtPrice } from "../formatters.ts";
import type { StockQuote } from "../types.ts";

interface SymbolSearchBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (sym: string) => void;
}

export default function SymbolSearchBox({ value, onChange, onSelect }: SymbolSearchBoxProps) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 200);
    return () => clearTimeout(t);
  }, [value]);

  const search = useFindStock(debounced && debounced.length >= 1 ? debounced : undefined, 8);
  const results = useMemo(() => (search.data?.rows ?? []).filter(Boolean) as StockQuote[], [search.data]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handlePick = (sym: string) => {
    setOpen(false);
    onSelect(sym);
  };

  return (
    <div ref={wrapRef} className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Enter" && results[0]?.Symbol) {
            e.preventDefault();
            handlePick(results[0].Symbol);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search by symbol or company name (e.g. AAPL, Apple)"
        className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-primary rounded-xl text-sm text-primary placeholder:text-muted focus:border-accent outline-none"
      />

      {open && debounced.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto">
          {search.isLoading && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
            </div>
          )}
          {!search.isLoading && results.length === 0 && <div className="px-3 py-3 text-xs text-muted">No matches for "{debounced}"</div>}
          {results.map((r, i) => {
            const sym = r.Symbol ?? "";
            const logo = (r as { CLIconBright128?: string }).CLIconBright128;
            const change = Number(r.Change ?? 0);
            const isUp = change >= 0;
            return (
              <button
                type="button"
                key={`${sym}-${i}`}
                onClick={() => handlePick(sym.toUpperCase())}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-hover transition-colors text-left border-b border-primary/40 last:border-0"
              >
                <div className="w-7 h-7 rounded-md bg-secondary border border-primary flex items-center justify-center overflow-hidden shrink-0">
                  {logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : <Building2 className="w-3.5 h-3.5 text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-accent-soft">{sym}</span>
                    {r.ExchangeShortName && <span className="text-2xs text-muted">{r.ExchangeShortName}</span>}
                  </div>
                  <div className="text-xs text-muted truncate">{r.Name ?? r.ShortName ?? ""}</div>
                </div>
                {r.Price != null && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-primary">${fmtPrice(r.Price)}</div>
                    <div className={`text-2xs font-medium ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                      {changeSign(r.ChangePercent)}
                      {fmt(r.ChangePercent)}%
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
