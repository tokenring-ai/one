import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";
import formatError from "@tokenring-ai/utility/error/formatError";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useOpenAgentChat } from "../../apps/chat/useOpenAgentChat.ts";
import { checkpointRPCClient, useAgentCheckpointList, useAgentList } from "../../rpc.ts";
import LaunchButton from "../ui/LaunchButton.tsx";
import { toastManager } from "../ui/toast.tsx";

type CheckpointItem = { id: number; name: string; agentId: string; createdAt: number };

interface DeletedAgentRestorePanelProps {
  agentId: string;
  /**
   * Called with the restored agent's id instead of the dock behaviour below.
   * The hosting chat swaps itself for the restored agent's chat here.
   */
  onRestored?: (agentId: string) => void;
}

/**
 * Restore UI for a deleted/stopped agent that still has checkpoints. Rendered
 * above the chat view's empty state; pre-selects the most recent checkpoint
 * for this agentId. The restored agent keeps this id (the server reuses an id
 * nobody is running under), and the hosting chat reconnects to it in place.
 * Returns null while loading with no data, when loading fails, or when no
 * matching checkpoints exist — the caller owns the surrounding messaging.
 */
export default function DeletedAgentRestorePanel({ agentId, onRestored }: DeletedAgentRestorePanelProps) {
  const openAgentChat = useOpenAgentChat();
  const agents = useAgentList();
  const checkpoints = useAgentCheckpointList(agentId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  const agentCheckpoints = useMemo(() => {
    const items = (checkpoints.data?.items ?? []) as CheckpointItem[];
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
      const result = await checkpointRPCClient.launchAgentFromCheckpoint({ checkpointId: selected.id });
      switch (result.status) {
        case "success": {
          await agents.mutate();
          // The restored agent takes over the panel that launched the restore:
          // the old conversation is gone for good, so opening a second chat
          // panel would just leave the dead one behind. From any other context
          // (or a non-chat host), open/focus the agent's chat instead.
          if (onRestored) onRestored(result.agentId);
          else openAgentChat(result.agentId);
          break;
        }
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

  if (checkpoints.error && !checkpoints.data) {
    return (
      <div className="border-b border-primary bg-warning/10 px-4 py-3">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="min-w-0 flex-1 truncate">Couldn't load checkpoints: {formatError(checkpoints.error)}</span>
          <button
            type="button"
            onClick={() => void checkpoints.mutate()}
            className="px-2 py-1 text-xs font-medium rounded-md border border-primary hover:bg-hover focus-ring cursor-pointer shrink-0"
          >
            Retry
          </button>
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
            <span className="text-xs font-bold text-muted uppercase tracking-widest">Checkpoint</span>
            <select
              value={selectedId ?? ""}
              onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary focus-accent"
              aria-label="Select checkpoint to restore"
            >
              {agentCheckpoints.map(cp => (
                <option key={cp.id} value={cp.id}>
                  {cp.name} — {formatTimeAgo(cp.createdAt)}
                </option>
              ))}
            </select>
          </label>

          <LaunchButton
            loading={launching}
            disabled={!selected}
            onClick={() => void launchFromCheckpoint()}
            icon={RotateCcw}
            label="Restore"
            loadingLabel="Restore"
            aria-label={selected ? `Restore agent from checkpoint: ${selected.name}` : "Restore agent from checkpoint"}
            className="justify-center px-4 py-2 font-medium shadow-button-primary shrink-0"
          />
        </div>

        {selected ? (
          <p className="text-xs text-muted pl-0 sm:pl-11">
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
