import formatError from "@tokenring-ai/utility/error/formatError";
import { agentRPCClient } from "../rpc.ts";
import { toastOnReject } from "./toastOnReject.ts";

export function cleanupAgent(agentId: string, reason: string): void {
  toastOnReject(agentRPCClient.deleteAgent({ agentId, reason }), {
    type: "warning",
    duration: 5000,
    message: error => {
      const message = formatError(error);
      console.warn(`Agent cleanup failed (${reason}):`, message);
      return `Failed to clean up agent: ${message}`;
    },
  });
}
