import { ArrowUpCircle, Check, ChevronLeft, ChevronRight, Download, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils.ts";
import { markdownLinkComponents } from "../chat/MarkdownLink.tsx";
import ErrorState from "../ui/ErrorState.tsx";
import LoadingState from "../ui/LoadingState.tsx";
import TagChip from "../ui/TagChip.tsx";
import ViewHeader from "../ui/ViewHeader.tsx";
import ViewShell from "../ui/ViewShell.tsx";
import ItemPreview from "./ItemPreview.tsx";
import ItemTile from "./ItemTile.tsx";
import KindBadge from "./KindBadge.tsx";
import { useUninstallConfirm } from "./marketplaceActions.tsx";
import {
  authorInitials,
  availableUpdate,
  avatarTint,
  INSTALL_NAME_PATTERN,
  type InstalledAs,
  KIND_META,
  type MarketplaceEntry,
  type MarketplaceKind,
} from "./marketplaceItems.ts";

export interface MarketplaceItemDetailData {
  entry: MarketplaceEntry | null;
  marketplace: { version: string; author: string; readme: string };
  kind: MarketplaceKind;
  item: Record<string, unknown>;
  installedAs: InstalledAs | null;
  /** Local names of this kind that are already taken, so a collision is caught before the round trip. */
  existingNames: string[];
}

/**
 * Full view of one registry item, with the install action.
 *
 * A route rather than a modal, so a marketplace item can be linked to directly. Presentational: the
 * host owns the fetch, the in-flight install, and where "back" and "open installed" lead.
 *
 * Renders its own `ViewShell` in every state, so a host view returns it directly rather than
 * wrapping it in another one.
 */
export default function MarketplaceItemDetail({
  id,
  data,
  isLoading,
  error,
  registryName,
  installing,
  backLabel = "Marketplace",
  onRetry,
  onInstall,
  onBack,
  onOpenInstalled,
  updating = false,
  uninstalling = false,
  onUpdate,
  onUninstall,
}: {
  id: string;
  data: MarketplaceItemDetailData | undefined;
  isLoading: boolean;
  error: unknown;
  registryName: string;
  installing: boolean;
  /** What the breadcrumb calls the pane behind this one — "Marketplace" standalone, or the host's tab. */
  backLabel?: string;
  onRetry: () => void;
  onInstall: (installAs: string) => void;
  onBack: () => void;
  onOpenInstalled: (installed: InstalledAs) => void;
  updating?: boolean;
  uninstalling?: boolean;
  /** Reinstall the installed copy in place from the registry. Omit to hide the action. */
  onUpdate?: (() => void) | undefined;
  /** Remove the installed copy; the detail page confirms first. Omit to hide the action. */
  onUninstall?: (() => void) | undefined;
}) {
  const { confirmUninstall, UninstallDialog } = useUninstallConfirm();
  const suggestedName = data?.entry?.installAs ?? id.split("/").pop() ?? "";
  const [installAs, setInstallAs] = useState<string | null>(null);
  const value = installAs ?? suggestedName;

  // The route reuses this component when the id changes; drop the previous item's custom name.
  useEffect(() => {
    setInstallAs(null);
  }, [id]);

  // A card install that collided lands here asking for a new name: focus and select the field.
  const location = useLocation();
  const wantsNameFocus = (location.state as { focusInstallName?: boolean } | null)?.focusInstallName === true;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const showsNameField = data !== undefined && !data.installedAs;
  useEffect(() => {
    if (!wantsNameFocus || !showsNameField) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [wantsNameFocus, showsNameField, id]);

  if (isLoading && !data) {
    return (
      <ViewShell scroll={false}>
        <LoadingState message="Loading item…" className="flex-1" />
      </ViewShell>
    );
  }

  if (error || !data) {
    return (
      <ViewShell scroll={false}>
        <ErrorState title={`Failed to load "${id}"`} error={error ?? new Error("Item not found in the registry")} onRetry={onRetry} variant="page" />
      </ViewShell>
    );
  }

  const { entry, marketplace, kind, item, installedAs, existingNames } = data;
  const meta = KIND_META[kind];
  const displayName = (typeof item.displayName === "string" && item.displayName) || entry?.displayName || id;
  const description = (typeof item.description === "string" && item.description) || entry?.description || "";
  const version = marketplace.version || entry?.version || "";
  const author = marketplace.author || entry?.author || "";

  const collision = value !== "" && existingNames.includes(value);
  const nameInvalid = value !== "" && !INSTALL_NAME_PATTERN.test(value);
  const canInstall = !installing && value !== "" && !collision && !nameInvalid;
  const updateTo = availableUpdate(installedAs, version);
  const changing = updating || uninstalling;

  return (
    <ViewShell
      pad="page"
      width="prose"
      header={
        <ViewHeader
          title={displayName}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
                <button type="button" onClick={onBack} className="hover:text-primary transition-colors cursor-pointer focus-ring rounded">
                  {backLabel}
                </button>
                <ChevronRight className="w-3 h-3 text-dim shrink-0" aria-hidden="true" />
                <span className="text-secondary truncate" aria-current="page">
                  {displayName}
                </span>
              </nav>
              <span aria-hidden="true">·</span>
              <code className="font-mono">{id}</code>
              {version && <span>· v{version}</span>}
              <span>· {registryName}</span>
            </span>
          }
          icon={<meta.icon />}
          iconGradient={meta.gradient}
        >
          <button
            type="button"
            onClick={onBack}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-hover rounded-lg transition-colors cursor-pointer focus-ring"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> {backLabel}
          </button>
        </ViewHeader>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3.5">
          <ItemTile kind={kind} icon={entry?.icon ?? ""} size="lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <KindBadge kind={kind} />
              {entry?.category && <span className="text-xs text-muted">· {entry.category}</span>}
              {author && (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  ·
                  <span
                    className={cn("shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold", avatarTint(author))}
                    aria-hidden="true"
                  >
                    {authorInitials(author)}
                  </span>
                  {author}
                </span>
              )}
            </div>
            <p className="text-sm text-secondary leading-relaxed">{description || "No description provided."}</p>
            {entry && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map(tag => (
                  <TagChip key={tag} label={tag} showIcon={false} />
                ))}
              </div>
            )}
          </div>
        </div>

        {installedAs ? (
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5 border",
              updateTo ? "bg-amber-500/5 border-amber-500/30" : "bg-emerald-500/5 border-emerald-500/30",
            )}
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 min-w-0">
                <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Already installed as <code className="font-mono">{installedAs.name}</code>
                {installedAs.version && <span className="text-muted">· v{installedAs.version}</span>}
              </p>
              {updateTo && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400" data-testid="update-available">
                  <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Update available: v{updateTo}. Updating replaces any local edits.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onUpdate && updateTo && (
                <button
                  type="button"
                  onClick={onUpdate}
                  disabled={changing}
                  aria-busy={updating || undefined}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {updating ? "Updating…" : `Update to v${updateTo}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenInstalled(installedAs)}
                className="px-2.5 py-1.5 border border-primary bg-secondary text-xs font-medium text-secondary hover:text-primary hover:bg-hover rounded-lg transition-colors cursor-pointer focus-ring"
              >
                Open installed {meta.label.toLowerCase()}
              </button>
              {onUninstall && (
                <button
                  type="button"
                  onClick={() => {
                    void confirmUninstall(installedAs).then(confirmed => {
                      if (confirmed) onUninstall();
                    });
                  }}
                  disabled={changing}
                  aria-busy={uninstalling || undefined}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-xs font-medium text-muted hover:text-error hover:bg-(--status-danger-bg) rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uninstalling ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  {uninstalling ? "Uninstalling…" : "Uninstall"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-secondary border border-primary rounded-lg px-3 py-3 space-y-2">
            <label htmlFor="marketplace-install-name" className="block text-xs font-semibold text-muted uppercase tracking-wide">
              Install as
            </label>
            <div className="flex flex-wrap items-start gap-2">
              <input
                ref={nameInputRef}
                id="marketplace-install-name"
                type="text"
                value={value}
                onChange={event => setInstallAs(event.target.value)}
                spellCheck={false}
                className="flex-1 min-w-[12rem] bg-input border border-control rounded-lg px-3 py-2 text-xs font-mono text-primary placeholder-muted focus-accent"
              />
              <button
                type="button"
                onClick={() => onInstall(value)}
                disabled={!canInstall}
                aria-busy={installing || undefined}
                className="flex items-center gap-1.5 px-3 py-2 btn-accent text-xs font-semibold rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {installing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {installing ? "Installing…" : version ? `Install v${version}` : "Install"}
              </button>
            </div>
            {nameInvalid && <p className="text-xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>}
            {collision && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                A {meta.label.toLowerCase()} named “{value}” already exists. Choose a different name.
              </p>
            )}
            <p className="text-xs text-muted">Installing copies the {meta.label.toLowerCase()} into your workspace, where you can edit it.</p>
          </div>
        )}

        {marketplace.readme && (
          <section className="space-y-1">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">About</h2>
            {/* Registry content is untrusted: react-markdown never renders raw HTML (skipHtml) and drops unsafe URLs. */}
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-secondary prose-headings:text-primary prose-a:text-accent-soft prose-code:text-primary"
              data-testid="marketplace-readme"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents} skipHtml>
                {marketplace.readme}
              </ReactMarkdown>
            </div>
          </section>
        )}

        <ItemPreview kind={kind} item={item} />

        {entry && entry.requiresPlugins.length > 0 && (
          <section className="space-y-1.5">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Works best with</h2>
            <div className="flex flex-wrap gap-1.5">
              {entry.requiresPlugins.map(plugin => (
                <span key={plugin} className="px-2 py-1 bg-secondary border border-primary rounded-md text-xs font-mono text-secondary">
                  {plugin}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
      <UninstallDialog />
    </ViewShell>
  );
}
