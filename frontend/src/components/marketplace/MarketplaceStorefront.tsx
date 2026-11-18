import { ChevronDown, PowerOff, RefreshCw, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";
import EmptyState from "../ui/EmptyState.tsx";
import ErrorState from "../ui/ErrorState.tsx";
import LoadingState from "../ui/LoadingState.tsx";
import SearchInput from "../ui/SearchInput.tsx";
import MarketplaceCard from "./MarketplaceCard.tsx";
import MarketplaceFacets from "./MarketplaceFacets.tsx";
import { FetchedAt, useUninstallConfirm } from "./marketplaceActions.tsx";
import { CLEARED_MARKETPLACE_FILTERS, useMarketplaceFilters } from "./marketplaceFilters.ts";
import {
  ALL_CATEGORIES,
  applyFilters,
  countByCategory,
  countByKind,
  countByTag,
  type InstalledAs,
  KIND_META,
  MARKETPLACE_SORTS,
  type MarketplaceEntry,
  type MarketplaceKind,
  type MarketplaceSort,
  type MarketplaceUnavailable,
} from "./marketplaceItems.ts";

/** Segmented control over the kinds on offer. Hidden when the host has pinned the storefront to one. */
function KindTabs({
  kinds,
  counts,
  value,
  onChange,
}: {
  kinds: MarketplaceKind[];
  counts: Record<MarketplaceKind, number>;
  value: MarketplaceKind | null;
  onChange: (kind: MarketplaceKind | null) => void;
}) {
  const options: { id: MarketplaceKind | null; label: string; count: number }[] = [
    { id: null, label: "All", count: kinds.reduce((sum, kind) => sum + counts[kind], 0) },
    ...kinds.map(kind => ({ id: kind, label: KIND_META[kind].plural, count: counts[kind] })),
  ];

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-tertiary rounded-lg" role="group" aria-label="Filter by kind">
      {options.map(option => {
        const isActive = value === option.id;
        return (
          <button
            type="button"
            key={option.id ?? "all"}
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer focus-ring",
              isActive ? "bg-secondary text-primary shadow-sm" : "text-muted hover:text-primary",
            )}
          >
            {option.label}
            <span className={"tabular-nums text-muted"}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One line per kind on offer saying what installing it gives you. */
function KindDescriptions({ kinds }: { kinds: MarketplaceKind[] }) {
  return (
    <ul className="space-y-0.5 text-xs text-muted" data-testid="marketplace-kind-descriptions">
      {kinds.map(kind => (
        <li key={kind}>
          {kinds.length > 1 && <span className="font-semibold text-secondary">{KIND_META[kind].plural}: </span>}
          {KIND_META[kind].description}
        </li>
      ))}
    </ul>
  );
}

/**
 * The marketplace storefront: a kind control, a facet rail, and a card grid.
 *
 * Fully presentational — the route, the in-flight install, and the refresh all belong to the host,
 * so the same component serves the standalone Marketplace app and the Marketplace tabs inside the
 * Agents and Workflows apps. A host that passes a single `kind` gets a storefront with no kind
 * control, filtered to that kind.
 *
 * An unreachable registry renders as an empty state with a retry rather than an error: the registry
 * lives outside this app, and being offline or unpublished is an expected state. A registry turned
 * off in configuration says so and points at Configuration instead of offering a retry.
 *
 * The filters live in a module store keyed by `filterKey`, because every host replaces the
 * storefront with the item detail page: kept in component state they reset on "Back".
 */
export default function MarketplaceStorefront({
  header,
  filterKey,
  kinds,
  items,
  registryName,
  unavailableMessage,
  isLoading,
  error,
  refreshing,
  installedById,
  installingId,
  onRefresh,
  onView,
  onInstall,
  fetchedAt,
  updatingId = null,
  uninstallingId = null,
  onUpdate,
  onUninstall,
}: {
  /** Chrome the host owns — its page header, and any tab strip it shares with a sibling pane. */
  header?: React.ReactNode;
  /** Which storefront's filters to keep. Defaults to the offered kinds; pass one per host when two hosts offer the same kinds. */
  filterKey?: string;
  /** Kinds this storefront offers. One kind hides the kind control entirely. */
  kinds: MarketplaceKind[];
  items: MarketplaceEntry[];
  registryName: string;
  /**
   * Set when the registry did not answer with an index. A plain string is an unreachable registry;
   * `reason: "disabled"` is one turned off in configuration, which gets no Retry.
   */
  unavailableMessage: MarketplaceUnavailable | string | null;
  isLoading: boolean;
  error: unknown;
  refreshing: boolean;
  /** Registry id → where it is installed locally. */
  installedById: Map<string, InstalledAs>;
  installingId: string | null;
  onRefresh: () => void;
  onView: (entry: MarketplaceEntry) => void;
  onInstall: (entry: MarketplaceEntry) => void;
  /** When the listing on screen was fetched (ms since epoch); shown as "Updated 5m ago" next to Refresh. */
  fetchedAt?: number | undefined;
  /** Registry id an Update is running on. */
  updatingId?: string | null;
  /** Registry id an Uninstall is running on. */
  uninstallingId?: string | null;
  /** Reinstall an installed item in place. Omit to hide Update on installed cards. */
  onUpdate?: ((id: string) => void) | undefined;
  /** Remove an installed item; the storefront confirms first. Omit to hide Uninstall on installed cards. */
  onUninstall?: ((id: string) => void) | undefined;
}) {
  const { confirmUninstall, UninstallDialog } = useUninstallConfirm();
  const singleKind = kinds.length === 1 ? kinds[0]! : null;
  const [{ kind, category, tag, query, sort }, updateFilters] = useMarketplaceFilters(filterKey ?? kinds.join("+"));
  const setCategory = (next: string) => updateFilters({ category: next });
  const setTag = (next: string | null) => updateFilters({ tag: next });
  const setQuery = (next: string) => updateFilters({ query: next });
  const setSort = (next: MarketplaceSort) => updateFilters({ sort: next });
  /** Narrow screens fold the category and tag lists away, so the cards are not pushed off screen. */
  const [showFacets, setShowFacets] = useState(false);
  const activeFacet = [category !== ALL_CATEGORIES ? category : null, tag].filter(Boolean).join(" · ");

  // A host that pins the kind owns that filter; the local control is only for multi-kind storefronts.
  const activeKind = singleKind ?? kind;

  const offered = useMemo(() => items.filter(entry => kinds.includes(entry.kind)), [items, kinds]);
  const kindCounts = useMemo(() => countByKind(offered), [offered]);

  // Facets count within the chosen kind, so switching kinds does not leave impossible filters on screen.
  const inKind = useMemo(() => (activeKind === null ? offered : offered.filter(entry => entry.kind === activeKind)), [offered, activeKind]);
  const categories = useMemo(() => countByCategory(inKind), [inKind]);
  const tags = useMemo(() => countByTag(inKind), [inKind]);

  const visible = useMemo(() => applyFilters(offered, { kind: activeKind, category, tag, query }, sort), [offered, activeKind, category, tag, query, sort]);

  const handleKindChange = (next: MarketplaceKind | null) => {
    // The old category/tag may not exist in the new kind, which would show an empty grid for no
    // visible reason. Resetting them is the least surprising behaviour.
    updateFilters({ kind: next, category: ALL_CATEGORIES, tag: null });
  };

  const unavailable: MarketplaceUnavailable | null =
    typeof unavailableMessage === "string" ? { reason: "unreachable", message: unavailableMessage } : unavailableMessage;

  const body = () => {
    if (isLoading && offered.length === 0) return <LoadingState message="Loading marketplace…" className="py-16" />;
    if (error && offered.length === 0)
      return <ErrorState title="Failed to load the marketplace" error={error} onRetry={onRefresh} variant="page" className="py-12" />;
    if (unavailable?.reason === "disabled") {
      return (
        <EmptyState
          variant="card"
          icon={PowerOff}
          title="Marketplace turned off"
          hint={unavailable.message}
          action={
            <Link to="/configuration" className="text-xs font-medium text-accent hover:text-accent-soft focus-ring">
              Open Configuration
            </Link>
          }
          data-testid="marketplace-disabled"
        />
      );
    }
    if (unavailable) {
      return (
        <EmptyState
          variant="card"
          icon={Store}
          title="Marketplace unavailable"
          hint={unavailable.message}
          ctaLabel="Retry"
          ctaIcon={RefreshCw}
          ctaLoading={refreshing}
          onCta={onRefresh}
        />
      );
    }
    if (offered.length === 0) {
      return <EmptyState variant="card" icon={Sparkles} title="Nothing published yet" hint={`${registryName} does not list anything to install.`} />;
    }
    if (visible.length === 0) {
      return (
        <div className="px-3 py-10 flex flex-col items-center gap-3 text-center">
          <p className="text-muted text-xs italic">Nothing matches your filters.</p>
          <button
            type="button"
            onClick={() => updateFilters(CLEARED_MARKETPLACE_FILTERS)}
            className="px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
          >
            Clear filters
          </button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map(entry => {
          const installedAs = installedById.get(entry.id) ?? null;
          return (
            <MarketplaceCard
              key={entry.id}
              entry={entry}
              installedAs={installedAs}
              installing={installingId === entry.id}
              // One change at a time: every other card's actions wait for the one in flight.
              installDisabled={installingId !== null || updatingId !== null || uninstallingId !== null}
              onView={() => onView(entry)}
              onInstall={() => onInstall(entry)}
              changing={updatingId === entry.id ? "update" : uninstallingId === entry.id ? "uninstall" : null}
              onUpdate={onUpdate ? () => onUpdate(entry.id) : undefined}
              onUninstall={
                onUninstall && installedAs
                  ? () => {
                      void confirmUninstall(installedAs).then(confirmed => {
                        if (confirmed) onUninstall(entry.id);
                      });
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-primary">
      {header}

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {singleKind === null && <KindTabs kinds={kinds} counts={kindCounts} value={kind} onChange={handleKindChange} />}
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by name, author, or tag…"
              aria-label="Search the marketplace"
              clearAriaLabel="Clear marketplace search"
              size="md"
              className="flex-1 min-w-[12rem]"
            />
            <label className="sr-only" htmlFor="marketplace-sort">
              Sort marketplace items
            </label>
            <select
              id="marketplace-sort"
              value={sort}
              onChange={event => setSort(event.target.value as MarketplaceSort)}
              className="bg-input border border-control rounded-lg px-2.5 py-2 text-xs text-secondary focus-accent cursor-pointer"
            >
              {MARKETPLACE_SORTS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing || undefined}
              className="flex items-center gap-1.5 px-2.5 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} aria-hidden="true" /> Refresh
            </button>
            {fetchedAt !== undefined && fetchedAt > 0 && <FetchedAt fetchedAt={fetchedAt} />}
          </div>

          <KindDescriptions kinds={activeKind ? [activeKind] : kinds} />

          <div className="grid grid-cols-1 md:grid-cols-[11rem_1fr] gap-5 items-start">
            <div>
              <button
                type="button"
                onClick={() => setShowFacets(open => !open)}
                aria-expanded={showFacets}
                aria-controls="marketplace-facets"
                className="md:hidden flex w-full items-center gap-2 px-2.5 py-2 border border-primary rounded-lg text-xs text-secondary hover:bg-hover focus-ring"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="font-medium">Filters</span>
                {activeFacet && <span className="min-w-0 truncate text-muted">{activeFacet}</span>}
                <ChevronDown className={cn("ml-auto w-3.5 h-3.5 shrink-0 transition-transform", showFacets && "rotate-180")} aria-hidden="true" />
              </button>
              <div id="marketplace-facets" className={cn(showFacets ? "mt-2 block" : "hidden", "md:mt-0 md:block")}>
                <MarketplaceFacets
                  total={inKind.length}
                  categories={categories}
                  tags={tags}
                  category={category}
                  tag={tag}
                  onCategoryChange={setCategory}
                  onTagChange={setTag}
                />
              </div>
            </div>
            <div className="min-w-0">{body()}</div>
          </div>
        </div>
      </div>
      <UninstallDialog />
    </div>
  );
}
