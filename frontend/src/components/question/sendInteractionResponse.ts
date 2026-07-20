import { agentRPCClient } from "../../rpc.ts";

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
}) {
  await agentRPCClient.sendInteractionResponse({
    agentId,
    response: {
      type: "input.interaction",
      requestId,
      interactionId,
      result,
      timestamp: Date.now(),
    },
  });
}
