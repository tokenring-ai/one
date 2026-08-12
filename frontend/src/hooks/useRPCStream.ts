import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEventListener } from "./useEventListener.ts";
import { useRefSync } from "./useRefSync.ts";

export const DEFAULT_RECONNECT_OPTIONS = {
  initialDelay: 1000,
  maxDelay: 30_000,
  multiplier: 1.5,
} as const;

export type ReconnectOptions = {
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
};

export type UseRPCStreamOptions<TChunk, TData = TChunk> = {
  /** Subscription identity — `null` disables the stream */
  key: string | null;
  /** When false, no subscription (default true) */
  enabled?: boolean;
  /** Abort the stream while the document is hidden (default true) */
  pauseWhenHidden?: boolean;
  /** Seed value when `key` changes */
  initialData?: TData | (() => TData);
  subscribe: (signal: AbortSignal) => AsyncGenerator<TChunk>;
  /** Fold chunks into accumulated data; defaults to latest chunk */
  reduce?: (prev: TData | undefined, chunk: TChunk) => TData;
  /** Return true to end without reconnecting */
  shouldStop?: (chunk: TChunk) => boolean;
  /** Enable reconnection on errors and normal stream end (default true) */
  reconnect?: boolean;
  reconnectOptions?: ReconnectOptions;
  onError?: (error: unknown) => void;
};

export type UseRPCStreamResult<TData> = {
  data: TData | undefined;
  error: string | null;
  isConnecting: boolean;
  isLoading: boolean;
  reconnectAttempts: number;
  /**
   * Restart the stream and resolve when the next chunk arrives, or when the restarted
   * stream errors (resolves with the last known data so fire-and-forget callers are safe).
   */
  manualReconnect: () => Promise<TData | undefined>;
};

function resolveInitialData<TData>(initialData: TData | (() => TData) | undefined): TData | undefined {
  if (initialData === undefined) return undefined;
  return typeof initialData === "function" ? (initialData as () => TData)() : initialData;
}

function defaultReduce<TChunk, TData>(_prev: TData | undefined, chunk: TChunk): TData {
  return chunk as unknown as TData;
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useRPCStream<TChunk, TData = TChunk>(options: UseRPCStreamOptions<TChunk, TData>): UseRPCStreamResult<TData> {
  const { key, enabled = true, pauseWhenHidden = true, initialData, subscribe, reduce, shouldStop, reconnect = true, reconnectOptions, onError } = options;

  const [data, setData] = useState<TData | undefined>(() => resolveInitialData(initialData));
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  const subscribeRef = useRefSync(subscribe);
  const reduceRef = useRefSync(reduce);
  const shouldStopRef = useRefSync(shouldStop);
  const onErrorRef = useRefSync(onError);
  const dataRef = useRefSync(data);

  const reconnectWaitersRef = useRef<Array<(data: TData | undefined) => void>>([]);

  const flushReconnectWaiters = useCallback((next: TData | undefined) => {
    const waiters = reconnectWaitersRef.current;
    if (waiters.length === 0) return;
    reconnectWaitersRef.current = [];
    for (const resolve of waiters) resolve(next);
  }, []);

  const prevKeyRef = useRef(key);

  // Reseed during render rather than in the effect below: an effect leaves one commit where
  // `data` still belongs to the previous key, and consumers render that stale value.
  if (prevKeyRef.current !== key) {
    prevKeyRef.current = key;
    const seed = resolveInitialData(initialData);
    dataRef.current = seed;
    setData(seed);
    setReconnectAttempts(0);
    setError(null);
  }

  useEventListener("visibilitychange", () => setDocumentVisible(!document.hidden), { target: document, enabled: pauseWhenHidden });

  // Resolve pending waiters if the component unmounts so callers never hang.
  useEffect(() => {
    return () => {
      flushReconnectWaiters(dataRef.current);
    };
  }, [flushReconnectWaiters]);

  const active = enabled && key !== null && (!pauseWhenHidden || documentVisible);

  useEffect(() => {
    if (!active) {
      setIsConnecting(false);
      return;
    }

    const abortController = new AbortController();
    const reconnectOpts = { ...DEFAULT_RECONNECT_OPTIONS, ...reconnectOptions };
    let reconnectDelay = reconnectOpts.initialDelay;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let stopped: boolean = false;

    const applyChunk = (chunk: TChunk) => {
      const reducer = reduceRef.current ?? defaultReduce<TChunk, TData>;
      const next = reducer(dataRef.current, chunk);
      dataRef.current = next;
      setData(next);
      flushReconnectWaiters(next);
    };

    const scheduleReconnectUi = (waitMs: number) => {
      if (abortController.signal.aborted || stopped || !reconnect) return;

      setReconnectAttempts(prev => prev + 1);

      reconnectTimeout = setTimeout(() => {
        if (abortController.signal.aborted || stopped) return;
        setIsConnecting(true);
        setError(null);
      }, waitMs);
    };

    const runStream = async () => {
      while (!abortController.signal.aborted && !stopped) {
        try {
          setIsConnecting(true);
          setError(null);

          for await (const chunk of subscribeRef.current(abortController.signal)) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
            if (abortController.signal.aborted || stopped) return;

            if (shouldStopRef.current?.(chunk)) {
              stopped = true;
              applyChunk(chunk);
              setIsConnecting(false);
              return;
            }

            reconnectDelay = reconnectOpts.initialDelay;
            setReconnectAttempts(0);
            setIsConnecting(false);
            applyChunk(chunk);
          }
        } catch (streamError: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
          if (abortController.signal.aborted || stopped) return;

          const errorMessage = formatError(streamError);
          onErrorRef.current?.(streamError);
          setError(errorMessage);
          setIsConnecting(false);
          // Settle waiters with last known data; error is visible via `error` state.
          flushReconnectWaiters(dataRef.current);

          if (!reconnect) return;

          const waitMs = reconnectDelay;
          scheduleReconnectUi(waitMs);
          reconnectDelay = Math.min(reconnectDelay * reconnectOpts.multiplier, reconnectOpts.maxDelay);

          try {
            await delay(waitMs, abortController.signal);
          } catch {
            return;
          }
        }
      }
    };

    void runStream();

    return () => {
      abortController.abort();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [key, enabled, pauseWhenHidden, documentVisible, reconnectNonce, reconnect, active, flushReconnectWaiters]);

  const manualReconnect = useCallback((): Promise<TData | undefined> => {
    // No subscription will run — resolve immediately with whatever we already have.
    if (key === null || !enabled) {
      return Promise.resolve(dataRef.current);
    }

    return new Promise<TData | undefined>(resolve => {
      reconnectWaitersRef.current.push(resolve);
      setReconnectAttempts(0);
      setError(null);
      setReconnectNonce(n => n + 1);
    });
  }, [enabled, key]);

  return {
    data,
    error,
    isConnecting: active && isConnecting,
    isLoading: active && isConnecting && data === undefined,
    reconnectAttempts,
    manualReconnect,
  };
}
