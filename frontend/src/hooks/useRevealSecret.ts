import { useCallback, useEffect, useRef, useState } from "react";
import { useRefSync } from "./useRefSync.ts";

const DEFAULT_AUTO_HIDE_MS = 30_000;

export interface UseRevealSecretOptions {
  /**
   * RPC function to fetch the secret value.
   * Should return a value (string) or throw on error.
   */
  fetchSecret: () => Promise<string>;
  /**
   * Timeout (ms) after which the revealed value is auto-hidden.
   * Default: 30_000 (30 seconds).
   */
  autoHideMs?: number;
  /**
   * Optional callback when the secret is revealed.
   */
  onRevealed?: (value: string) => void;
  /**
   * Optional callback when the secret is hidden (manually or auto).
   */
  onHidden?: () => void;
  /**
   * Optional callback when the fetch fails.
   * If not provided, errors are silently swallowed (caller handles them).
   */
  onError?: (error: unknown) => void;
}

export interface UseRevealSecretReturn {
  /** Whether the secret is currently revealed in the UI. */
  revealed: boolean;
  /** The revealed value, or null when hidden. */
  value: string | null;
  /** Whether a fetch is in progress (for reveal or copy). */
  loading: boolean;
  /**
   * Reveal the secret in the UI (fetches if not already revealed).
   * If already revealed, hides it (toggle behavior).
   */
  toggleReveal: () => Promise<void>;
  /**
   * Hide the secret manually.
   */
  hide: () => void;
  /**
   * Fetch the secret value for clipboard-only use.
   * If already revealed, returns the cached value without fetching.
   * Does NOT set the revealed UI state.
   */
  fetchForClipboard: () => Promise<string | null>;
}

/**
 * On-demand secret fetch with auto-hide and stealth clipboard mode.
 *
 * Fetches only when the user reveals or copies; auto-hides revealed values after
 * a timeout; and supports copy-without-reveal so secrets need not appear on screen.
 */
export function useRevealSecret(options: UseRevealSecretOptions): UseRevealSecretReturn {
  const { fetchSecret, autoHideMs = DEFAULT_AUTO_HIDE_MS, onRevealed, onHidden, onError } = options;

  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync guard so concurrent reveal/copy cannot both pass before re-render.
  const loadingRef = useRef(false);
  const revealedRef = useRefSync(revealed);
  const valueRef = useRefSync(value);
  const optionsRef = useRefSync({ fetchSecret, onRevealed, onHidden, onError });

  const hide = useCallback(() => {
    if (!revealedRef.current && valueRef.current == null) return;
    setRevealed(false);
    setValue(null);
    optionsRef.current.onHidden?.();
  }, [revealedRef, valueRef, optionsRef]);

  // Drop revealed secrets from UI/state after a short window (and on unmount).
  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => {
      hide();
    }, autoHideMs);
    return () => window.clearTimeout(t);
  }, [revealed, value, autoHideMs, hide]);

  const fetchSecretValue = useCallback(async (): Promise<string | null> => {
    if (loadingRef.current) return null;
    loadingRef.current = true;
    setLoading(true);
    try {
      return await optionsRef.current.fetchSecret();
    } catch (error) {
      optionsRef.current.onError?.(error);
      return null;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [optionsRef]);

  const toggleReveal = useCallback(async () => {
    if (revealedRef.current) {
      hide();
      return;
    }

    const secret = await fetchSecretValue();
    if (secret == null) return;

    setValue(secret);
    setRevealed(true);
    optionsRef.current.onRevealed?.(secret);
  }, [revealedRef, hide, fetchSecretValue, optionsRef]);

  const fetchForClipboard = useCallback(async (): Promise<string | null> => {
    // Prefer already-revealed value; otherwise fetch for clipboard only (do not force reveal).
    if (revealedRef.current && valueRef.current != null) {
      return valueRef.current;
    }
    return fetchSecretValue();
  }, [revealedRef, valueRef, fetchSecretValue]);

  return {
    revealed,
    value,
    loading,
    toggleReveal,
    hide,
    fetchForClipboard,
  };
}
