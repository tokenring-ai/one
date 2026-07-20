export interface AgentTypeInfo {
  type: string;
}

export function resolvePreferredAgentType(
  types: AgentTypeInfo[],
  preferredTypes?: readonly string[],
  resolvePreferred?: (types: AgentTypeInfo[]) => AgentTypeInfo | undefined,
): AgentTypeInfo | undefined {
  if (resolvePreferred) return resolvePreferred(types);
  if (preferredTypes?.length) return types.find(t => preferredTypes.includes(t.type)) ?? types[0];
  return types[0];
}
