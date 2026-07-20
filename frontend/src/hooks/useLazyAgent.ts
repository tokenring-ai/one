import { useCallback, useEffect, useRef, useState } from "react";
import { cleanupAgent } from "../lib/agentCleanup.ts";
import { agentRPCClient } from "../rpc.ts";

export interface UseLazyAgentOptions {
  appName: string;
  agentType: string;
  headless?: boolean;
}

export interface UseLazyAgentResult {
  agentId: string | null;
  ensureAgent: () => string | Promise<string | null>;
  assignAgent: (id: string) => void;
}

/** Lazily creates an agent on first ensureAgent() call and cleans up on unmount. */
export function useLazyAgent({ appName, agentType, headless = false }: UseLazyAgentOptions): UseLazyAgentResult {
  const [agentId, setAgentId] = useState<string | null>(null);
  const ownedRef = useRef<string | null>(null);
  const startPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    return () => {
      if (ownedRef.current) {
        cleanupAgent(ownedRef.current, `${appName} unmounted`);
        ownedRef.current = null;
      }
    };
  }, [appName]);

  const ensureAgent = useCallback((): string | Promise<string | null> => {
    if (agentId) return agentId;
    if (startPromiseRef.current) return startPromiseRef.current;

    const startPromise = (async () => {
      try {
        const { id } = await agentRPCClient.createAgent({ agentType, headless });
        ownedRef.current = id;
        setAgentId(id);
        return id;
      } catch {
        return null;
      } finally {
        startPromiseRef.current = null;
      }
    })();

    startPromiseRef.current = startPromise;
    return startPromise;
  }, [agentId, agentType, headless]);

  const assignAgent = useCallback((id: string) => {
    ownedRef.current = id;
    setAgentId(id);
  }, []);

  return { agentId, ensureAgent, assignAgent };
}
