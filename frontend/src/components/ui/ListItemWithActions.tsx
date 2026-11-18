import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export interface ListItemWithActionsProps {
  /** Unique key for this list item. */
  id: string;
  /** Whether this item is currently selected. */
  selected?: boolean | undefined;
  /** Primary click handler (e.g., open, select, navigate). */
  onPrimary?: () => void;
  /** Primary content (label + metadata). */
  children: ReactNode;
  /**
   * Secondary action button(s) rendered on the right side.
   * Hidden by default, shown on hover/focus of the parent group and always on
   * no-hover (touch) devices (unless `alwaysShowAction` is true).
   */
  action?: ReactNode;
  /** Whether to show the action slot permanently (e.g. active tab, a11y). */
  alwaysShowAction?: boolean;
  /**
   * Extra props for the primary button (e.g. `disabled`, `title`, `aria-*`, `role`).
   * Ignored when `onPrimary` is not provided. `className` is merged with defaults.
   */
  primaryProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "children">;
  className?: string;
  "data-testid"?: string;
}

/**
 * Reveal rules for the action slot: hover on desktop, keyboard focus anywhere
 * in the row, and always visible on devices without hover (touch/phones),
 * where a hover-only reveal would hide delete/rename/new entirely.
 */
const HOVER_REVEAL_ACTION_CLASSES =
  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100";

/**
 * List item with a primary clickable area (selection/navigation) and optional
 * secondary action(s) revealed on hover via the `group` / `group-hover` pattern.
 */
export default function ListItemWithActions({
  id,
  selected = false,
  onPrimary,
  children,
  action,
  alwaysShowAction = false,
  primaryProps,
  className,
  "data-testid": testId,
}: ListItemWithActionsProps) {
  const { className: primaryClassName, ...restPrimaryProps } = primaryProps ?? {};

  return (
    <div
      className={cn("group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors", selected ? "bg-active" : "hover:bg-hover", className)}
      data-item-id={id}
      data-testid={testId}
      aria-current={selected ? "true" : undefined}
    >
      {onPrimary != null ? (
        <button
          type="button"
          onClick={onPrimary}
          className={cn("flex-1 min-w-0 text-left cursor-pointer focus-ring rounded-md", primaryClassName)}
          {...restPrimaryProps}
        >
          {children}
        </button>
      ) : (
        <div className="flex-1 min-w-0">{children}</div>
      )}
      {action != null ? (
        <div className={cn("shrink-0 flex items-center gap-0.5 transition-opacity", alwaysShowAction ? "opacity-100" : HOVER_REVEAL_ACTION_CLASSES)}>
          {action}
        </div>
      ) : null}
    </div>
  );
}
