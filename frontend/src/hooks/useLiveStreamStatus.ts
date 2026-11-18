import { useMemo } from "react";
import type { RPCStreamSWRResult } from "./useRPCStreamSWR.ts";

export type LiveStreamStatus = "connecting" | "live" | "reconnecting" | "error";

export interface LiveStreamStatusInfo {
  /** The derived connection status */
  status: LiveStreamStatus;
  /** Human-readable label for the status */
  label: string;
  /** Whether there is data but the connection is interrupted (show stale banner) */
  isStale: boolean;
  /** Whether the initial connection has not yet succeeded */
  isInitial: boolean;
  /** Whether to show a spinner */
  showSpinner: boolean;
}

export interface UseLiveStreamStatusOptions {
  /** Whether the stream is currently validating/connecting */
  isValidating: boolean;
  /** Current error, if any */
  error: Error | string | null | undefined;
  /** Whether any data snapshot has been received */
  hasData: boolean;
}

/**
 * Derive connection status from RPC stream SWR result properties.
 *
 * State machine:
 * - `error && !hasData` → `error` (initial connection failed)
 * - `error && hasData` → `reconnecting` (was connected, now interrupted)
 * - `!error && !hasData` → `connecting` (first connection in progress)
 * - `!error && hasData` → `live` (healthy connection)
 *
 * @example
 * const summary = useCostSummary();
 * const streamStatus = useLiveStreamStatus({
 *   isValidating: summary.isValidating,
 *   error: summary.error,
 *   hasData: !!summary.data,
 * });
 */
export function useLiveStreamStatus(options: UseLiveStreamStatusOptions): LiveStreamStatusInfo {
  const { isValidating, error, hasData } = options;
  const hasError = error != null;

  return useMemo(() => {
    if (hasError && !hasData) {
      return { status: "error", label: "Error", isStale: false, isInitial: true, showSpinner: false };
    }
    if (hasError && hasData) {
      return { status: "reconnecting", label: "Reconnecting", isStale: true, isInitial: false, showSpinner: false };
    }
    if (!hasData) {
      return { status: "connecting", label: "Connecting", isStale: false, isInitial: true, showSpinner: isValidating };
    }
    return { status: "live", label: "Live", isStale: false, isInitial: false, showSpinner: false };
  }, [hasError, hasData, isValidating]);
}

/**
 * Convenience wrapper that extracts stream status from a `useRPCStreamSWR` result.
 */
export function useLiveStreamStatusFromSWR(result: Pick<RPCStreamSWRResult<unknown>, "isValidating" | "error" | "data">): LiveStreamStatusInfo {
  return useLiveStreamStatus({
    isValidating: result.isValidating,
    error: result.error,
    hasData: result.data != null,
  });
}
