import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";

type KeyListener = () => void;

/**
 * Hook instances sharing a key stay in sync within this document: dock views
 * are separate React subtrees, so two panels reading the same preference
 * would otherwise diverge until one of them remounted.
 */
const keyListeners = new Map<string, Set<KeyListener>>();

function subscribeLocalStorageKey(key: string, listener: KeyListener): () => void {
  let listeners = keyListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    keyListeners.set(key, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) keyListeners.delete(key);
  };
}

function notifyLocalStorageKey(key: string): void {
  const listeners = keyListeners.get(key);
  if (!listeners || listeners.size === 0) return;
  // Writes happen inside state updaters; defer so other components update outside render.
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface UseLocalStorageStateOptions<T> {
  /**
   * Optional custom serializer. Default: JSON.stringify
   */
  serialize?: (value: T) => string;
  /**
   * Optional custom deserializer. Default: JSON.parse with fallback to initialValue.
   */
  deserialize?: (raw: string) => T;
  /**
   * Whether to silently ignore storage errors (quota exceeded, private mode).
   * When true, falls back to in-memory state.
   * @default true
   */
  ignoreErrors?: boolean;
  /**
   * Called when a persistence write fails. Useful for surfacing storage errors
   * (e.g. chat draft banner) or marking storage unavailable.
   */
  onError?: (error: unknown) => void;
}

function defaultSerialize<T>(value: T): string {
  return JSON.stringify(value);
}

/**
 * Read a value from localStorage with the same semantics as the hook.
 * Safe to call outside React (module init, tests, external stores).
 */
export function readLocalStorageState<T>(key: string, initialValue: T, options?: Pick<UseLocalStorageStateOptions<T>, "deserialize" | "ignoreErrors">): T {
  if (typeof window === "undefined") return initialValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return initialValue;
    if (options?.deserialize) return options.deserialize(raw);
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  } catch {
    return initialValue;
  }
}

/**
 * Write a value to localStorage with the same semantics as the hook.
 * Returns true on success, false when the write failed and errors were ignored.
 * @throws when the write fails and `ignoreErrors` is false
 */
export function writeLocalStorageState<T>(
  key: string,
  value: T,
  options?: Pick<UseLocalStorageStateOptions<T>, "serialize" | "ignoreErrors" | "onError">,
): boolean {
  if (typeof window === "undefined") return false;
  const serialize = options?.serialize ?? defaultSerialize;
  const ignoreErrors = options?.ignoreErrors ?? true;
  try {
    localStorage.setItem(key, serialize(value));
    notifyLocalStorageKey(key);
    return true;
  } catch (error) {
    options?.onError?.(error);
    if (!ignoreErrors) throw error;
    return false;
  }
}

/**
 * useState-compatible hook that persists state to localStorage.
 *
 * On mount, reads the initial value from localStorage (falling back to `initialValue`).
 * On every state change, persists the new value back to localStorage.
 * Handles JSON serialization, quota errors, and private mode gracefully.
 *
 * @param key - The localStorage key
 * @param initialValue - Default value used when the key is missing or invalid
 * @param options - Serialization and error handling options
 *
 * @example
 * const [events, setEvents] = useLocalStorageState<CalendarEvent[]>(
 *   "tokenring:calendar:events",
 *   [],
 * );
 *
 * @example
 * const [theme, setTheme] = useLocalStorageState<ThemePreference>(
 *   "theme",
 *   "system",
 *   { serialize: String, deserialize: (s) => s as ThemePreference },
 * );
 */
export function useLocalStorageState<T>(key: string, initialValue: T, options?: UseLocalStorageStateOptions<T>): [T, Dispatch<SetStateAction<T>>] {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Capture initialValue only for the first read; later key changes re-read storage.
  const initialValueRef = useRef(initialValue);
  const [state, setState] = useState<T>(() => readLocalStorageState(key, initialValue, options));
  /** Raw string last read from or written to storage, so echoes of our own writes are ignored. */
  const rawRef = useRef<string | null>(typeof window === "undefined" ? null : readRaw(key));

  // When the storage key changes (e.g. per-app workspace prefs), re-hydrate from that key.
  // Adjust during render (React getDerivedStateFromProps pattern) so callers see the
  // correct value immediately rather than one frame of stale data.
  const keyRef = useRef(key);
  let currentState = state;
  if (keyRef.current !== key) {
    keyRef.current = key;
    currentState = readLocalStorageState(key, initialValueRef.current, optionsRef.current);
    rawRef.current = readRaw(key);
    setState(currentState);
  }

  // Another instance (or the same one in another dock panel) wrote this key.
  useEffect(
    () =>
      subscribeLocalStorageKey(key, () => {
        const raw = readRaw(key);
        if (raw === rawRef.current) return;
        rawRef.current = raw;
        setState(readLocalStorageState(key, initialValueRef.current, optionsRef.current));
      }),
    [key],
  );

  // Latest value, also advanced by the setter, so successive calls before a re-render chain correctly.
  const stateRef = useRef(currentState);
  stateRef.current = currentState;

  // Persist synchronously, not inside a state updater: an updater only runs on the next render, so a
  // write made just before the component unmounts (a form that closes on submit) would be lost.
  const setPersistedState = useCallback((action: SetStateAction<T>) => {
    const next = typeof action === "function" ? (action as (prevState: T) => T)(stateRef.current) : action;
    stateRef.current = next;
    try {
      rawRef.current = (optionsRef.current?.serialize ?? defaultSerialize)(next);
    } catch {
      rawRef.current = null;
    }
    writeLocalStorageState(keyRef.current, next, optionsRef.current);
    setState(next);
  }, []);

  return [currentState, setPersistedState];
}
