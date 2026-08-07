import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import type React from "react";
import { Fragment, useMemo, useState } from "react";

export interface SidebarCategoryAccordionSearch<T> {
  placeholder?: string;
  ariaLabel?: string;
  clearAriaLabel?: string;
  /** Return true when the item matches the current query (query is trimmed but not lowercased). */
  match: (item: T, query: string) => boolean;
}

export interface SidebarCategoryAccordionProps<T> {
  items: readonly T[];
  getCategory: (item: T) => string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Used when getCategory returns an empty string. */
  defaultCategory?: string;
  /** Optional filter box above the accordion groups. */
  search?: SidebarCategoryAccordionSearch<T>;
  /** Optional section heading above the search box / groups. */
  sectionTitle?: React.ReactNode;
  /** Extra classes for the section title text when sectionTitle is a string. */
  sectionTitleClassName?: string;
  /** Show `filtered of total` (or total) next to the section title. */
  showSectionCount?: boolean;
  isLoading?: boolean;
  error?: unknown;
  errorState?: React.ReactNode;
  loadingState?: React.ReactNode;
  emptyState?: React.ReactNode;
  /** Shown when a search query yields no matches (items exist, filter empty). */
  noMatchState?: (query: string) => React.ReactNode;
  className?: string;
}

/**
 * Grouped, collapsible category list for workspace navigation sidebars.
 * Owns collapse and search state; callers supply item rows via renderItem.
 * While a search query is active, categories stay expanded.
 */
export default function SidebarCategoryAccordion<T>({
  items,
  getCategory,
  getItemKey,
  renderItem,
  defaultCategory = "Uncategorized",
  search,
  sectionTitle,
  sectionTitleClassName = "text-accent/90",
  showSectionCount = false,
  isLoading = false,
  error,
  errorState,
  loadingState,
  emptyState,
  noMatchState,
  className = "",
}: SidebarCategoryAccordionProps<T>) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const isFiltering = Boolean(search && filter.trim().length > 0);

  const filteredItems = useMemo(() => {
    if (!search || !isFiltering) return items;
    const query = filter.trim();
    return items.filter(item => search.match(item, query));
  }, [filter, isFiltering, items, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, T[]> = {};
    for (const item of filteredItems) {
      const category = getCategory(item).trim() || defaultCategory;
      (groups[category] ??= []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [defaultCategory, filteredItems, getCategory]);

  const toggleCategory = (category: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const isCategoryCollapsed = (category: string) => !isFiltering && collapsed.has(category);

  const sectionCountLabel =
    showSectionCount && !isLoading && items.length > 0 ? (isFiltering ? `${filteredItems.length} of ${items.length}` : String(items.length)) : null;

  return (
    <div className={className}>
      {(sectionTitle != null || sectionCountLabel != null) && (
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          {typeof sectionTitle === "string" ? (
            <span className={`text-xs font-bold uppercase tracking-widest ${sectionTitleClassName}`}>{sectionTitle}</span>
          ) : (
            (sectionTitle ?? <span />)
          )}
          {sectionCountLabel != null && (
            <span className="text-xs text-muted" aria-live="polite">
              {sectionCountLabel}
            </span>
          )}
        </div>
      )}

      {search && items.length > 0 && (
        <div className="px-2 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none" />
            <input
              type="search"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={search.placeholder ?? "Filter…"}
              className="w-full bg-input border border-primary rounded-md py-1.5 pl-7 pr-7 text-xs text-primary placeholder-muted focus-accent transition-all"
              aria-label={search.ariaLabel ?? "Filter list"}
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted hover:text-primary cursor-pointer focus-ring"
                aria-label={search.clearAriaLabel ?? "Clear filter"}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && items.length === 0
        ? (loadingState ?? null)
        : error != null && items.length === 0
          ? (errorState ?? null)
          : items.length === 0
            ? (emptyState ?? null)
            : filteredItems.length === 0
              ? (noMatchState?.(filter.trim()) ?? <div className="px-3 py-4 text-center text-muted text-xs italic">No matches for “{filter.trim()}”</div>)
              : grouped.map(([category, categoryItems]) => {
                  const expanded = !isCategoryCollapsed(category);
                  return (
                    <div key={category}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center gap-1 px-2 py-1.5 text-left hover:bg-hover transition-colors cursor-pointer"
                        aria-expanded={expanded}
                      >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
                        <span className="flex-1 min-w-0 truncate text-xs font-semibold text-muted uppercase tracking-wider">{category}</span>
                        <span className="text-xs text-muted shrink-0 pr-1">{categoryItems.length}</span>
                      </button>
                      {expanded && categoryItems.map(item => <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>)}
                    </div>
                  );
                })}
    </div>
  );
}
