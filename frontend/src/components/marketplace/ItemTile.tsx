import { cn } from "../../lib/utils.ts";
import { KIND_META, type MarketplaceKind } from "./marketplaceItems.ts";

const SIZES = {
  sm: "w-10 h-10 rounded-lg text-lg [&>svg]:w-4 [&>svg]:h-4",
  lg: "w-14 h-14 rounded-xl text-2xl [&>svg]:w-6 [&>svg]:h-6",
} as const;

/**
 * The square that leads a card or detail hero: the registry's emoji if it supplied one, otherwise the
 * kind's icon. Deliberately a flat tint rather than a gradient — a grid of gradient tiles is noise,
 * and it leaves the page-header badge as the one place a gradient appears.
 */
export default function ItemTile({
  kind,
  icon,
  size = "sm",
  className,
}: {
  kind: MarketplaceKind;
  icon: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const meta = KIND_META[kind];
  return (
    <span className={cn("shrink-0 inline-flex items-center justify-center", SIZES[size], meta.tile, className)} aria-hidden="true">
      {icon || <meta.icon />}
    </span>
  );
}
