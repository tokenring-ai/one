import { Cpu, GitBranch, type LucideIcon, Sparkles, Wrench } from "lucide-react";

/** The kinds a registry can publish. Mirrors `MarketplaceKindSchema` in `@tokenring-ai/marketplace`. */
export type MarketplaceKind = "agent" | "tool" | "workflow" | "skill";

/** One entry in the registry's `registry.yaml`. */
export interface MarketplaceEntry {
  kind: MarketplaceKind;
  /** `<kind>/<category>/<name>`, e.g. "agent/coding/code-reviewer". */
  id: string;
  /** Local name suggested when installing. */
  installAs: string;
  displayName: string;
  description: string;
  category: string;
  author: string;
  tags: string[];
  version: string;
  updatedAt: string;
  icon: string;
  requiresPlugins: string[];
}

/** Where an installed item lives locally. */
export interface InstalledAs {
  kind: MarketplaceKind;
  name: string;
  /** Registry version that was installed (`installedFrom.version`); "" or absent when unknown. */
  version?: string | undefined;
}

/**
 * Compares two dotted version strings numerically segment by segment ("1.10.0" > "1.9.2"). Non-numeric
 * segments compare as text, so pre-release tags still order deterministically.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.trim().replace(/^v/i, "").split(/[.+-]/);
  const right = b.trim().replace(/^v/i, "").split(/[.+-]/);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? "0";
    const y = right[i] ?? "0";
    const nx = Number(x);
    const ny = Number(y);
    const diff = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The registry version an installed item can be updated to, or null when it is current. Unknown
 * versions on either side never claim an update: there is nothing to compare.
 */
export function availableUpdate(installed: InstalledAs | null | undefined, registryVersion: string | undefined): string | null {
  const local = installed?.version?.trim();
  const remote = registryVersion?.trim();
  if (!local || !remote) return null;
  return compareVersions(remote, local) > 0 ? remote : null;
}

/** "just now", "5m ago", "3h ago", "2d ago" — how stale a fetched registry index is. */
export function formatAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Everything the UI needs to know about a kind, so no component branches on the kind itself.
 * `accent` is a Tailwind colour family shared by the badge, the icon tile, and the kind filter.
 */
export interface KindMeta {
  label: string;
  plural: string;
  icon: LucideIcon;
  /** Where an installed item of this kind can be opened. */
  installedPath: (name: string) => string;
  /** Tile background + foreground, at the low contrast a dense grid can carry. */
  tile: string;
  /** Uppercase badge on the card. */
  badge: string;
  /** Gradient for the page-header icon, matching the host app's own header. */
  gradient: string;
  /** One line on what installing this kind gives you, shown in the storefront header. */
  description: string;
}

export const KIND_META: Record<MarketplaceKind, KindMeta> = {
  agent: {
    label: "Agent",
    plural: "Agents",
    icon: Cpu,
    installedPath: name => `/agents/${encodeURIComponent(name)}`,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    badge: "text-amber-600 dark:text-amber-500",
    gradient: "from-amber-500 to-orange-600",
    description: "Ready-made assistants with their own instructions and tools; start a chat with one after installing.",
  },
  tool: {
    label: "Tool",
    plural: "Tools",
    icon: Wrench,
    // Tools have no app of their own; the closest thing is the agent that runs them.
    installedPath: () => "/agents",
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    badge: "text-violet-600 dark:text-violet-400",
    gradient: "from-violet-500 to-purple-600",
    description: "Extra capabilities your agents can call while they work.",
  },
  workflow: {
    label: "Workflow",
    plural: "Workflows",
    icon: GitBranch,
    installedPath: name => `/workflows/${encodeURIComponent(name)}`,
    tile: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    badge: "text-cyan-600 dark:text-cyan-400",
    gradient: "from-cyan-500 to-teal-600",
    description: "Multi-step recipes that run one or more agents to finish a task end to end.",
  },
  skill: {
    label: "Skill",
    plural: "Skills",
    icon: Sparkles,
    // The skills library has no per-skill route; opening one lands on the library.
    installedPath: () => "/skills",
    tile: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    badge: "text-fuchsia-600 dark:text-fuchsia-400",
    gradient: "from-fuchsia-500 to-pink-600",
    description: "Reusable instruction packs an agent can run on demand, without changing the agent itself.",
  },
};

/**
 * Why the registry did not answer with an index: unreachable (a retry may work) or turned off in
 * configuration (no retry can until it is enabled).
 */
export interface MarketplaceUnavailable {
  reason: "unreachable" | "disabled";
  message: string;
}

/** Install failed because the local name is taken — the fix is picking another name on the detail page. */
export function isNameCollisionError(message: string): boolean {
  return /already exists/i.test(message);
}

export const ALL_KINDS: MarketplaceKind[] = ["agent", "tool", "workflow", "skill"];

export type MarketplaceSort = "alphabetical" | "recent" | "category";

export const MARKETPLACE_SORTS: { id: MarketplaceSort; label: string }[] = [
  { id: "alphabetical", label: "Name" },
  { id: "recent", label: "Recently updated" },
  { id: "category", label: "Category" },
];

/** Sentinel for "no category filter". Not a real category, so it cannot collide with one. */
export const ALL_CATEGORIES = "All";

export function matchesQuery(entry: MarketplaceEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.displayName.toLowerCase().includes(q) ||
    entry.installAs.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.category.toLowerCase().includes(q) ||
    entry.author.toLowerCase().includes(q) ||
    entry.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export function sortItems(entries: MarketplaceEntry[], sort: MarketplaceSort): MarketplaceEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "recent":
      // Entries without an updatedAt sort last rather than jumbling in with the newest.
      return sorted.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || a.displayName.localeCompare(b.displayName));
    case "category":
      return sorted.sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));
    default:
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}

/** `[label, count]` pairs for one facet, most-used first then alphabetical. */
function countBy(entries: MarketplaceEntry[], pick: (entry: MarketplaceEntry) => string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const value of pick(entry)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function countByCategory(entries: MarketplaceEntry[]): { value: string; count: number }[] {
  return countBy(entries, entry => [entry.category]);
}

export function countByTag(entries: MarketplaceEntry[]): { value: string; count: number }[] {
  return countBy(entries, entry => entry.tags);
}

export function countByKind(entries: MarketplaceEntry[]): Record<MarketplaceKind, number> {
  const counts = { agent: 0, tool: 0, workflow: 0, skill: 0 } satisfies Record<MarketplaceKind, number>;
  for (const entry of entries) counts[entry.kind] += 1;
  return counts;
}

/** The filters the storefront applies, kept together so the empty states can tell "no results" from "no items". */
export interface MarketplaceFilters {
  kind: MarketplaceKind | null;
  category: string;
  tag: string | null;
  query: string;
}

export function applyFilters(entries: MarketplaceEntry[], filters: MarketplaceFilters, sort: MarketplaceSort): MarketplaceEntry[] {
  const filtered = entries.filter(
    entry =>
      (filters.kind === null || entry.kind === filters.kind) &&
      (filters.category === ALL_CATEGORIES || entry.category === filters.category) &&
      (filters.tag === null || entry.tags.includes(filters.tag)) &&
      matchesQuery(entry, filters.query),
  );
  return sortItems(filtered, sort);
}

/** Up to two initials for the author avatar. */
export function authorInitials(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join("");
}

/**
 * Deterministic tint for an author avatar, so the same author always looks the same without the
 * registry having to specify colours. Kept to backgrounds only — the card's own accent is the kind's.
 */
const AVATAR_TINTS = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-sky-500/15 text-sky-600 dark:text-sky-400",
];

export function avatarTint(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
}

/** Local names must be valid file names, the same rule every directory service enforces. */
export const INSTALL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/** The route for one marketplace item, given the app it is being browsed in. */
export function itemPath(basePath: string, id: string, includeKind: boolean): string {
  // Ids are `<kind>/<category>/<name>`. An embedded storefront already knows its kind, so its routes
  // carry only the last two segments and reattach the kind when reading them back.
  const segments = id.split("/");
  return `${basePath}/${(includeKind ? segments : segments.slice(1)).map(encodeURIComponent).join("/")}`;
}
