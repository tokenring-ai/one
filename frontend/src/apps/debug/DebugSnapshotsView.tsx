import formatError from "@tokenring-ai/utility/error/formatError";
import { RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import ListItemWithActions from "../../components/ui/ListItemWithActions.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { cn } from "../../lib/utils.ts";
import { useDebugSnapshots } from "../../rpc.ts";
import Select from "../../ui/select.tsx";
import { useRouteParamsFor } from "../panelHooks.ts";
import { formatBytes, formatCaptureTime } from "./formatters.ts";
import { deleteSnapshots } from "./retention.ts";
import { DEBUG_PATH, DEBUG_SNAPSHOT_VIEW, kindLabel, useDebugNavigation, useDeleteSnapshot } from "./shared.tsx";

const ALL_KINDS = "all";

/**
 * Navigator for the Debug app: every captured snapshot, newest first as
 * the server lists them. Rows open the snapshot's viewer tab; the snapshot
 * named by the URL is highlighted.
 */
export default function DebugSnapshotsView() {
  const routeSnapshot = useRouteParamsFor(DEBUG_SNAPSHOT_VIEW)?.snapshotId;
  const snapshots = useDebugSnapshots();
  const navigate = useNavigate();
  const { openSnapshot, closeSnapshot } = useDebugNavigation();
  const { deleteSnapshot, ConfirmDialog } = useDeleteSnapshot();
  const { openConfirm, Dialog: DeleteAllDialog } = useConfirmDialog();
  const [kindFilter, setKindFilter] = useState(ALL_KINDS);
  const [deletingAll, setDeletingAll] = useState(false);

  const selectedName = routeSnapshot ?? null;
  const allSnapshots = useMemo(() => snapshots.data ?? [], [snapshots.data]);
  const kinds = useMemo(() => [...new Set(allSnapshots.map(snapshot => snapshot.kind))].sort(), [allSnapshots]);
  // A filter for a kind whose last snapshot was deleted falls back to everything.
  const activeKind = kindFilter !== ALL_KINDS && kinds.includes(kindFilter) ? kindFilter : ALL_KINDS;
  const snapshotList = activeKind === ALL_KINDS ? allSnapshots : allSnapshots.filter(snapshot => snapshot.kind === activeKind);

  const deleteAll = async () => {
    const names = snapshotList.map(snapshot => snapshot.name);
    if (names.length === 0) return;
    const scope = activeKind === ALL_KINDS ? "" : ` ${kindLabel(activeKind)}`;
    const confirmed = await openConfirm({
      title: `Delete all${scope} snapshots`,
      message: `Delete ${names.length}${scope} snapshot${names.length === 1 ? "" : "s"} from the workspace debug folder? This cannot be undone.`,
      confirmText: `Delete ${names.length}`,
      variant: "danger",
      dontAskAgain: false,
    });
    if (!confirmed) return;
    setDeletingAll(true);
    try {
      const { deleted, failed } = await deleteSnapshots(names);
      for (const name of deleted) closeSnapshot(name);
      if (routeSnapshot && deleted.includes(routeSnapshot)) void navigate(DEBUG_PATH, { replace: true });
      if (failed.length > 0) toastManager.error(`Could not delete ${failed.length} snapshot${failed.length === 1 ? "" : "s"}`, { duration: 5000 });
      else toastManager.success(`Deleted ${deleted.length} snapshot${deleted.length === 1 ? "" : "s"}`, { duration: 3000 });
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setDeletingAll(false);
      await snapshots.mutate();
    }
  };

  let body: React.ReactNode;
  if (snapshots.isLoading && snapshotList.length === 0) {
    body = <LoadingState message="Loading snapshots…" size="sm" />;
  } else if (snapshots.error) {
    body = <ErrorState title="Could not load snapshots" error={snapshots.error} onRetry={() => void snapshots.mutate()} />;
  } else if (allSnapshots.length === 0) {
    body = <EmptyState title="No snapshots yet" hint="Capture one to get started." variant="inline" />;
  } else {
    body = (
      <ul className="p-2 space-y-1" aria-label="Snapshots">
        {snapshotList.map(snapshot => (
          <li key={snapshot.name}>
            <ListItemWithActions
              id={snapshot.name}
              selected={selectedName === snapshot.name}
              onPrimary={() => openSnapshot(snapshot.name)}
              primaryProps={{ "aria-label": `Open ${snapshot.name}` }}
              action={
                <button
                  type="button"
                  onClick={() => void deleteSnapshot(snapshot.name)}
                  className="p-1 text-muted hover:text-red-500 rounded-md transition-colors focus-ring cursor-pointer"
                  aria-label={`Delete ${snapshot.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              }
            >
              <span className="block text-xs text-primary truncate font-mono">{snapshot.name}</span>
              <span className="block text-xs text-muted">
                <span className="inline-block px-1 mr-1 rounded bg-tertiary text-secondary" data-testid="snapshot-kind">
                  {kindLabel(snapshot.kind)}
                </span>
                {formatCaptureTime(snapshot.capturedAt)} · {formatBytes(snapshot.sizeBytes)}
              </span>
            </ListItemWithActions>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ViewShell
      tone="sidebar"
      scroll={false}
      header={
        <NavigationSidebarHeader
          meta={snapshotList.length}
          actions={[
            {
              icon: <Trash2 className="w-3.5 h-3.5" />,
              label: activeKind === ALL_KINDS ? "Delete all snapshots" : `Delete all ${kindLabel(activeKind)} snapshots`,
              onClick: () => void deleteAll(),
              disabled: deletingAll || snapshotList.length === 0,
            },
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", snapshots.isValidating && "animate-spin")} />,
              label: "Refresh snapshots",
              onClick: () => void snapshots.mutate(),
            },
          ]}
        />
      }
    >
      {kinds.length > 1 && (
        <div className="shrink-0 px-2 pt-2">
          <Select aria-label="Filter snapshots by kind" value={activeKind} onChange={setKindFilter}>
            <option value={ALL_KINDS}>All kinds ({allSnapshots.length})</option>
            {kinds.map(kind => (
              <option key={kind} value={kind}>
                {kindLabel(kind)} ({allSnapshots.filter(snapshot => snapshot.kind === kind).length})
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="h-full overflow-y-auto">{body}</div>
      <ConfirmDialog />
      <DeleteAllDialog />
    </ViewShell>
  );
}
