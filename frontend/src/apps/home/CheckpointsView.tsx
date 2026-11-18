import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";
import formatError from "@tokenring-ai/utility/error/formatError";
import { History, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LaunchButton from "../../components/ui/LaunchButton.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useSearchFilter } from "../../hooks/useSearchFilter.ts";
import { usePaneLink } from "../../layout/hooks.ts";
import { checkpointLabel } from "../../lib/checkpointLabel.ts";
import { checkpointRPCClient, useAgentList, useCheckpointList } from "../../rpc.ts";
import { CHAT_VIEW } from "../chat/ids.ts";

type CheckpointRow = {
  id: number;
  name: string;
  agentId: string;
  agentType?: string;
  createdAt: number;
};

type PayloadState =
  | { id: number; status: "loading" }
  | { id: number; status: "ready"; payload: string }
  | { id: number; status: "missing" }
  | { id: number; status: "error"; error: string };

/** Saved checkpoints; relaunching one opens the new agent's chat in the current app. */
export default function CheckpointsView() {
  const agents = useAgentList();
  const openPane = usePaneLink();
  const checkpoints = useCheckpointList();
  const [openId, setOpenId] = useState<number | null>(null);
  const [payload, setPayload] = useState<PayloadState | null>(null);
  const [launchingId, setLaunchingId] = useState<number | null>(null);

  const sorted = useMemo(() => {
    const items = (checkpoints.data?.items ?? []) as CheckpointRow[];
    return [...items].sort((a, b) => b.createdAt - a.createdAt);
  }, [checkpoints.data]);

  const { query, setQuery, filtered } = useSearchFilter({
    items: sorted,
    searchFields: checkpoint => `${checkpoint.name} ${checkpoint.agentType ?? ""} ${checkpoint.agentId}`,
  });

  useEffect(() => {
    if (openId === null) return;
    const live = { current: true };
    setPayload({ id: openId, status: "loading" });
    void (async () => {
      try {
        const result = await checkpointRPCClient.getCheckpoint({ id: openId });
        if (!live.current) return;
        if (result.status === "checkpointNotFound") {
          setPayload({ id: openId, status: "missing" });
          return;
        }
        setPayload({ id: openId, status: "ready", payload: JSON.stringify(result.checkpoint, null, 2) });
      } catch (error) {
        if (live.current) setPayload({ id: openId, status: "error", error: formatError(error) });
      }
    })();
    return () => {
      live.current = false;
    };
  }, [openId]);

  const launchFromCheckpoint = async (checkpointId: number) => {
    setLaunchingId(checkpointId);
    try {
      const result = await checkpointRPCClient.launchAgentFromCheckpoint({ checkpointId });
      switch (result.status) {
        case "success":
          await agents.mutate();
          openPane(CHAT_VIEW, { agentId: result.agentId });
          break;
        case "checkpointNotFound":
          toastManager.error("Checkpoint not found", { duration: 3000 });
          break;
        default: {
          const exhaustive: { status: string } = result satisfies never;
          toastManager.error(`Failed to launch agent from checkpoint, unknown result: ${exhaustive.status}`, { duration: 3000 });
        }
      }
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setLaunchingId(null);
    }
  };

  if (checkpoints.error && !checkpoints.data) {
    return (
      <ViewShell pad="compact">
        <ErrorState title="Failed to load checkpoints" error={checkpoints.error} onRetry={() => void checkpoints.mutate()} />
      </ViewShell>
    );
  }

  if (checkpoints.isLoading && !checkpoints.data) return <LoadingState size="sm" message="Loading checkpoints…" />;

  if (!checkpoints.data?.items.length) {
    return (
      <ViewShell pad="compact">
        <EmptyState
          icon={History}
          title="No checkpoints yet"
          hint="Checkpoints are saved as agents finish handling each message (when auto-checkpointing is on), or manually with /agent checkpoint create. Launch one here to pick that agent up where it was."
          variant="compact"
        />
      </ViewShell>
    );
  }

  const { total } = checkpoints.data;
  const shown = checkpoints.data.items.length;
  const openPayload = payload && payload.id === openId ? payload : null;

  return (
    <ViewShell pad="compact">
      <div className="space-y-2">
        {/* The tab or widget title names the list; this line only says how much of it is shown. */}
        <p className="px-1 text-xs text-muted" title={shown < total ? `Showing the ${shown} most recent checkpoints` : undefined}>
          {shown < total ? `${shown} most recent of ${total}` : total === 1 ? "1 checkpoint" : `${total} checkpoints`}
        </p>
        <SearchInput value={query} onChange={setQuery} placeholder="Filter checkpoints..." aria-label="Filter checkpoints" />
        {filtered.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted">No checkpoints matching "{query}"</p>
        ) : (
          <ul className="border border-primary rounded-lg divide-y divide-primary/60 overflow-hidden" aria-label="Checkpoints">
            {filtered.map(checkpoint => {
              const open = openId === checkpoint.id;
              return (
                <li key={checkpoint.id}>
                  <div className="flex items-center gap-2 px-2 py-2">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={`${open ? "Close" : "Open"} checkpoint ${checkpointLabel(checkpoint.name)}`}
                      onClick={() => setOpenId(open ? null : checkpoint.id)}
                      className="flex-1 min-w-0 text-left rounded-md px-1 py-0.5 hover:bg-hover focus-ring cursor-pointer"
                    >
                      <span className="block text-sm font-medium text-primary truncate">{checkpointLabel(checkpoint.name)}</span>
                      <span className="block text-xs text-muted truncate">
                        {formatTimeAgo(checkpoint.createdAt)}
                        {checkpoint.agentType ? ` · ${checkpoint.agentType}` : ""}
                      </span>
                    </button>
                    <LaunchButton
                      loading={launchingId === checkpoint.id}
                      onClick={() => void launchFromCheckpoint(checkpoint.id)}
                      icon={RotateCcw}
                      loadingLabel="Launch"
                      aria-label={`Launch agent from checkpoint: ${checkpointLabel(checkpoint.name)}`}
                      className="shrink-0 px-3 font-medium rounded-md shadow-button-primary"
                    />
                  </div>
                  {open && (
                    <div className="px-3 pb-3">
                      {openPayload?.status === "loading" && <p className="text-xs text-muted">Loading stored checkpoint…</p>}
                      {openPayload?.status === "missing" && <p className="text-xs text-muted">This checkpoint is no longer stored.</p>}
                      {openPayload?.status === "error" && <p className="text-xs text-error">{openPayload.error}</p>}
                      {openPayload?.status === "ready" && (
                        <pre
                          role="region"
                          aria-label={`Stored checkpoint ${checkpointLabel(checkpoint.name)}`}
                          className="max-h-64 overflow-auto rounded-md border border-primary bg-tertiary p-2 text-xs font-mono text-secondary whitespace-pre-wrap break-all"
                        >
                          {openPayload.payload}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ViewShell>
  );
}
