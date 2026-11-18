import { cn } from "../../lib/utils.ts";
import { ALL_CATEGORIES } from "./marketplaceItems.ts";

interface Facet {
  value: string;
  count: number;
}

function FacetButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer focus-ring",
        active ? "bg-accent-muted text-accent-soft font-medium" : "text-muted hover:bg-hover hover:text-primary",
      )}
    >
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <span className="shrink-0 tabular-nums">{count}</span>
    </button>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-2 pb-1 text-xs font-bold text-dim uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

/**
 * The storefront's filter rail: category counts, then tags.
 *
 * Everything is a plain button with `aria-current`, rather than a select — the counts are the point,
 * and a select would hide them. Tags are capped so a registry with a long tail does not push the
 * grid off the screen; the search box covers the rest. The active category and tag are always
 * listed, even when outside that cap or absent from the current items.
 */
export default function MarketplaceFacets({
  total,
  categories,
  tags,
  category,
  tag,
  onCategoryChange,
  onTagChange,
  maxTags = 12,
}: {
  /** Item count before category and tag filtering, for the "All" row. */
  total: number;
  categories: Facet[];
  tags: Facet[];
  category: string;
  tag: string | null;
  onCategoryChange: (category: string) => void;
  onTagChange: (tag: string | null) => void;
  maxTags?: number;
}) {
  // A remembered filter can name a category or tag that is no longer in the
  // list (outside the top tags, or gone after a refresh or kind switch). It is
  // still shown, active, so the user can always see and clear it.
  const categoryRows =
    category !== ALL_CATEGORIES && !categories.some(item => item.value === category) ? [...categories, { value: category, count: 0 }] : categories;
  const topTags = tags.slice(0, maxTags);
  const tagRows =
    tag !== null && !topTags.some(item => item.value === tag) ? [...topTags, tags.find(item => item.value === tag) ?? { value: tag, count: 0 }] : topTags;

  return (
    <nav aria-label="Marketplace filters" className="space-y-4 md:sticky md:top-0">
      <FacetGroup title="Category">
        <FacetButton label={ALL_CATEGORIES} count={total} active={category === ALL_CATEGORIES} onClick={() => onCategoryChange(ALL_CATEGORIES)} />
        {categoryRows.map(item => (
          <FacetButton key={item.value} label={item.value} count={item.count} active={category === item.value} onClick={() => onCategoryChange(item.value)} />
        ))}
      </FacetGroup>

      {tagRows.length > 0 && (
        <FacetGroup title="Tags">
          {tagRows.map(item => (
            <FacetButton
              key={item.value}
              label={item.value}
              count={item.count}
              active={tag === item.value}
              // Clicking the active tag clears it, so the rail needs no separate reset control.
              onClick={() => onTagChange(tag === item.value ? null : item.value)}
            />
          ))}
        </FacetGroup>
      )}
    </nav>
  );
}
