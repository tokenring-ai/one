import { useSyncExternalStore } from "react";

/**
 * Capture settings for the Debug dashboard: which targets are ticked and how
 * often the recorder fires. Kept outside React so the choices survive the
 * capture panel being hidden, re-opened or moved. In memory only; the keep-last
 * choice is also stored on the server so pruning continues while this view is closed.
 */

/** `kind:id`, the key a target is tracked by. */
export function targetKey(target: { kind: string; id: string }): string {
  return `${target.kind}:${target.id}`;
}

export const DEFAULT_INTERVAL_SECONDS = 5;

/** The app's own state is the target people want nine times out of ten. */
const DEFAULT_SELECTED_KEYS: readonly string[] = [targetKey({ kind: "app", id: "state" })];

export interface DebugCaptureState {
  selectedKeys: readonly string[];
  intervalSeconds: number;
  /** Mirrors the server's keep-last setting. null keeps every snapshot. */
  retainLast: number | null;
}

const INITIAL: DebugCaptureState = { selectedKeys: DEFAULT_SELECTED_KEYS, intervalSeconds: DEFAULT_INTERVAL_SECONDS, retainLast: null };

let state: DebugCaptureState = INITIAL;
const listeners = new Set<() => void>();

function update(next: DebugCaptureState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDebugCaptureState(): DebugCaptureState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function toggleTarget(key: string): void {
  const selectedKeys = state.selectedKeys.includes(key) ? state.selectedKeys.filter(existing => existing !== key) : [...state.selectedKeys, key];
  update({ ...state, selectedKeys });
}

/** Drops targets that have gone away (agents are cleaned up while the dashboard is open). */
export function retainTargets(available: ReadonlySet<string>): void {
  const kept = state.selectedKeys.filter(key => available.has(key));
  if (kept.length === state.selectedKeys.length) return;
  update({ ...state, selectedKeys: kept });
}

export function setIntervalSeconds(intervalSeconds: number): void {
  if (state.intervalSeconds === intervalSeconds) return;
  update({ ...state, intervalSeconds });
}

export function setRetainLast(retainLast: number | null): void {
  if (state.retainLast === retainLast) return;
  update({ ...state, retainLast });
}

/** Test helper. */
export function resetDebugStore(): void {
  update(INITIAL);
}
