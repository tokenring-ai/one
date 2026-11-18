import formatError from "@tokenring-ai/utility/error/formatError";
import { isRpcConnectionClosed } from "@tokenring-ai/web-host/createWsRPCClient";

/**
 * Reference-counted, key-scoped store for live RPC streams.
 *
 * Generalises `agentListStore`: every hook that streams the same thing shares
 * one subscription instead of opening its own. That mattered little while each
 * stream had a single consumer, but a dock dashboard puts several panels — each
 * its own React subtree — on screen at once, and four panels calling `useBots()`
 * would otherwise open four `streamBots` subscriptions and make the backend push
 * four copies of every change.
 *
 * The stream starts with the first subscriber for a key and is torn down when the
 * last one leaves. Reconnection uses exponential backoff.
 *
 * Like `agentListStore`, this deliberately does not pause while the document is
 * hidden: this is a local-first app talking to a localhost backend, so keeping
 * the single stream warm is cheaper than the churn of pausing and resuming it.
 */

export interface SharedStreamSnapshot<TData> {
  data: TData | undefined;
  error: string | null;
  isConnecting: boolean;
}

export interface SharedStreamConfig<TChunk, TData> {
  subscribe: (signal: AbortSignal) => AsyncGenerator<TChunk>;
  initialData?: TData | (() => TData) | undefined;
  reduce?: ((prev: TData | undefined, chunk: TChunk) => TData) | undefined;
  shouldStop?: ((chunk: TChunk) => boolean) | undefined;
  reconnect?: boolean | undefined;
  reconnectOptions?: { initialDelay?: number; maxDelay?: number; multiplier?: number } | undefined;
}

type Listener = () => void;

const DEFAULT_RECONNECT = { initialDelay: 1000, maxDelay: 30_000, multiplier: 1.5 } as const;

const EMPTY_SNAPSHOT: SharedStreamSnapshot<never> = { data: undefined, error: null, isConnecting: false };

interface Entry<TChunk, TData> {
  config: SharedStreamConfig<TChunk, TData>;
  data: TData | undefined;
  error: string | null;
  isConnecting: boolean;
  /** Cached so `getSnapshot` is referentially stable between changes. */
  snapshot: SharedStreamSnapshot<TData>;
  listeners: Set<Listener>;
  refCount: number;
  abortController: AbortController | null;
  reconnectDelay: number;
  refreshWaiters: Array<() => void>;
  /** Set when `shouldStop` fired: do not resubscribe. */
  stopped: boolean;
}

const entries = new Map<string, Entry<any, any>>();

export function resolveInitialData<TData>(initialData: SharedStreamConfig<any, TData>["initialData"]): TData | undefined {
  return typeof initialData === "function" ? (initialData as () => TData)() : initialData;
}

function emit<TChunk, TData>(entry: Entry<TChunk, TData>) {
  entry.snapshot = { data: entry.data, error: entry.error, isConnecting: entry.isConnecting };
  for (const listener of entry.listeners) listener();
}

function settleRefreshWaiters<TChunk, TData>(entry: Entry<TChunk, TData>) {
  const waiters = entry.refreshWaiters;
  entry.refreshWaiters = [];
  for (const resolve of waiters) resolve();
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

async function run<TChunk, TData>(entry: Entry<TChunk, TData>, signal: AbortSignal) {
  // Read the flag through a helper: TypeScript narrows `signal.aborted` to `false`
  // for the whole loop body once the `while` condition has tested it, even though
  // the signal really can abort while we are suspended on an `await`.
  const isAborted = () => signal.aborted;
  const options = { ...DEFAULT_RECONNECT, ...entry.config.reconnectOptions };
  const reduce = entry.config.reduce ?? ((_prev: TData | undefined, chunk: TChunk) => chunk as unknown as TData);
  const shouldReconnect = entry.config.reconnect !== false;
  /**
   * A dropped socket is retried once straight away, keeping the data on screen and showing no
   * error: the retry opens a fresh socket. Only if that fails too does the error show.
   */
  let quickRetryUsed = false;

  const backoff = async (): Promise<boolean> => {
    const waitMs = entry.reconnectDelay;
    entry.reconnectDelay = Math.min(entry.reconnectDelay * options.multiplier, options.maxDelay);
    try {
      await delay(waitMs, signal);
      return true;
    } catch {
      return false;
    }
  };

  while (!isAborted() && !entry.stopped) {
    try {
      entry.isConnecting = true;
      entry.error = null;
      emit(entry);

      for await (const chunk of entry.config.subscribe(signal)) {
        if (isAborted()) return;
        if (entry.config.shouldStop?.(chunk)) {
          entry.stopped = true;
          entry.data = reduce(entry.data, chunk);
          entry.isConnecting = false;
          emit(entry);
          settleRefreshWaiters(entry);
          return;
        }
        entry.data = reduce(entry.data, chunk);
        entry.reconnectDelay = options.initialDelay;
        quickRetryUsed = false;
        entry.isConnecting = false;
        emit(entry);
        settleRefreshWaiters(entry);
      }

      // Server closed the stream cleanly — re-subscribe with backoff so a
      // flapping server isn't hammered by a tight subscribe→close loop.
      if (isAborted() || !shouldReconnect) return;
      if (!(await backoff())) return;
    } catch (streamError: unknown) {
      if (isAborted()) return;
      if (shouldReconnect && !quickRetryUsed && isRpcConnectionClosed(streamError)) {
        quickRetryUsed = true;
        continue;
      }
      entry.error = formatError(streamError, { includeStack: false });
      entry.isConnecting = false;
      emit(entry);
      settleRefreshWaiters(entry);
      if (!shouldReconnect) return;
      if (!(await backoff())) return;
    }
  }
}

function start<TChunk, TData>(entry: Entry<TChunk, TData>) {
  if (entry.abortController || entry.stopped) return;
  const controller = new AbortController();
  entry.abortController = controller;
  void run(entry, controller.signal);
}

function stop<TChunk, TData>(entry: Entry<TChunk, TData>) {
  entry.abortController?.abort();
  entry.abortController = null;
  // Settle pending waiters so callers never hang after the last subscriber leaves.
  settleRefreshWaiters(entry);
}

/**
 * Subscribes to the stream for `key`, starting it on the first subscriber.
 *
 * The first subscriber's `config` wins for the lifetime of the key, the way a
 * cache keyed by request identity behaves: two callers using the same key are
 * asserting they want the same stream.
 */
export function subscribeSharedStream<TChunk, TData>(key: string, config: SharedStreamConfig<TChunk, TData>, listener: Listener): () => void {
  let entry = entries.get(key) as Entry<TChunk, TData> | undefined;
  if (!entry) {
    const seed = resolveInitialData<TData>(config.initialData);
    entry = {
      config,
      data: seed,
      error: null,
      isConnecting: false,
      snapshot: { data: seed, error: null, isConnecting: false },
      listeners: new Set(),
      refCount: 0,
      abortController: null,
      reconnectDelay: config.reconnectOptions?.initialDelay ?? DEFAULT_RECONNECT.initialDelay,
      refreshWaiters: [],
      stopped: false,
    };
    entries.set(key, entry);
  }
  const active = entry;
  active.listeners.add(listener);
  active.refCount += 1;
  start(active);
  return () => {
    active.listeners.delete(listener);
    active.refCount -= 1;
    if (active.refCount <= 0) {
      active.refCount = 0;
      stop(active);
      // Drop the entry so a later mount re-seeds rather than resurrecting a
      // stale snapshot from an earlier session.
      entries.delete(key);
    }
  };
}

/** Stable snapshot getter for `useSyncExternalStore`. */
export function getSharedStreamSnapshot<TData>(key: string | null): SharedStreamSnapshot<TData> {
  if (key === null) return EMPTY_SNAPSHOT;
  const entry = entries.get(key);
  if (!entry) return EMPTY_SNAPSHOT;
  return entry.snapshot as SharedStreamSnapshot<TData>;
}

/**
 * Restarts the stream for `key` and resolves once the next chunk arrives (or
 * immediately when nothing is subscribed).
 */
export function refreshSharedStream<TData>(key: string | null): Promise<TData | undefined> {
  if (key === null) return Promise.resolve(undefined);
  const entry = entries.get(key) as Entry<any, TData> | undefined;
  if (!entry || entry.refCount === 0) return Promise.resolve(entry?.data);
  return new Promise(resolve => {
    entry.refreshWaiters.push(() => resolve(entry.data));
    // A stream stopped by `shouldStop` is restartable: an explicit refresh is
    // the caller saying the terminal condition may no longer hold.
    entry.stopped = false;
    if (entry.abortController) {
      entry.abortController.abort();
      entry.abortController = null;
    }
    start(entry);
  });
}

/** Test seam: drops every entry and aborts its stream. */
export function resetSharedStreams(): void {
  for (const entry of entries.values()) stop(entry);
  entries.clear();
}
