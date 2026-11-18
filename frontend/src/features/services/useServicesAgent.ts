import { useEffect } from "react";
import { useAgentList } from "../../rpc.ts";
import { setServicesAgentId, useServicesAgentId } from "./servicesStore.ts";

/**
 * The shared agent selection, reconciled against the live agent list: an empty
 * list clears it, and an agent that disappears is replaced by the first one
 * still running.
 *
 * Safe to call from more than one panel — the reconciliation is idempotent and
 * the store ignores a write that does not change the value.
 *
 * While the list is unknown (`data === undefined`: first load, or a stream
 * reset) nothing is reconciled, so a reconnect does not drop the selection and
 * then jump to the first agent.
 */
export function useServicesAgent() {
  const agents = useAgentList();
  const selectedAgentId = useServicesAgentId();

  useEffect(() => {
    const list = agents.data;
    if (list === undefined) return;
    if (list.length === 0) {
      setServicesAgentId(null);
      return;
    }
    if (!selectedAgentId || !list.some(agent => agent.id === selectedAgentId)) {
      setServicesAgentId(list[0]!.id);
    }
  }, [agents.data, selectedAgentId]);

  return { agents, selectedAgentId, selectAgent: setServicesAgentId };
}
