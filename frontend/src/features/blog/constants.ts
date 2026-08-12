import type { FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import type { PostStatus, StatusFilter } from "./types.ts";

export const STATUS_STYLES: Record<PostStatus, { label: string; dot: string; badge: string }> = {
  draft: { label: "Draft", dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/30" },
  published: { label: "Published", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  scheduled: { label: "Scheduled", dot: "bg-blue-400", badge: "bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-400/30" },
  pending: { label: "Pending", dot: "bg-orange-400", badge: "bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-400/30" },
  private: { label: "Private", dot: "bg-violet-400", badge: "bg-violet-400/10 text-violet-600 dark:text-violet-400 border-violet-400/30" },
};

export const STATUS_FILTERS: FilterTabOption<StatusFilter>[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
];

/** Parse a comma-separated tags string into a clean array. */
export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}
