import { ArrowUpCircle, Check, ExternalLink, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.tsx";
import ItemTile from "./ItemTile.tsx";
import KindBadge from "./KindBadge.tsx";
import { authorInitials, availableUpdate, avatarTint, type InstalledAs, KIND_META, type MarketplaceEntry } from "./marketplaceItems.ts";

/**
 * One item in the storefront grid.
 *
 * The whole card is the link to the detail page — one hit target rather than a title button plus a
 * separate "Details" button — and Install is the single action layered on top of it. Install sits
 * outside the anchor so a click on it never navigates.
 */
export default function MarketplaceCard({
  entry,
  installedAs,
  installing,
  installDisabled = false,
  onView,
  onInstall,
  changing = null,
  onUpdate,
  onUninstall,
}: {
  entry: MarketplaceEntry;
  /** Where this entry is already installed locally, if it is. */
  installedAs: InstalledAs | null;
  installing: boolean;
  /** Another install is in flight; Install waits for it. */
  installDisabled?: boolean;
  onView: () => void;
  onInstall: () => void;
  /** An Update or Uninstall is running on this card's installed item. */
  changing?: "update" | "uninstall" | null;
  /** Reinstall the installed item from the registry. Omit to hide the action. */
  onUpdate?: (() => void) | undefined;
  /** Remove the installed item; the caller confirms first. Omit to hide the action. */
  onUninstall?: (() => void) | undefined;
}) {
  const updateTo = availableUpdate(installedAs, entry.version);
  const hasMenu = installedAs !== null && (onUninstall !== undefined || (onUpdate !== undefined && updateTo !== null));

  return (
    <div className="group relative flex flex-col min-w-0 bg-secondary border border-primary rounded-xl transition-colors hover:border-accent/40 focus-within:border-accent/40">
      <button
        type="button"
        onClick={onView}
        // Stretched hit area: the card is one target, and the Install button below sits above it.
        className="absolute inset-0 rounded-xl cursor-pointer focus-ring"
        aria-label={`View ${entry.displayName}`}
      />

      <div className="flex items-start gap-3 min-w-0 p-4 pb-2.5">
        <ItemTile kind={entry.kind} icon={entry.icon} />
        <div className="min-w-0 flex-1">
          <KindBadge kind={entry.kind} />
          <p className="mt-0.5 truncate text-sm font-semibold text-primary">{entry.displayName}</p>
          <p className="truncate text-xs text-muted">
            {entry.category}
            {entry.version && <span className="font-mono"> · v{entry.version}</span>}
          </p>
          {updateTo && (
            <span
              className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400"
              title={`Installed v${installedAs?.version} · registry has v${updateTo}`}
              data-testid="update-available"
            >
              <ArrowUpCircle className="w-3 h-3" aria-hidden="true" />
              Update available
            </span>
          )}
        </div>
      </div>

      <p className="px-4 text-xs text-secondary leading-relaxed line-clamp-2 min-w-0">{entry.description || "No description provided."}</p>

      <div className="flex items-center gap-2 min-w-0 mt-auto px-4 py-3">
        {entry.author && (
          <span className="flex items-center gap-1.5 min-w-0 text-xs text-muted">
            <span
              className={cn("shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold", avatarTint(entry.author))}
              aria-hidden="true"
            >
              {authorInitials(entry.author)}
            </span>
            <span className="truncate">{entry.author}</span>
          </span>
        )}

        <span className="ml-auto shrink-0 flex items-center gap-1">
          {changing && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" aria-label={changing === "update" ? "Updating" : "Uninstalling"} />}
          {installedAs ? (
            <Link
              to={KIND_META[installedAs.kind].installedPath(installedAs.name)}
              // Above the stretched link, so this click opens the installed item rather than the detail page.
              className="relative inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline rounded focus-ring"
              title={`Open the installed ${KIND_META[installedAs.kind].label.toLowerCase()} "${installedAs.name}"`}
              data-testid="installed-badge"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Installed
              {installedAs.name !== entry.installAs && <span className="text-muted font-normal">as {installedAs.name}</span>}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onInstall}
              disabled={installing || installDisabled}
              aria-busy={installing || undefined}
              aria-label={`Install ${entry.displayName}`}
              // Above the stretched link, so this click installs rather than navigating.
              className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-primary bg-primary text-xs font-semibold text-secondary rounded-lg transition-colors cursor-pointer focus-ring hover:border-accent hover:text-accent-soft disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {installing && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              {installing ? "Installing…" : "Install"}
            </button>
          )}
          {installedAs && hasMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={changing !== null || installDisabled}
                aria-label={`Actions for installed ${entry.displayName}`}
                // Above the stretched link, so opening the menu never navigates.
                className="relative p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuItem asChild className="gap-2 text-xs">
                  <Link to={KIND_META[installedAs.kind].installedPath(installedAs.name)}>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open
                  </Link>
                </DropdownMenuItem>
                {onUpdate && updateTo && (
                  <DropdownMenuItem className="gap-2 text-xs" onSelect={onUpdate}>
                    <ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" /> Update to v{updateTo}
                  </DropdownMenuItem>
                )}
                {onUninstall && (
                  <DropdownMenuItem className="gap-2 text-xs text-error" onSelect={onUninstall}>
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Uninstall
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>
    </div>
  );
}
