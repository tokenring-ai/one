import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../components/ui/toast.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useLayoutApi } from "../../layout/context.ts";
import { useLayout, usePaneLink } from "../../layout/hooks.ts";
import { appRPCClient, useDebugSnapshots } from "../../rpc.ts";
import { useRouteParamsFor } from "../panelHooks.ts";

/**
 * Vocabulary shared by the Debug views (capture controls, snapshot list,
 * snapshot viewer). Each view is its own React subtree, so anything two of
 * them need lives here or in {@link ./debugStore.ts}.
 */

export const DEBUG_PATH = "/debug";

export const DEBUG_CAPTURE_VIEW = "debug-capture";
export const DEBUG_SNAPSHOTS_VIEW = "debug-snapshots";
export const DEBUG_SNAPSHOT_VIEW = "debug-snapshot";
/** `/debug` with no snapshot: the "select a snapshot" tab, closed once a snapshot opens. */
export const DEBUG_START_VIEW = "debug-start";

/** Fallback group names for targets from a server that does not send `displayName`. */
const KIND_LABELS: Record<string, string> = { app: "Application", agent: "Agents" };

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export interface DebugTargetGroup<T> {
  kind: string;
  label: string;
  targets: T[];
}

/**
 * Groups capture targets by their source kind, in first-seen order (the server lists
 * application state first). The heading is the source's `displayName` when the server
 * provides it.
 */
export function groupTargetsBySource<T extends { kind: string; displayName?: string | undefined }>(targets: readonly T[]): DebugTargetGroup<T>[] {
  const groups = new Map<string, DebugTargetGroup<T>>();
  for (const target of targets) {
    let group = groups.get(target.kind);
    if (!group) {
      group = { kind: target.kind, label: target.displayName ?? kindLabel(target.kind), targets: [] };
      groups.set(target.kind, group);
    }
    group.targets.push(target);
  }
  return [...groups.values()];
}

export function debugPath(snapshotId?: string | null): string {
  return snapshotId ? `${DEBUG_PATH}/${encodeURIComponent(snapshotId)}` : DEBUG_PATH;
}

/**
 * Navigation between the Debug views: opens the snapshot's tab (navigating to
 * its URL, so a closed tab re-opens even when the URL is unchanged). The
 * "select a snapshot" start tab has done its job then, so it closes.
 */
export function useDebugNavigation() {
  const open = usePaneLink();
  const layout = useLayout();
  const api = useLayoutApi();

  const openSnapshot = useCallback(
    (snapshotId: string) => {
      open(DEBUG_SNAPSHOT_VIEW, { snapshotId });
    },
    [open, layout],
  );

  /** True while some tab already shows a snapshot: used to leave an inspection in progress alone. */
  const hasOpenSnapshot = useCallback(() => Object.values(api.store.getState().panels).some(panel => panel.viewId === DEBUG_SNAPSHOT_VIEW), [api]);

  /** Closes the tab showing `snapshotId`, if any (after a delete). */
  const closeSnapshot = useCallback((snapshotId: string) => layout.close(DEBUG_SNAPSHOT_VIEW, { snapshotId }), [layout]);

  return { openSnapshot, hasOpenSnapshot, closeSnapshot };
}

/**
 * Confirm-then-delete for a snapshot, shared by the snapshot list and the
 * snapshot viewer: closes the snapshot's panel, leaves its URL and refreshes
 * the list. Render `ConfirmDialog` somewhere in the calling view.
 */
export function useDeleteSnapshot() {
  const navigate = useNavigate();
  const routeSnapshot = useRouteParamsFor(DEBUG_SNAPSHOT_VIEW)?.snapshotId;
  const { closeSnapshot } = useDebugNavigation();
  const snapshotsMutate = useDebugSnapshots().mutate;
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const deleteSnapshot = useCallback(
    async (name: string): Promise<boolean> => {
      const confirmed = await openConfirm({
        id: "debug:snapshot-delete",
        title: "Delete snapshot",
        message: `Delete ${name}? This cannot be undone.`,
        confirmText: "Delete",
        variant: "danger",
      });
      if (!confirmed) return false;
      try {
        await appRPCClient.deleteDebugSnapshot({ name });
        closeSnapshot(name);
        if (routeSnapshot === name) void navigate(DEBUG_PATH, { replace: true });
        await snapshotsMutate();
        toastManager.success(`Deleted ${name}`, { duration: 3000 });
        return true;
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
        return false;
      }
    },
    [closeSnapshot, navigate, openConfirm, routeSnapshot, snapshotsMutate],
  );

  return { deleteSnapshot, ConfirmDialog };
}
