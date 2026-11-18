import { useEffect, useRef, useState } from "react";
import { useDebounce } from "./useDebounce.ts";

export type CostEstimateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; amountUsd: number }
  /** The server answered but has no price for this model/options. */
  | { status: "unavailable" }
  /** The price check failed; the UI hides it rather than show a guess. */
  | { status: "error" };

/**
 * Price check for a paid generation. `key` is a string of only the options that change the price (model, size,
 * duration, a bucketed text length); it is debounced, so typing the prompt never calls the server. A null key
 * means there is nothing to price yet. The fetcher always sees the latest closure but never re-triggers a check.
 */
export function useCostEstimate(key: string | null, fetchEstimate: () => Promise<{ amountUsd: number | null }>, delayMs = 500): CostEstimateState {
  const debouncedKey = useDebounce(key, delayMs);
  const [result, setResult] = useState<{ key: string; state: CostEstimateState } | null>(null);
  const fetchRef = useRef(fetchEstimate);
  fetchRef.current = fetchEstimate;

  useEffect(() => {
    if (debouncedKey === null) return;
    let cancelled = false;
    // Promise.resolve().then so a synchronous throw in the fetcher also lands in the error state.
    Promise.resolve()
      .then(() => fetchRef.current())
      .then(({ amountUsd }) => {
        if (cancelled) return;
        const state: CostEstimateState = amountUsd === null ? { status: "unavailable" } : { status: "ready", amountUsd };
        setResult({ key: debouncedKey, state });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: debouncedKey, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedKey]);

  if (key === null) return { status: "idle" };
  // Until the answer for the current options arrives (debounce pending or request in flight), show loading.
  if (result?.key !== key) return { status: "loading" };
  return result.state;
}

/** Audio price is per character: bucket the length so only meaningful changes re-price. Rounds up (never understates). */
export function bucketTextLength(length: number): number {
  if (length <= 0) return 0;
  const step = length <= 1000 ? 100 : length <= 10_000 ? 1000 : 5000;
  return Math.ceil(length / step) * step;
}
