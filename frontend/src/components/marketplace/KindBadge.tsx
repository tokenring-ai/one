import { cn } from "../../lib/utils.ts";
import { KIND_META, type MarketplaceKind } from "./marketplaceItems.ts";

/**
 * The small uppercase label that says what an item is. Carried by text as well as colour, so a
 * mixed grid stays readable in greyscale and to a screen reader.
 */
export default function KindBadge({ kind, className }: { kind: MarketplaceKind; className?: string }) {
  const meta = KIND_META[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider", meta.badge, className)}>
      <meta.icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
