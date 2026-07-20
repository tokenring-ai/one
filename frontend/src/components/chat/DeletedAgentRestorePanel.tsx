import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";
import formatError from "@tokenring-ai/utility/error/formatError";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkpointRPCClient, useAgentList, useCheckpointList } from "../../rpc.ts";
import { toastManager } from "../ui/toast.tsx";

type CheckpointItem = { id: number; name: string; agentId: string; createdAt: number };

interface DeletedAgentRestorePanelProps {
  agentId: string;
}

/**
 * Top-of-page restore UI for a deleted/stopped agent that still has checkpoints.
 * Pre-selects the most recent checkpoint for this agentId.
 * Returns null while loading with no data, or when no matching checkpoints exist.
 */
export default function DeletedAgentRestorePanel({ agentId }: DeletedAgentRestorePanelProps) {
  const navigate = useNavigate();
  const agents = useAgentList();
  const checkpoints = useCheckpointList();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  const agentCheckpoints = useMemo(() => {
    const items = (checkpoints.data ?? []) as CheckpointItem[];
    return items.filter(cp => cp.agentId === agentId).sort((a, b) => b.createdAt - a.createdAt);
  }, [checkpoints.data, agentId]);

  // Keep the most recent checkpoint selected by default (and when the list updates)
  useEffect(() => {
    if (agentCheckpoints.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId(prev => {
      if (prev != null && agentCheckpoints.some(cp => cp.id === prev)) return prev;
      return agentCheckpoints[0]!.id;
    });
  }, [agentCheckpoints]);

  const selected = selectedId != null ? (agentCheckpoints.find(cp => cp.id === selectedId) ?? null) : null;
  const isLoading = checkpoints.isLoading && !checkpoints.data;

  const launchFromCheckpoint = async () => {
    if (!selected) return;
    setLaunching(true);
    try {
      const result = await checkpointRPCClient.launchAgentFromCheckpoint({ checkpointId: selected.id, headless: false });
      switch (result.status) {
        case "success":
          await agents.mutate();
          void navigate(`/agent/${result.agentId}`);
          break;
        case "checkpointNotFound":
          toastManager.error("Checkpoint not found", { duration: 3000 });
          break;
        default: {
          const exhaustive: { status: string } = result satisfies never;
          toastManager.error(`Failed to restore checkpoint: ${exhaustive.status}`, { duration: 3000 });
          break;
        }
      }
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setLaunching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border-b border-primary bg-warning/10 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Looking for checkpoints…
        </div>
      </div>
    );
  }

  if (agentCheckpoints.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-primary bg-warning/10" role="region" aria-label="Restore deleted agent">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0 mt-0.5">
            <History className="w-4 h-4 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">This agent is no longer running</p>
            <p className="text-xs text-muted mt-0.5">You can restore it from a checkpoint. The most recent checkpoint is selected below.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 pl-0 sm:pl-11">
          <label className="flex-1 min-w-0 space-y-1">
            <span className="text-2xs font-bold text-muted uppercase tracking-widest">Checkpoint</span>
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary focus-accent"
              aria-label="Select checkpoint to restore"
            >
              {agentCheckpoints.map(cp => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} — {formatTimeAgo(cp.createdAt)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void launchFromCheckpoint()}
            disabled={!selected || launching}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary shrink-0"
            aria-label={selected ? `Restore agent from checkpoint: ${selected.name}` : "Restore agent from checkpoint"}
          >
            {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Restore
          </button>
        </div>

        {selected ? (
          <p className="text-2xs text-muted pl-0 sm:pl-11">
            Selected: <span className="text-primary font-medium">{selected.name}</span>
            <span className="mx-1.5 opacity-40">·</span>
            {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
            <span className="mx-1.5 opacity-40">·</span>
            {agentCheckpoints.length} checkpoint{agentCheckpoints.length === 1 ? "" : "s"} available
          </p>
        ) : null}
      </div>
    </div>
  );
}
