import { useCallback, useEffect, useRef } from "react";
import { useRefSync } from "./useRefSync.ts";

export type StreamingStrategy<TMeta> = {
  type: "streaming";
  /** Latest remote metadata for the open document (null if unknown). */
  remoteMeta: TMeta | null;
  /** Extract a comparable updatedAt string from remote metadata. */
  getUpdatedAt: (meta: TMeta) => string;
};

export type PollingStrategy = {
  type: "polling";
  /**
   * Fetch the latest remote snapshot. Return null when the document is
   * unavailable. `updatedAt` is compared against the last loaded timestamp.
   */
  poll: () => Promise<{ content?: unknown; updatedAt: string } | null>;
  /** Polling interval in ms. Default: 3000. */
  intervalMs?: number;
};

export interface UseRemoteChangeDetectionOptions<TMeta = string> {
  /** Key identifying the currently open document (e.g. "topic/item-name"). */
  documentKey: string | null;
  /** Whether the document is ready (loaded and matching the URL). */
  isDocumentReady: boolean;
  /** Whether the user has unsaved local edits. */
  isDirty: boolean;
  /**
   * Strategy for detecting remote changes.
   * Either streaming metadata or a polling function.
   */
  strategy: StreamingStrategy<TMeta> | PollingStrategy;
  /**
   * Called when a remote change is detected and the user has no dirty edits.
   * Should load the fresh content into the editor silently.
   */
  onRemoteChange: () => Promise<void> | void;
}

export interface UseRemoteChangeDetectionReturn {
  /**
   * Record the timestamp of the content currently in the editor.
   * Call after a successful load or save so remote updates can be compared.
   * Pass `null` when closing the document.
   */
  markLoaded: (updatedAt: string | null) => void;
}

const DEFAULT_POLL_INTERVAL_MS = 3000;

/**
 * Detect when the server-side content of an open document has changed
 * and auto-refresh the editor if the user has no unsaved edits.
 *
 * Supports streaming (push) and polling strategies via a discriminated union.
 */
export function useRemoteChangeDetection<TMeta = string>(options: UseRemoteChangeDetectionOptions<TMeta>): UseRemoteChangeDetectionReturn {
  const { documentKey, isDocumentReady, isDirty, strategy, onRemoteChange } = options;

  const loadedUpdatedAtRef = useRef<string | null>(null);
  const isDirtyRef = useRefSync(isDirty);
  const documentKeyRef = useRefSync(documentKey);
  const onRemoteChangeRef = useRefSync(onRemoteChange);

  // Extract strategy fields for stable effect dependencies (no conditional hooks).
  const strategyType = strategy.type;
  const streamingUpdatedAt = strategy.type === "streaming" && strategy.remoteMeta != null ? strategy.getUpdatedAt(strategy.remoteMeta) : null;
  const pollFn = strategy.type === "polling" ? strategy.poll : null;
  const intervalMs = strategy.type === "polling" ? (strategy.intervalMs ?? DEFAULT_POLL_INTERVAL_MS) : DEFAULT_POLL_INTERVAL_MS;
  const pollFnRef = useRefSync(pollFn);

  const markLoaded = useCallback((updatedAt: string | null) => {
    loadedUpdatedAtRef.current = updatedAt;
  }, []);

  // Streaming strategy: react when remote updatedAt diverges from the loaded one.
  // Re-run when isDirty clears so a pending remote update can apply after save/discard.
  useEffect(() => {
    if (strategyType !== "streaming") return;
    if (!documentKey || !isDocumentReady || !streamingUpdatedAt) return;
    if (streamingUpdatedAt === loadedUpdatedAtRef.current) return;
    if (isDirty) return;
    void onRemoteChangeRef.current();
  }, [strategyType, streamingUpdatedAt, documentKey, isDocumentReady, isDirty, onRemoteChangeRef]);

  // Polling strategy: periodically check for remote updates.
  useEffect(() => {
    if (strategyType !== "polling") return;
    if (!documentKey || !isDocumentReady || isDirty) return;

    const keyAtStart = documentKey;
    let cancelled = false;

    const run = async () => {
      const poll = pollFnRef.current;
      if (!poll) return;
      try {
        const result = await poll();
        if (cancelled || !result) return;
        // Stale response: user navigated away while the poll was in flight.
        if (documentKeyRef.current !== keyAtStart) return;
        if (isDirtyRef.current) return;
        if (result.updatedAt === loadedUpdatedAtRef.current) return;
        await onRemoteChangeRef.current();
      } catch {
        // Transient errors during polling are expected; silently ignore.
      }
    };

    const id = window.setInterval(() => {
      void run();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [strategyType, documentKey, isDocumentReady, isDirty, intervalMs, pollFnRef, documentKeyRef, isDirtyRef, onRemoteChangeRef]);

  return { markLoaded };
}
