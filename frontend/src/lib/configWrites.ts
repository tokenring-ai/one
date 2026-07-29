import { configRPCClient } from "../rpc.ts";

export type ConfigScope = "user" | "project";
export type ConfigIssue = { path: (string | number)[]; message: string };
export type ConfigWriteResult = { ok: true } | { ok: false; issues: ConfigIssue[] };

/** Sentinel that tells the server to keep the secret it already has stored. */
export const SENSITIVE_KEEP = { __sensitive: "keep" } as const;

/**
 * Read-modify-write of one configuration override layer.
 *
 * Anything an app configures for itself goes through here rather than a
 * bespoke RPC — messaging account credentials, database connection strings —
 * the same way the Configuration app writes anything: the running plugins are
 * reconfigured live and the layer is persisted to disk.
 *
 * `applyConfig` replaces the whole layer rather than patching it, so the current
 * one is read first and the change merged onto it. Secrets already stored
 * survive the round trip — the server hands them out redacted and resolves an
 * echoed redaction back to the stored value on the way in.
 */
export async function updateConfigLayer(
  scope: ConfigScope,
  mutate: (overrides: Record<string, unknown>) => Record<string, unknown>,
): Promise<ConfigWriteResult> {
  const values = await configRPCClient.getConfigValues({});
  const current = values.overrides[scope] as Record<string, unknown>;
  return configRPCClient.applyConfig({ scope, overrides: mutate(structuredClone(current)) });
}

/** Turns `applyConfig` validation issues into something readable in a toast. */
export function formatConfigIssues(issues: ConfigIssue[]): string {
  return issues.map(issue => (issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message)).join("\n");
}
