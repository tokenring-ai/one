import { ChevronDown, Globe, Loader2, WifiOff } from "lucide-react";
import InlineDropdown, { InlineDropdownItem } from "../../../components/ui/InlineDropdown.tsx";

export default function ProviderSelector({
  provider,
  availableProviders,
  loading,
  error,
  onProviderChange,
  onRetry,
}: {
  provider: string | null;
  availableProviders: string[];
  loading: boolean;
  error?: unknown;
  onProviderChange: (p: string) => void;
  onRetry?: () => void;
}) {
  if (loading && availableProviders.length === 0) {
    return (
      <span className="text-xs text-muted flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading providers
      </span>
    );
  }

  if (error && availableProviders.length === 0) {
    return (
      <span className="text-xs text-warning flex items-center gap-1.5">
        <WifiOff className="w-3 h-3" /> Providers unavailable
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-accent hover:underline cursor-pointer">
            Retry
          </button>
        )}
      </span>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <span className="text-xs text-muted flex items-center gap-1" title="Configure a calendar plugin (e.g. Google Calendar) to sync remote events">
        <WifiOff className="w-3 h-3" /> No providers
      </span>
    );
  }

  return (
    <InlineDropdown
      header="Switch Provider"
      width="w-48"
      align="right"
      closeOnSelect
      triggerClassName="hover:border-sky-500/40"
      trigger={
        <>
          <Globe className="w-3 h-3" />
          <span className="font-medium text-primary max-w-32 truncate">{provider ?? "No provider"}</span>
          <ChevronDown className="w-3 h-3" />
        </>
      }
    >
      {availableProviders.map(p => {
        const isActive = p === provider;
        return (
          <InlineDropdownItem
            key={p}
            active={isActive}
            onClick={() => onProviderChange(p)}
            className={isActive ? "text-sky-500 font-medium" : "text-primary"}
            leading={<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-sky-500" : "bg-transparent"}`} />}
            trailing={null}
          >
            {p}
          </InlineDropdownItem>
        );
      })}
    </InlineDropdown>
  );
}
