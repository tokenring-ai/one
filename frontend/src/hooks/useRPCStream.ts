import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useEffect, useRef, useState } from "react";

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
  manualReconnect: () => void;
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

  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const shouldStopRef = useRef(shouldStop);
  shouldStopRef.current = shouldStop;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  const dataRef = useRef(data);
  dataRef.current = data;

  const prevKeyRef = useRef(key);

  useEffect(() => {
    if (!pauseWhenHidden) return;
    const onVisibilityChange = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [pauseWhenHidden]);

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

    if (prevKeyRef.current !== key) {
      const seed = resolveInitialData(initialDataRef.current);
      dataRef.current = seed;
      setData(seed);
      setReconnectAttempts(0);
      setError(null);
      prevKeyRef.current = key;
    }

    const applyChunk = (chunk: TChunk) => {
      const reducer = reduceRef.current ?? defaultReduce<TChunk, TData>;
      const next = reducer(dataRef.current, chunk);
      dataRef.current = next;
      setData(next);
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
  }, [key, enabled, pauseWhenHidden, documentVisible, reconnectNonce, reconnect, active]);

  const manualReconnect = useCallback(() => {
    setReconnectAttempts(0);
    setError(null);
    setReconnectNonce(n => n + 1);
  }, []);

  return {
    data,
    error,
    isConnecting: active && isConnecting,
    isLoading: active && isConnecting && data === undefined,
    reconnectAttempts,
    manualReconnect,
  };
}
