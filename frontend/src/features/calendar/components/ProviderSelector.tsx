import { ChevronDown, Globe, Loader2, WifiOff } from "lucide-react";
import { useState } from "react";

export default function ProviderSelector({
  provider,
  availableProviders,
  loading,
  onProviderChange,
}: {
  provider: string | null;
  availableProviders: string[];
  loading: boolean;
  onProviderChange: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (loading && availableProviders.length === 0) {
    return (
      <span className="text-2xs text-muted flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading providers
      </span>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <span className="text-2xs text-muted flex items-center gap-1">
        <WifiOff className="w-3 h-3" /> No providers
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:border-sky-500/40 transition-all focus-ring cursor-pointer"
      >
        <Globe className="w-3 h-3" />
        <span className="font-medium text-primary max-w-32 truncate">{provider ?? "No provider"}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-primary">
            <p className="text-2xs font-semibold text-muted uppercase tracking-wider">Switch Provider</p>
          </div>
          {availableProviders.map(p => (
            <button
              type="button"
              key={p}
              onClick={() => {
                onProviderChange(p);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring ${p === provider ? "text-sky-500 font-medium" : "text-primary"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p === provider ? "bg-sky-500" : "bg-transparent"}`} />
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
