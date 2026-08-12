import formatError from "@tokenring-ai/utility/error/formatError";
import { User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, useAgentTypes } from "../../rpc.ts";
import LaunchButton from "./LaunchButton.tsx";
import { toastManager } from "./toast.tsx";

export interface AgentLaunchPanelProps {
  /** Set of selected item identifiers */
  selectedItems: Set<string>;
  /** Singular label for the items (e.g., "file", "document", "message") */
  itemLabel: string;
  /** Called to clear all selections */
  onClear: () => void;
  /** Called to attach an item to the agent's chat context */
  attachItemToAgent: (agentId: string, itemId: string) => Promise<void>;
  /** Called after a successful launch (typically navigate to the agent page) */
  onNavigateToAgent: (agentId: string) => void;
  /** Default agent type to pre-select (falls back to first available) */
  defaultAgentType?: string;
  /**
   * When set, only these agent type ids are offered in the selector
   * (still resolved against the installed agent type catalog for display names).
   */
  allowedAgentTypes?: readonly string[];
  /** Label on the launch button (default: "Launch Agent") */
  launchLabel?: string;
  /** Optional plural form of itemLabel (default: itemLabel + "s") */
  itemLabelPlural?: string;
  /** Container className override */
  className?: string;
}

/**
 * Bottom-fixed action panel shown when items are selected in a list.
 * Creates an agent of the chosen type, attaches each selected item via
 * `attachItemToAgent`, then calls `onNavigateToAgent`.
 */
export default function AgentLaunchPanel({
  selectedItems,
  itemLabel,
  onClear,
  attachItemToAgent,
  onNavigateToAgent,
  defaultAgentType = "",
  allowedAgentTypes,
  launchLabel = "Launch Agent",
  itemLabelPlural,
  className,
}: AgentLaunchPanelProps) {
  const agentTypes = useAgentTypes();
  const [chosenType, setChosenType] = useState(defaultAgentType);
  const [launching, setLaunching] = useState(false);

  const types = useMemo(() => {
    const all = agentTypes.data ?? [];
    if (!allowedAgentTypes) return all;
    return all.filter(t => allowedAgentTypes.includes(t.type));
  }, [agentTypes.data, allowedAgentTypes]);

  const firstType = types[0]?.type ?? "";
  const effectiveType = chosenType || firstType;
  const count = selectedItems.size;
  const plural = itemLabelPlural ?? `${itemLabel}s`;
  const selectionLabel = count === 1 ? `1 ${itemLabel} selected` : `${count} ${plural} selected`;

  const launch = async () => {
    if (!effectiveType || launching || count === 0) return;
    setLaunching(true);
    try {
      const { id: newAgentId } = await agentRPCClient.createAgent({ agentType: effectiveType, headless: false });
      await Promise.all(Array.from(selectedItems).map(itemId => attachItemToAgent(newAgentId, itemId)));
      onNavigateToAgent(newAgentId);
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      className={cn("shrink-0 border-t border-primary bg-secondary px-4 py-3 flex items-center gap-3", className)}
      role="region"
      aria-label={`${selectionLabel}. Launch agent panel`}
      data-testid="agent-launch-panel"
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center" aria-hidden="true">
          <span className="text-white text-xs font-bold">{count}</span>
        </div>
        <span className="text-sm font-medium text-primary">{selectionLabel}</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClear}
        disabled={launching}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-primary text-xs transition-colors focus-ring rounded-md hover:bg-hover cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" /> Clear
      </button>

      <select
        value={effectiveType}
        onChange={e => setChosenType(e.target.value)}
        disabled={launching || types.length === 0}
        className="bg-input border border-primary rounded-lg px-2 py-1.5 text-xs text-primary focus-ring cursor-pointer disabled:opacity-50"
        aria-label="Agent type to launch"
      >
        {types.map(t => (
          <option key={t.type} value={t.type}>
            {t.displayName}
          </option>
        ))}
      </select>

      <LaunchButton
        loading={launching}
        disabled={!effectiveType || count === 0}
        onClick={() => void launch()}
        icon={User}
        label={launchLabel}
        loadingLabel={launchLabel}
        aria-label={`${launchLabel} with selected ${count === 1 ? itemLabel : plural}`}
        className="gap-2 px-4 font-medium shadow-button-primary"
      />
    </div>
  );
}
