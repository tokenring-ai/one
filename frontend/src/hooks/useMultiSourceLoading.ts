import { useCallback, useMemo } from "react";

/** Minimal SWR-like source shape used by multi-source loading aggregation. */
export interface SWRSource<T = unknown> {
  data: T | undefined;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | undefined;
  mutate: () => Promise<T | undefined>;
}

export interface SourceConfig<T = unknown> {
  /** The SWR source */
  source: SWRSource<T>;
  /**
   * Whether errors from this source are fatal (block rendering).
   * Soft-fail sources still render with partial data even when errored.
   * Defaults to true (hard-fail).
   */
  isFatal?: boolean;
  /**
   * Label for this source, used for soft-error maps and per-source lookups.
   */
  label?: string;
}

export interface UseMultiSourceLoadingReturn {
  /**
   * Whether any source is still loading with no cached data.
   * Soft-fail sources that already have an error do not keep this true.
   * Use this to gate the initial loading spinner.
   */
  isLoading: boolean;
  /**
   * Whether any fatal source has an error with no cached data.
   * Use this to show a full error state.
   */
  hasHardError: boolean;
  /**
   * The first hard error encountered (if any).
   */
  hardError: Error | undefined;
  /**
   * Whether any source is currently revalidating (for refresh button spinner).
   */
  isRefreshing: boolean;
  /**
   * Errors from soft-fail sources that have no data.
   * Use these to show inline error banners alongside partial data.
   */
  softErrors: Map<string, Error>;
  /**
   * Check if a specific source has a hard error (no data + error).
   */
  isSourceHardError: (label: string) => boolean;
  /**
   * Get the hard error for a specific source (if any).
   */
  getSourceHardError: (label: string) => Error | undefined;
  /**
   * Refresh all sources in parallel. Guards against double-refresh.
   */
  refresh: () => void;
}

/**
 * Combines loading, error, and validating states from multiple SWR-based data sources.
 *
 * Supports soft-fail sources (`isFatal: false`) where errors are non-fatal — the component
 * still renders with partial data — and hard-fail sources where errors block rendering.
 *
 * @example
 * const plugins = usePlugins();
 * const config = useConfigValues();
 * const bots = useBots();
 *
 * const loading = useMultiSourceLoading([
 *   { source: plugins, label: "plugins" },
 *   { source: config, label: "config" },
 *   { source: bots, label: "bots", isFatal: false },
 * ]);
 *
 * if (loading.isLoading) return <LoadingSpinner />;
 * if (loading.hasHardError) return <ErrorState error={loading.hardError} onRetry={loading.refresh} />;
 */
export function useMultiSourceLoading(sources: SourceConfig[]): UseMultiSourceLoadingReturn {
  const { isLoading, hasHardError, hardError, isRefreshing, softErrors } = useMemo(() => {
    let isLoading = false;
    let hasHardError = false;
    let hardError: Error | undefined;
    let isRefreshing = false;
    const softErrors = new Map<string, Error>();

    for (const { source, isFatal = true, label } of sources) {
      const { data, isLoading: loading, isValidating, error } = source;
      const hasData = data !== undefined;
      const hasError = error !== undefined;

      // Soft-fail sources that already errored should not keep the page in a loading state
      // (matches SocialPlatforms: wait for bots on first load, but not when bots has failed).
      if (loading && !hasData && (isFatal || !hasError)) isLoading = true;
      if (isValidating) isRefreshing = true;

      if (hasError && !hasData) {
        if (isFatal) {
          hasHardError = true;
          hardError ??= error;
        } else if (label) {
          softErrors.set(label, error);
        }
      }
    }

    return { isLoading, hasHardError, hardError, isRefreshing, softErrors };
  }, [sources]);

  const isSourceHardError = useCallback(
    (label: string) => {
      const config = sources.find(s => s.label === label);
      if (!config) return false;
      const { data, error } = config.source;
      return error !== undefined && data === undefined;
    },
    [sources],
  );

  const getSourceHardError = useCallback(
    (label: string): Error | undefined => {
      const config = sources.find(s => s.label === label);
      if (!config) return undefined;
      const { data, error } = config.source;
      return error !== undefined && data === undefined ? error : undefined;
    },
    [sources],
  );

  const refresh = useCallback(() => {
    if (isRefreshing) return;
    for (const { source } of sources) {
      void source.mutate();
    }
  }, [sources, isRefreshing]);

  return {
    isLoading,
    hasHardError,
    hardError,
    isRefreshing,
    softErrors,
    isSourceHardError,
    getSourceHardError,
    refresh,
  };
}
