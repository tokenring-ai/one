import formatError from "@tokenring-ai/utility/error/formatError";
import { useEffect, useRef, useState } from "react";
import { cleanupAgent } from "../lib/agentCleanup.ts";
import { agentRPCClient } from "../rpc.ts";
import { type AgentTypeInfo, resolvePreferredAgentType } from "./agentTypeUtils.ts";
import { useRefSync } from "./useRefSync.ts";

export type { AgentTypeInfo } from "./agentTypeUtils.ts";
export { resolvePreferredAgentType } from "./agentTypeUtils.ts";

export interface UseBackgroundAgentOptions {
  appName: string;
  preferredTypes?: readonly string[];
  resolvePreferred?: (types: AgentTypeInfo[]) => AgentTypeInfo | undefined;
  noTypesMessage?: string;
  onNoTypes?: (message: string) => void;
  onError?: (message: string) => void;
  /**
   * How long the agent's questions wait for an answer. Default 0: nobody watches a background agent's
   * chat, so its questions take their defaults (approvals are refused) at once. null waits for an answer.
   */
  answerTimeoutSeconds?: number | null;
  /**
   * Only start one of `preferredTypes`; never fall back to another installed
   * type. When none is configured the hook reports `missingType` instead.
   */
  requirePreferred?: boolean;
}

export interface UseBackgroundAgentResult {
  agentId: string | null;
  initialising: boolean;
  error: string | null;
  /** True when `requirePreferred` is set and none of the preferred types is configured. */
  missingType: boolean;
}

/** Creates a background agent (one whose chat nobody watches) on mount and cleans it up on unmount. */
export function useBackgroundAgent(options: UseBackgroundAgentOptions): UseBackgroundAgentResult {
  const optionsRef = useRefSync(options);

  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(true);
  const [missingType, setMissingType] = useState(false);
  const agentRef = useRef<string | null>(null);

  useEffect(() => {
    const {
      appName,
      preferredTypes,
      resolvePreferred,
      noTypesMessage = "No agent types available",
      onNoTypes,
      onError,
      answerTimeoutSeconds = 0,
      requirePreferred = false,
    } = optionsRef.current;

    const abortController = new AbortController();
    void (async () => {
      try {
        const types = await agentRPCClient.getAgentTypes({});
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (abortController.signal.aborted) return;

        const preferred =
          requirePreferred && !resolvePreferred
            ? types.find(t => preferredTypes?.includes(t.type))
            : resolvePreferredAgentType(types, preferredTypes, resolvePreferred);
        if (!preferred) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
          if (!abortController.signal.aborted) {
            setError(noTypesMessage);
            setMissingType(requirePreferred);
            onNoTypes?.(noTypesMessage);
            setInitialising(false);
          }
          return;
        }

        const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, answerTimeoutSeconds });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (abortController.signal.aborted) {
          cleanupAgent(id, `${appName} cancelled during init`);
          return;
        }
        agentRef.current = id;
        setAgentId(id);
      } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (!abortController.signal.aborted) {
          const message = formatError(e);
          setError(message);
          onError?.(message);
        }
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (!abortController.signal.aborted) setInitialising(false);
      }
    })();

    return () => {
      abortController.abort();
      if (agentRef.current) {
        cleanupAgent(agentRef.current, `${appName} unmounted`);
        agentRef.current = null;
      }
    };
  }, []);

  return { agentId, initialising, error, missingType };
}
