import type React from "react";
import ViewHeader from "../ui/ViewHeader.tsx";

export interface NavigationSidebarHeaderAction {
  /** Stable key; falls back to label when omitted. */
  key?: string | undefined;
  icon: React.ReactNode;
  /** Accessible name for the action button. */
  label: string;
  title?: string | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
}

export interface NavigationSidebarHeaderProps {
  /** Omit when the panel's dock tab already names it. */
  title?: React.ReactNode | undefined;
  /** Optional content between the title and actions (e.g. counts). */
  meta?: React.ReactNode;
  /** Optional action icons rendered on the right. */
  actions?: readonly NavigationSidebarHeaderAction[];
  className?: string | undefined;
}

/**
 * Header for navigator views: title on the left, action icons on the right.
 *
 * Now a thin alias for `ViewHeader`'s navigator variant, so a navigator and the
 * panel beside it share one height. Kept as a named export because it is the
 * import every plugin navigator already uses; new code can call `ViewHeader`
 * directly.
 */
export default function NavigationSidebarHeader({ title, meta, actions = [], className }: NavigationSidebarHeaderProps) {
  return <ViewHeader variant="navigator" title={title} middle={meta} actions={actions} className={className} />;
}
