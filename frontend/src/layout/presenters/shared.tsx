import { X } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "../../lib/utils.ts";
import type { PanelBadge } from "../types.ts";

export function Badge({ badge }: { badge: PanelBadge | undefined }) {
  if (!badge) return null;
  const tone = {
    dirty: "bg-fg-secondary",
    info: "bg-[var(--status-info-fg)]",
    success: "bg-[var(--status-success-fg)]",
    warning: "bg-[var(--status-warning-fg)] ring-2 ring-[var(--status-warning-bg)]",
    danger: "bg-[var(--status-danger-fg)]",
  }[badge.tone];
  const label = badge.label ?? (badge.tone === "dirty" ? "Unsaved changes" : "Needs attention");
  if (badge.count !== undefined) {
    const countTone =
      badge.tone === "warning"
        ? "bg-(--status-warning-bg) text-(--status-warning-fg)"
        : badge.tone === "danger"
          ? "bg-(--status-danger-bg) text-(--status-danger-fg)"
          : "bg-accent-tint text-accent-soft";
    return (
      <span className={cn("min-w-4 shrink-0 rounded-full px-1 text-center text-[10px] font-medium leading-4 tabular-nums", countTone)} title={label}>
        <span aria-hidden="true">{badge.count}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone)} title={label} role="img" aria-label={label} />;
}

export function CloseButton({ title, hint, onClose, className }: { title: string; hint?: string | undefined; onClose: () => void; className?: string }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Close ${title}`}
      title={hint ?? `Close ${title}`}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClose();
      }}
      className={cn("grid h-4.5 w-4.5 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-fg", className)}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

/** Thin insert marker drawn between items while dragging. */
export function InsertMarker({ axis }: { axis: "x" | "y" }) {
  return axis === "x" ? (
    <span aria-hidden="true" className="relative w-0 shrink-0">
      <span className="absolute inset-y-1 -left-px w-0.5 rounded bg-accent" />
    </span>
  ) : (
    <span aria-hidden="true" className="relative h-0 shrink-0">
      <span className="absolute inset-x-1.5 -top-px h-0.5 rounded bg-accent" />
    </span>
  );
}
