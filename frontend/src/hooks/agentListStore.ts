import formatError from "@tokenring-ai/utility/error/formatError";
import { isRpcConnectionClosed } from "@tokenring-ai/web-host/createWsRPCClient";
import type { RunningAgent } from "../lib/agentSessions.ts";
import { agentRPCClient } from "../rpc.ts";

/**
 * Shared, reference-counted store for the live agent list.
 *
 * `useAgentList` is called from many simultaneously-mounted components (App,
 * TopBar, every dashboard that uses `useAppAgentSession`, …). Previously each
 * call opened its own `streamAgents` WebSocket subscription,
 * so the backend maintained N listeners and pushed a full agent-list snapshot to
 * each one on every change. This store runs exactly ONE stream for the whole app
 * and fans the latest snapshot out to every subscriber via `useSyncExternalStore`.
 *
 * The stream is started when the first subscriber mounts and torn down when the
 * last one unmounts. Reconnection uses the same exponential backoff as
 * `useRPCStream`. (The old per-hook `pauseWhenHidden` optimization is dropped:
 * this is a local-first app talking to a localhost backend, so keeping the single
 * stream warm while the tab is hidden is cheaper than the churn of pausing and
 * resuming it.)
 */

export type AgentListSnapshot = {
  data: RunningAgent[] | undefined;
  error: string | null;
  isConnecting: boolean;
};

type Listener = () => void;

const RECONNECT = { initialDelay: 1000, maxDelay: 30_000, multiplier: 1.5 } as const;

let agents: RunningAgent[] | undefined;
let error: string | null = null;
let isConnecting = false;

// Cached so `getSnapshot` returns a stable reference until the store actually
// changes — `useSyncExternalStore` requires this to avoid render loops.
let snapshot: AgentListSnapshot = { data: undefined, error: null, isConnecting: false };

const listeners = new Set<Listener>();
let refCount = 0;
let abortController: AbortController | null = null;
let reconnectDelay: number = RECONNECT.initialDelay;
let refreshWaiters: Array<() => void> = [];

function emit() {
  snapshot = { data: agents, error, isConnecting };
  for (const listener of listeners) listener();
}

function settleRefreshWaiters() {
  const waiters = refreshWaiters;
  refreshWaiters = [];
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

async function run(signal: AbortSignal) {
  // Read the flag through a helper: TypeScript narrows `signal.aborted` to `false`
  // for the whole loop body once the `while` condition has tested it, even though
  // the signal really can abort while we are suspended on an `await`.
  const isAborted = () => signal.aborted;
  /** A dropped socket gets one immediate, silent retry (see sharedStreamStore). */
  let quickRetryUsed = false;

  while (!isAborted()) {
    try {
      isConnecting = true;
      error = null;
      emit();

      for await (const chunk of agentRPCClient.streamAgents({}, signal)) {
        if (isAborted()) return;
        agents = chunk;
        reconnectDelay = RECONNECT.initialDelay;
        quickRetryUsed = false;
        isConnecting = false;
        emit();
        settleRefreshWaiters();
      }

      // Server closed the stream cleanly — re-subscribe with backoff so a
      // flapping server isn't hammered by a tight subscribe→close loop.
      if (isAborted()) return;
      const waitMs = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * RECONNECT.multiplier, RECONNECT.maxDelay);
      try {
        await delay(waitMs, signal);
      } catch {
        return;
      }
    } catch (streamError: unknown) {
      if (isAborted()) return;
      if (!quickRetryUsed && isRpcConnectionClosed(streamError)) {
        quickRetryUsed = true;
        continue;
      }
      error = formatError(streamError, { includeStack: false });
      isConnecting = false;
      emit();
      settleRefreshWaiters();

      const waitMs = reconnectDelay;
      reconnectDelay = Math.min(reconnectDelay * RECONNECT.multiplier, RECONNECT.maxDelay);
      try {
        await delay(waitMs, signal);
      } catch {
        return;
      }
    }
  }
}

function start() {
  if (abortController) return;
  const controller = new AbortController();
  abortController = controller;
  void run(controller.signal);
}

function stop() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  // Settle any pending refresh waiters so callers never hang after the last
  // subscriber leaves.
  settleRefreshWaiters();
}

/** Subscribe a listener; starts the shared stream on the first subscriber. */
export function subscribeAgentList(listener: Listener): () => void {
  listeners.add(listener);
  refCount += 1;
  start();
  return () => {
    listeners.delete(listener);
    refCount -= 1;
    if (refCount <= 0) {
      refCount = 0;
      stop();
    }
  };
}

/** Stable snapshot getter for `useSyncExternalStore`. */
export function getAgentListSnapshot(): AgentListSnapshot {
  return snapshot;
}

/**
 * Force a fresh snapshot by restarting the shared stream. Resolves once the next
 * snapshot arrives (or immediately if there are no active subscribers).
 */
export function refreshAgentList(): Promise<RunningAgent[] | undefined> {
  if (refCount === 0) {
    return Promise.resolve(agents);
  }
  return new Promise(resolve => {
    refreshWaiters.push(() => resolve(agents));
    if (abortController) {
      abortController.abort();
      abortController = null;
      start();
    }
  });
}
