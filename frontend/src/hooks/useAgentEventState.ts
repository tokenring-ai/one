import { useEffect, useRef } from "react";
import { agentRPCClient } from "../rpc.ts";
import { createInitialAgentEventStreamState, type RemoteAgentStatus, reduceAgentEventStreamChunk } from "./agentEventStreamReducer.ts";
import { useRPCStream } from "./useRPCStream.ts";

export type { RemoteAgentStatus };

export function useAgentEventState(agentId: string) {
  const streamStateRef = useRef(createInitialAgentEventStreamState());

  useEffect(() => {
    streamStateRef.current = createInitialAgentEventStreamState();
  }, [agentId]);

  const { data, error, isConnecting, reconnectAttempts, manualReconnect } = useRPCStream({
    key: agentId,
    initialData: createInitialAgentEventStreamState,
    subscribe: signal =>
      agentRPCClient.streamAgentEvents(
        {
          agentId,
          fromPosition: streamStateRef.current.position,
        },
        signal,
      ),
    reduce: (prev, chunk) => {
      const next = reduceAgentEventStreamChunk(prev ?? createInitialAgentEventStreamState(), chunk);
      streamStateRef.current = next;
      return next;
    },
    shouldStop: chunk => chunk.status === "agentNotFound",
  });

  const state = data ?? createInitialAgentEventStreamState();

  return {
    messages: state.messages,
    agentStatus: state.agentStatus,
    position: state.position,
    currentExecutionState: state.currentExecutionState,
    isConnecting,
    connectionError: error,
    reconnectAttempts,
    agentNotFound: state.agentNotFound,
    manualReconnect,
  };
}
