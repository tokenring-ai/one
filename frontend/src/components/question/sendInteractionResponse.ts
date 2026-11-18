import { requireAgentFound } from "../../lib/requireAgentFound.ts";
import { agentRPCClient } from "../../rpc.ts";

/**
 * Answers a question. Throws when the answer did not land, including when the agent
 * is gone (`agentNotFound`), so callers never close a question as if it were answered.
 */
export async function sendInteractionResponse({
  agentId,
  requestId,
  interactionId,
  result,
}: {
  agentId: string;
  requestId: string;
  interactionId: string;
  result: unknown;
}): Promise<void> {
  requireAgentFound(
    await agentRPCClient.sendInteractionResponse({
      agentId,
      response: {
        type: "input.interaction",
        requestId,
        interactionId,
        result,
        timestamp: Date.now(),
      },
    }),
  );
}
