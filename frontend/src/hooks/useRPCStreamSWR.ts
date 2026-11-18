import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { getSharedStreamSnapshot, refreshSharedStream, resolveInitialData, subscribeSharedStream } from "./sharedStreamStore.ts";
import type { UseRPCStreamOptions } from "./useRPCStream.ts";

export type RPCStreamSWRResult<TData> = {
  data: TData | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<TData | undefined>;
};

/**
 * SWR-shaped view of a live RPC stream, shared by key.
 *
 * Every caller with the same `key` reads one subscription (see
 * `sharedStreamStore`). That is what lets several dock panels — each its own
 * React subtree — show the same live data without multiplying subscriptions on
 * the backend.
 */
export function useRPCStreamSWR<TChunk, TData = TChunk>(options: UseRPCStreamOptions<TChunk, TData>): RPCStreamSWRResult<TData> {
  const { key, enabled = true, subscribe, initialData, reduce, shouldStop, reconnect, reconnectOptions } = options;
  const activeKey = enabled ? key : null;

  // The store holds the stream; the config only matters for the first subscriber
  // of a key, so a fresh closure each render is harmless and refs keep it current.
  const configRef = useRef({ subscribe, initialData, reduce, shouldStop, reconnect, reconnectOptions });
  configRef.current = { subscribe, initialData, reduce, shouldStop, reconnect, reconnectOptions };

  const subscribeToStore = useCallback(
    (listener: () => void) => {
      if (activeKey === null) return () => {};
      return subscribeSharedStream<TChunk, TData>(activeKey, configRef.current, listener);
    },
    [activeKey],
  );

  const getSnapshot = useCallback(() => getSharedStreamSnapshot<TData>(activeKey), [activeKey]);

  const snapshot = useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);
  const { error, isConnecting } = snapshot;

  // The shared entry (and its seeded snapshot) only exists once the first
  // subscriber's effect runs, so the first render would otherwise see no data.
  // Fall back to this caller's seed until the store has data of its own.
  const seed = useMemo(() => (activeKey === null ? undefined : resolveInitialData<TData>(configRef.current.initialData)), [activeKey]);
  const data = snapshot.data === undefined ? seed : snapshot.data;

  const mutate = useCallback(() => refreshSharedStream<TData>(activeKey), [activeKey]);

  return useMemo(
    () => ({
      data,
      error: error ? new Error(error) : undefined,
      isLoading: isConnecting && data === undefined,
      isValidating: isConnecting,
      mutate,
    }),
    [data, error, isConnecting, mutate],
  );
}

export function useAgentStatusStream<T extends { status: string }>(
  key: string | null,
  subscribe: (signal: AbortSignal) => AsyncGenerator<T>,
): RPCStreamSWRResult<T> {
  return useRPCStreamSWR({
    key,
    subscribe,
    shouldStop: chunk => chunk.status === "agentNotFound",
  });
}
