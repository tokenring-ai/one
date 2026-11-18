/**
 * Agent RPCs report a missing agent as `{ status: "agentNotFound" }` rather than throwing. For a
 * call whose caller only handles thrown errors, this turns that into one, so the user is told
 * instead of being shown success for a message that went nowhere.
 */
export function requireAgentFound<T extends { status: string }>(result: T): Exclude<T, { status: "agentNotFound" }> {
  if (result.status === "agentNotFound") throw new Error("The agent is no longer running.");
  return result as Exclude<T, { status: "agentNotFound" }>;
}
