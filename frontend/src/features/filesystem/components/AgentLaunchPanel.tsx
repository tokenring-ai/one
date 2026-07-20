import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../../components/ui/toast.tsx";
import { agentRPCClient, filesystemRPCClient, useAgentTypes } from "../../../rpc.ts";

interface AgentLaunchPanelProps {
  selectedPaths: Set<string>;
  onClear: () => void;
}

export default function AgentLaunchPanel({ selectedPaths, onClear }: AgentLaunchPanelProps) {
  const navigate = useNavigate();
  const agentTypes = useAgentTypes();
  const [chosenType, setChosenType] = useState("");
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const newChosenType = agentTypes.data?.[0];
    if (!chosenType && newChosenType) {
      setChosenType(newChosenType.type);
    }
  }, [agentTypes.data, chosenType]);

  const launch = async () => {
    if (!chosenType) return;
    setLaunching(true);
    try {
      const { id: newAgentId } = await agentRPCClient.createAgent({ agentType: chosenType, headless: false });
      await Promise.all(Array.from(selectedPaths).map(file => filesystemRPCClient.addFileToChat({ agentId: newAgentId, file })));
      void navigate(`/agent/${newAgentId}`);
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  };

  const count = selectedPaths.size;

  return (
    <div className="shrink-0 border-t border-primary bg-secondary px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 bg-accent rounded-full flex items-center justify-center">
          <span className="text-white text-2xs font-bold">{count}</span>
        </div>
        <span className="text-sm font-medium text-primary">{count === 1 ? "1 file selected" : `${count} files selected`}</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-primary text-xs transition-colors focus-ring rounded-md hover:bg-hover cursor-pointer"
        aria-label="Clear selection"
      >
        <X className="w-3.5 h-3.5" /> Clear
      </button>

      <select
        value={chosenType}
        onChange={e => setChosenType(e.target.value)}
        className="bg-input border border-primary rounded-lg px-2 py-1.5 text-xs text-primary focus-ring cursor-pointer"
        aria-label="Agent type to launch"
      >
        {(agentTypes.data ?? []).map(t => (
          <option key={t.type} value={t.type}>
            {t.displayName}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={launch}
        disabled={launching || !chosenType}
        className="flex items-center gap-2 px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring shadow-button-primary disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Launch agent with selected files"
      >
        {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
        Launch Agent
      </button>
    </div>
  );
}
