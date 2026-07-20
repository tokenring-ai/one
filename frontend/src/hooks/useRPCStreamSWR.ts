import { useCallback } from "react";
import { type UseRPCStreamOptions, useRPCStream } from "./useRPCStream.ts";

export type RPCStreamSWRResult<TData> = {
  data: TData | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<TData | undefined>;
};

export function useRPCStreamSWR<TChunk, TData = TChunk>(options: UseRPCStreamOptions<TChunk, TData>): RPCStreamSWRResult<TData> {
  const { data, error, isLoading, isConnecting, manualReconnect } = useRPCStream(options);

  const mutate = useCallback(() => {
    manualReconnect();
    return Promise.resolve(data);
  }, [manualReconnect, data]);

  return {
    data,
    error: error ? new Error(error) : undefined,
    isLoading,
    isValidating: isConnecting,
    mutate,
  };
}

export function useAgentStatusStream<T extends { status: string }>(
  key: string | null,
  subscribe: (signal: AbortSignal) => AsyncGenerator<T>,
): RPCStreamSWRResult<T> {
  return useRPCStreamSWR({
    key,
    subscribe,
    shouldStop: chunk => chunk.status === "agentNotFound",
  });
}
