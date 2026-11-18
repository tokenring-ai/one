import { useEffect, useState } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { formatAge, type InstalledAs, KIND_META } from "./marketplaceItems.ts";

/** The current time, re-read every `intervalMs` so relative timestamps stay honest while a page sits open. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "Updated 5m ago" beside Refresh, with the exact time on hover. */
export function FetchedAt({ fetchedAt }: { fetchedAt: number }) {
  const now = useNow(30_000);
  return (
    <span
      className="text-xs text-muted whitespace-nowrap"
      title={`Registry listing fetched ${new Date(fetchedAt).toLocaleString()}`}
      data-testid="marketplace-fetched-at"
    >
      Updated {formatAge(fetchedAt, now)}
    </span>
  );
}

/**
 * Asks before uninstalling a marketplace item. Shared by the storefront's card menu and the detail page
 * so the wording is the same wherever the action lives.
 */
export function useUninstallConfirm() {
  const { openConfirm, Dialog } = useConfirmDialog();
  const confirmUninstall = (installedAs: InstalledAs) =>
    openConfirm({
      title: `Uninstall ${KIND_META[installedAs.kind].label.toLowerCase()}`,
      message: `Remove “${installedAs.name}” from this workspace? Any local edits to it are lost. You can install it again from the marketplace.`,
      confirmText: "Uninstall",
      variant: "danger",
      id: "marketplace-uninstall",
    });
  return { confirmUninstall, UninstallDialog: Dialog };
}
