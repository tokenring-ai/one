import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useRef, useState } from "react";
import { toastManager } from "../components/ui/toast.tsx";
import { useRefSync } from "./useRefSync.ts";

export interface UseEntityDeleteOptions<TId extends string | number> {
  /**
   * The ID of the entity currently shown in the route (e.g., routeAgentId, routeWorkflowName).
   * Used to determine whether to navigate away after deletion.
   */
  currentRouteId: TId | null;
  /**
   * Navigate to the overview/empty state (e.g., "/agents", "/workflows").
   */
  navigateToOverview: () => void;
  /**
   * Refresh the entity list after deletion.
   */
  refreshList: () => void;
  /**
   * Optional: clear local state (drafts, caches) associated with the entity.
   */
  clearLocalState?: (id: TId) => void;
  /**
   * Optional: custom success message. Defaults to `Deleted "${displayName}"`.
   */
  successMessage?: (displayName: string) => string;
  /**
   * Optional: custom error message. Defaults to `formatError(error)`.
   */
  errorMessage?: (error: unknown) => string;
  /**
   * Optional: toast duration for success. Defaults to 3000ms.
   */
  successDuration?: number;
  /**
   * Optional: toast duration for errors. Defaults to 5000ms.
   */
  errorDuration?: number;
}

export interface UseEntityDeleteReturn<TId extends string | number> {
  /** Whether a delete is currently in progress */
  isDeleting: boolean;
  /** The ID being deleted (for spinner state) */
  deletingId: TId | null;
  /**
   * Delete an entity by ID.
   * @param id - The entity ID
   * @param displayName - Display name for toast messages
   * @param deleteFn - Async function that performs the deletion
   */
  deleteEntity: (id: TId, displayName: string, deleteFn: () => Promise<void>) => Promise<void>;
}

const defaultSuccessMessage = (displayName: string) => `Deleted "${displayName}"`;
const defaultErrorMessage = (error: unknown) => formatError(error);

/**
 * Manages the full delete lifecycle for a route-scoped entity:
 * guard concurrent deletes → delete via injected RPC → clear local state →
 * navigate away if the current route points to the deleted entity → toast → refresh list.
 *
 * Confirmation UI is intentionally separate (compose with useConfirmDialog / ConfirmModal).
 */
export function useEntityDelete<TId extends string | number>(options: UseEntityDeleteOptions<TId>): UseEntityDeleteReturn<TId> {
  const {
    currentRouteId,
    navigateToOverview,
    refreshList,
    clearLocalState,
    successMessage = defaultSuccessMessage,
    errorMessage = defaultErrorMessage,
    successDuration = 3000,
    errorDuration = 5000,
  } = options;

  const [deletingId, setDeletingId] = useState<TId | null>(null);
  // Synchronous guard so double-clicks cannot start the same delete twice before re-render.
  // Must be a stable useRef — useRefSync(new Set()) would reset the set every render.
  const deletingIdsRef = useRef(new Set<TId>());

  // Keep latest options in a ref so deleteEntity stays stable and never closes over stale route IDs.
  const optionsRef = useRefSync({
    currentRouteId,
    navigateToOverview,
    refreshList,
    clearLocalState,
    successMessage,
    errorMessage,
    successDuration,
    errorDuration,
  });

  const deleteEntity = useCallback(async (id: TId, displayName: string, deleteFn: () => Promise<void>) => {
    if (deletingIdsRef.current.has(id)) return;
    deletingIdsRef.current.add(id);
    setDeletingId(id);

    const opts = optionsRef.current;
    try {
      await deleteFn();
      // Clear local caches first, then leave the route before list refresh so the
      // deleted entity never briefly looks "not found" / re-highlighted.
      opts.clearLocalState?.(id);
      if (opts.currentRouteId === id) {
        opts.navigateToOverview();
      }
      toastManager.success(opts.successMessage(displayName), { duration: opts.successDuration });
      opts.refreshList();
    } catch (error) {
      toastManager.error(opts.errorMessage(error), { duration: opts.errorDuration });
    } finally {
      deletingIdsRef.current.delete(id);
      setDeletingId(prev => (prev === id ? null : prev));
    }
  }, []);

  return {
    isDeleting: deletingId !== null,
    deletingId,
    deleteEntity,
  };
}
