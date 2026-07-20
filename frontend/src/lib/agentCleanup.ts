import formatError from "@tokenring-ai/utility/error/formatError";
import { toastManager } from "../components/ui/toast.tsx";
import { agentRPCClient } from "../rpc.ts";

export function cleanupAgent(agentId: string, reason: string): void {
  void agentRPCClient.deleteAgent({ agentId, reason }).catch((error: unknown) => {
    const message = formatError(error);
    console.warn(`Agent cleanup failed (${reason}):`, message);
    toastManager.warning(`Failed to clean up agent: ${message}`, { duration: 5000 });
  });
}
