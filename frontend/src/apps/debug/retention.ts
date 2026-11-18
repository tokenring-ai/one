import { appRPCClient } from "../../rpc.ts";

/** Retention choices offered in the capture panel; null keeps every snapshot. */
export const RETENTION_OPTIONS: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: null, label: "Keep all" },
  { value: 10, label: "Keep last 10" },
  { value: 25, label: "Keep last 25" },
  { value: 50, label: "Keep last 50" },
  { value: 100, label: "Keep last 100" },
];

/**
 * Names of the snapshots past the newest `keep`, oldest last. Input order does not matter.
 * DebugService prunes with this same order after every successful capture, including while
 * no Debug view is open. null (or a `keep` the list does not exceed) deletes nothing.
 */
export function snapshotsBeyondRetention(snapshots: ReadonlyArray<{ name: string; capturedAt: number }>, keep: number | null): string[] {
  if (keep === null || keep < 0 || snapshots.length <= keep) return [];
  return [...snapshots]
    .sort((a, b) => b.capturedAt - a.capturedAt || b.name.localeCompare(a.name))
    .slice(keep)
    .map(snapshot => snapshot.name);
}

/**
 * Deletes snapshot files one by one, tolerating ones already gone. Returns the names
 * that were deleted; failures are collected rather than aborting the rest.
 */
export async function deleteSnapshots(names: readonly string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const name of names) {
    try {
      await appRPCClient.deleteDebugSnapshot({ name });
      deleted.push(name);
    } catch {
      failed.push(name);
    }
  }
  return { deleted, failed };
}
