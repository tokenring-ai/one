import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { marketplaceRPCClient, useMarketplaceItem, useMarketplaceItems } from "../../rpc.ts";
import { toastManager } from "../ui/toast.tsx";
import type { MarketplaceItemDetailData } from "./MarketplaceItemDetail.tsx";
import {
  type InstalledAs,
  isNameCollisionError,
  itemPath,
  KIND_META,
  type MarketplaceEntry,
  type MarketplaceKind,
  type MarketplaceUnavailable,
} from "./marketplaceItems.ts";

/** Router state asking the detail page to focus its "Install as" field (after a card install collided). */
export const FOCUS_INSTALL_NAME_STATE = { focusInstallName: true } as const;

/**
 * Everything an app needs to host a kind-filtered marketplace beside its own content.
 *
 * The Agents and Workflows apps both show one: same fetch, same install, same routes, differing only
 * in which kind they offer and where they mount. Their marketplace routes carry `<category>/<name>`
 * rather than the full id, since the kind is already implied by the app — this reattaches it.
 *
 * Kept off the network entirely until `active` is true, so the tab costs nothing until it is opened.
 */
export function useEmbeddedMarketplace({
  kind,
  basePath,
  active,
  routeCategory,
  routeName,
  onInstalled,
}: {
  kind: MarketplaceKind;
  /** Route the storefront lives at, e.g. `/agents/marketplace`. */
  basePath: string;
  /** Whether the marketplace pane is on screen. */
  active: boolean;
  routeCategory: string | undefined;
  routeName: string | undefined;
  /**
   * Called after an install, update, or uninstall changes a local item (before navigating to it, for
   * an install), so the host can refresh its own list.
   */
  onInstalled?: (installed: InstalledAs) => void;
}) {
  const navigate = useNavigate();
  const [installingId, setInstallingId] = useState<string | null>(null);
  /** The installed item an Update or Uninstall is running on; one at a time, like installs. */
  const [changing, setChanging] = useState<{ id: string; action: "update" | "uninstall" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const id = active && routeCategory && routeName ? `${kind}/${routeCategory}/${routeName}` : null;

  const items = useMarketplaceItems(active);
  const item = useMarketplaceItem(id);

  const data = items.data;
  const entries = useMemo(() => (data?.status === "success" ? (data.items as MarketplaceEntry[]).filter(entry => entry.kind === kind) : []), [data, kind]);
  const installedById = useMemo(
    () => new Map<string, InstalledAs>(data?.status === "success" ? Object.entries(data.installed as Record<string, InstalledAs>) : []),
    [data],
  );

  const openInstalled = useCallback(
    (installed: InstalledAs) => {
      onInstalled?.(installed);
      void navigate(KIND_META[installed.kind].installedPath(installed.name));
    },
    [navigate, onInstalled],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // A forced refresh has to go through the client, not SWR's cache-revalidate.
      const result = await marketplaceRPCClient.listMarketplaceItems({ refresh: true });
      await items.mutate(result, { revalidate: false });
      if (id) void item.mutate();
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setRefreshing(false);
    }
  }, [id, item, items]);

  const handleInstall = useCallback(
    async (targetId: string, installAs?: string) => {
      if (installingId) return;
      setInstallingId(targetId);
      try {
        const installed = await marketplaceRPCClient.installMarketplaceItem({ id: targetId, ...(installAs ? { installAs } : {}) });
        toastManager.success(`${KIND_META[installed.kind].label} "${installed.name}" installed`, { duration: 3000 });
        // Refresh the installed map so a card left on screen flips to "Installed".
        void items.mutate();
        if (id === targetId) void item.mutate();
        openInstalled(installed);
      } catch (error) {
        const message = formatError(error);
        if (isNameCollisionError(message) && id !== targetId) {
          // A card install has no name field; open the detail page with its name field focused
          // so the fix is one rename away rather than a dead-end toast.
          toastManager.warning(`${message} Pick another name below.`, { duration: 6000 });
          void navigate(itemPath(basePath, targetId, false), { state: FOCUS_INSTALL_NAME_STATE });
        } else {
          toastManager.error(message, { duration: 5000 });
        }
      } finally {
        setInstallingId(null);
      }
    },
    [basePath, id, installingId, item, items, navigate, openInstalled],
  );

  /** Runs an Update or Uninstall on an installed item, then refreshes everything that shows it. */
  const changeInstalled = useCallback(
    async (targetId: string, action: "update" | "uninstall") => {
      if (changing || installingId) return;
      setChanging({ id: targetId, action });
      try {
        if (action === "update") {
          const updated = await marketplaceRPCClient.updateMarketplaceItem({ id: targetId });
          const label = KIND_META[updated.kind].label;
          toastManager.success(`${label} "${updated.name}" updated${updated.version ? ` to v${updated.version}` : ""}`, { duration: 3000 });
          onInstalled?.(updated);
        } else {
          const removed = await marketplaceRPCClient.uninstallMarketplaceItem({ id: targetId });
          toastManager.success(`${KIND_META[removed.kind].label} "${removed.name}" uninstalled`, { duration: 3000 });
          onInstalled?.(removed);
        }
        void items.mutate();
        if (id === targetId) void item.mutate();
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setChanging(null);
      }
    },
    [changing, id, installingId, item, items, onInstalled],
  );

  const unavailable: MarketplaceUnavailable | null =
    data?.status === "unavailable"
      ? { reason: "unreachable", message: data.message }
      : data?.status === "disabled"
        ? { reason: "disabled", message: data.message }
        : null;

  return {
    /** Non-null when a marketplace item's detail page is the active route. */
    id,
    entries,
    installedById,
    installingId,
    /** Registry id an Update is running on, or null. */
    updatingId: changing?.action === "update" ? changing.id : null,
    /** Registry id an Uninstall is running on, or null. */
    uninstallingId: changing?.action === "uninstall" ? changing.id : null,
    refreshing,
    /** When the registry index on screen was fetched (ms since epoch), or undefined before it answers. */
    fetchedAt: data?.status === "success" ? data.fetchedAt : undefined,
    registryName: data?.registryName ?? "the marketplace registry",
    /** Why the registry did not answer with an index (unreachable or turned off), or null. */
    unavailableMessage: unavailable,
    /** Count for the host's tab strip; undefined while the registry has not answered. */
    count: data?.status === "success" ? entries.length : undefined,
    isLoading: items.isLoading,
    error: items.error,
    detail: item.data as MarketplaceItemDetailData | undefined,
    detailLoading: item.isLoading,
    detailError: item.error,
    retryDetail: () => void item.mutate(),
    openInstalled,
    onRefresh: () => void handleRefresh(),
    onView: (entry: MarketplaceEntry) => void navigate(itemPath(basePath, entry.id, false)),
    onInstall: (entry: MarketplaceEntry) => void handleInstall(entry.id),
    onInstallAs: (installAs: string) => {
      if (id) void handleInstall(id, installAs);
    },
    /** Reinstalls an installed item in place from the registry. Pass an id; the host confirms nothing. */
    onUpdate: (targetId: string) => void changeInstalled(targetId, "update"),
    /** Removes an installed item. The storefront and detail page confirm before calling this. */
    onUninstall: (targetId: string) => void changeInstalled(targetId, "uninstall"),
    goToStorefront: () => void navigate(basePath),
  };
}
