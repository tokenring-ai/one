import { useCallback, useEffect, useRef, useState } from "react";
import { cleanupAgent } from "../lib/agentCleanup.ts";

export interface UseOwnedAgentResult {
  agentId: string | null;
  assignAgent: (id: string) => void;
}

/** Tracks an externally created agent and cleans it up on unmount. */
export function useOwnedAgent(appName: string): UseOwnedAgentResult {
  const [agentId, setAgentId] = useState<string | null>(null);
  const ownedRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (ownedRef.current) {
        cleanupAgent(ownedRef.current, `${appName} unmounted`);
        ownedRef.current = null;
      }
    };
  }, [appName]);

  const assignAgent = useCallback((id: string) => {
    ownedRef.current = id;
    setAgentId(id);
  }, []);

  return { agentId, assignAgent };
}
