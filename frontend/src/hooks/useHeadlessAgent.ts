import formatError from "@tokenring-ai/utility/error/formatError";
import { useEffect, useRef, useState } from "react";
import { cleanupAgent } from "../lib/agentCleanup.ts";
import { agentRPCClient } from "../rpc.ts";
import { type AgentTypeInfo, resolvePreferredAgentType } from "./agentTypeUtils.ts";

export type { AgentTypeInfo } from "./agentTypeUtils.ts";
export { resolvePreferredAgentType } from "./agentTypeUtils.ts";

export interface UseHeadlessAgentOptions {
  appName: string;
  preferredTypes?: readonly string[];
  resolvePreferred?: (types: AgentTypeInfo[]) => AgentTypeInfo | undefined;
  noTypesMessage?: string;
  onNoTypes?: (message: string) => void;
  onError?: (message: string) => void;
  headless?: boolean;
}

export interface UseHeadlessAgentResult {
  agentId: string | null;
  initialising: boolean;
  error: string | null;
}

/** Creates a headless agent on mount and cleans it up on unmount. */
export function useHeadlessAgent(options: UseHeadlessAgentOptions): UseHeadlessAgentResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [agentId, setAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(true);
  const agentRef = useRef<string | null>(null);

  useEffect(() => {
    const { appName, preferredTypes, resolvePreferred, noTypesMessage = "No agent types available", onNoTypes, onError, headless = true } = optionsRef.current;

    const abortController = new AbortController();
    void (async () => {
      try {
        const types = await agentRPCClient.getAgentTypes({});
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
        if (abortController.signal.aborted) return;

        const preferred = resolvePreferredAgentType(types, preferredTypes, resolvePreferred);
        if (!preferred) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be mutated asynchronously
          if (!abortController.signal.aborted) {
            setError(noTypesMessage);
            onNoTypes?.(noTypesMessage);
            setInitialising(false);
          }
          return;
        }

        const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless });
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

  return { agentId, initialising, error };
}
