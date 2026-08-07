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
  onProviderChange: (p: string) => void | Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [open, setOpen] = useState(false);

  if (loading && availableProviders.length === 0) {
    return (
      <span className="text-xs text-muted flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading providers
      </span>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <span className="text-xs text-muted flex items-center gap-1">
        <WifiOff className="w-3 h-3" /> No providers configured
      </span>
    );
  }

  const switchProvider = async (name: string) => {
    setChanging(true);
    setOpen(false);
    try {
      await onProviderChange(name);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={changing}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:border-red-500/40 transition-all focus-ring cursor-pointer disabled:opacity-50"
      >
        <Globe className="w-3 h-3" />
        <span className="font-medium text-primary max-w-32 truncate">{provider ?? "No provider"}</span>
        {changing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 w-48 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-primary">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Switch Provider</p>
            </div>
            {availableProviders.map(p => (
              <button
                type="button"
                key={p}
                onClick={() => void switchProvider(p)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring ${p === provider ? "text-red-500 font-medium" : "text-primary"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p === provider ? "bg-red-500" : "bg-transparent"}`} />
                {p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
