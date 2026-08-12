import { ChevronDown, Globe, Loader2, WifiOff } from "lucide-react";
import { useState } from "react";
import InlineDropdown, { InlineDropdownItem } from "../../../components/ui/InlineDropdown.tsx";

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
    try {
      await onProviderChange(name);
    } finally {
      setChanging(false);
    }
  };

  return (
    <InlineDropdown
      header="Switch Provider"
      width="w-48"
      align="right"
      closeOnSelect
      disabled={changing}
      triggerClassName="hover:border-red-500/40"
      trigger={
        <>
          <Globe className="w-3 h-3" />
          <span className="font-medium text-primary max-w-32 truncate">{provider ?? "No provider"}</span>
          {changing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
        </>
      }
    >
      {availableProviders.map(p => {
        const isActive = p === provider;
        return (
          <InlineDropdownItem
            key={p}
            active={isActive}
            onClick={() => void switchProvider(p)}
            className={isActive ? "text-red-500 font-medium" : "text-primary"}
            leading={<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-red-500" : "bg-transparent"}`} />}
            trailing={null}
          >
            {p}
          </InlineDropdownItem>
        );
      })}
    </InlineDropdown>
  );
}
