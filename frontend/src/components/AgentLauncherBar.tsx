import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { agentRPCClient, useAgentTypes } from "../rpc.ts";
import { toastManager } from "./ui/toast.tsx";

interface AgentLauncherBarProps {
  /** Pre-selected agent type. Defaults to first available type. */
  defaultAgentType?: string;
  /** Label shown on the launch button */
  buttonLabel: string;
  /** Tailwind classes applied to the launch button */
  buttonClassName: string;
  /** Called with the new agent's id after a successful launch */
  onLaunch: (agentId: string) => void;
}

/**
 * Compact agent-type selector and launch button, designed to sit inside a
 * toolbar or header bar. Calls `onLaunch` with the created agent id.
 */
export default function AgentLauncherBar({ defaultAgentType, buttonLabel, buttonClassName, onLaunch }: AgentLauncherBarProps) {
  const agentTypes = useAgentTypes();
  const [selectedType, setSelectedType] = useState<string>(defaultAgentType ?? "");
  const [launching, setLaunching] = useState(false);

  // Once types load, pre-select only if a defaultAgentType was provided
  useEffect(() => {
    if (selectedType) return;
    const types = agentTypes.data ?? [];
    if (types.length === 0) return;
    if (defaultAgentType && types.find(t => t.type === defaultAgentType)) {
      setSelectedType(defaultAgentType);
    }
  }, [agentTypes.data, defaultAgentType, selectedType]);

  const handleLaunch = async () => {
    if (!selectedType) return;
    setLaunching(true);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: selectedType, headless: false });
      onLaunch(id);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  };

  const types = agentTypes.data ?? [];

  return (
    <div className="flex items-center gap-1.5">
      {/* Agent type selector */}
      <select
        value={selectedType}
        onChange={e => setSelectedType(e.target.value)}
        disabled={launching || types.length === 0}
        className="bg-input border border-primary rounded-lg py-1.5 pl-2.5 pr-6 text-xs text-primary focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all disabled:opacity-50 cursor-pointer appearance-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236b7280' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
        }}
        aria-label="Select agent type"
      >
        {types.length === 0 ? (
          <option value="">Loading…</option>
        ) : (
          <option value="" disabled>
            Select agent…
          </option>
        )}
        {types.map(t => (
          <option key={t.type} value={t.type}>
            {t.displayName}
          </option>
        ))}
      </select>

      {/* Launch button */}
      <button
        type="button"
        onClick={() => void handleLaunch()}
        disabled={launching || !selectedType}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        {launching ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching…
          </>
        ) : (
          buttonLabel
        )}
      </button>
    </div>
  );
}
