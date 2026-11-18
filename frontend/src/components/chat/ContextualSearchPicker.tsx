import { AnimatePresence, motion } from "framer-motion";
import { Bot, FolderOpen, Sparkles } from "lucide-react";
import type { ContextualSearchCategory, ContextualSearchItem, ContextualSearchPendingProvider } from "../../hooks/useContextualSearch.ts";

export type ContextualSearchPickerProps = {
  categories: ContextualSearchCategory[];
  pending: ContextualSearchPendingProvider[];
  selectedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (item: ContextualSearchItem) => void;
  onHover: (index: number) => void;
};

export function flattenContextualSearchItems(categories: ContextualSearchCategory[]): ContextualSearchItem[] {
  return categories.flatMap(category => category.items);
}

function uniquePendingCategories(pending: ContextualSearchPendingProvider[], categories: ContextualSearchCategory[]): ContextualSearchPendingProvider[] {
  const seen = new Set<string>();
  const withItems = new Set(categories.map(category => category.id));
  const unique: ContextualSearchPendingProvider[] = [];
  for (const entry of pending) {
    if (withItems.has(entry.categoryId) || seen.has(entry.categoryId)) continue;
    seen.add(entry.categoryId);
    unique.push(entry);
  }
  return unique;
}

function categoryIcon(categoryId: string) {
  if (categoryId === "agents") return Bot;
  if (categoryId === "skills") return Sparkles;
  return FolderOpen;
}

export default function ContextualSearchPicker({ categories, pending, selectedIndex, isLoading, query, onSelect, onHover }: ContextualSearchPickerProps) {
  const items = flattenContextualSearchItems(categories);
  const pendingCategories = uniquePendingCategories(pending, categories);
  let runningIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        id="contextual-search-results"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className="absolute bottom-full left-4 right-4 mb-2 max-h-64 overflow-y-auto p-2 bg-secondary border border-primary rounded-lg shadow-md z-20"
        role="listbox"
        aria-label="Contextual search results"
        aria-activedescendant={items[selectedIndex] ? `ctx-${selectedIndex}` : undefined}
      >
        {isLoading && items.length === 0 && pendingCategories.length === 0 && <div className="px-2 py-2 text-xs text-muted font-mono">Searching…</div>}
        {!isLoading && items.length === 0 && <div className="px-2 py-2 text-xs text-muted font-mono">No matches{query ? ` for “${query}”` : ""}</div>}
        {categories.map(category => {
          if (category.items.length === 0) return null;
          const Icon = categoryIcon(category.id);
          const stillLoading = pending.some(entry => entry.categoryId === category.id);
          return (
            <div key={category.id} className="mb-1 last:mb-0">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wide text-muted font-mono">
                <Icon className="w-3 h-3" />
                {category.label}
                {stillLoading && <span className="normal-case tracking-normal">· Searching…</span>}
              </div>
              {category.items.map(item => {
                const index = runningIndex++;
                const selected = index === selectedIndex;
                return (
                  <button
                    type="button"
                    key={`${category.id}:${item.id}`}
                    id={`ctx-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onSelect(item)}
                    className={`w-full text-left px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
                      selected ? "bg-accent text-primary" : "hover:bg-hover text-primary"
                    }`}
                  >
                    <div className="text-xs font-mono truncate">{item.title}</div>
                    {item.subtitle && <div className={`text-[11px] font-mono truncate ${selected ? "text-primary/80" : "text-muted"}`}>{item.subtitle}</div>}
                  </button>
                );
              })}
            </div>
          );
        })}
        {pendingCategories.map(category => {
          const Icon = categoryIcon(category.categoryId);
          return (
            <div key={`pending:${category.categoryId}`} className="mb-1 last:mb-0">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wide text-muted font-mono">
                <Icon className="w-3 h-3" />
                {category.categoryLabel}
              </div>
              <div className="px-2 py-1 text-[11px] font-mono text-muted">Searching…</div>
            </div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
