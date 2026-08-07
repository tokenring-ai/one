import { PanelLeftClose } from "lucide-react";
import type React from "react";
import { useWorkspaceNavigation } from "./WorkspaceNavigationContext.tsx";

export interface NavigationSidebarHeaderAction {
  /** Stable key; falls back to label when omitted. */
  key?: string;
  icon: React.ReactNode;
  /** Accessible name for the action button. */
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface NavigationSidebarHeaderProps {
  title: React.ReactNode;
  /** Optional content between the title and actions (e.g. counts). */
  meta?: React.ReactNode;
  /** Optional action icons rendered on the right, before the contract control. */
  actions?: readonly NavigationSidebarHeaderAction[];
  className?: string;
}

const actionButtonClass =
  "p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed shrink-0";

/**
 * Shared header for WorkspaceShell navigation panes: title on the left, action
 * icons on the right. When used inside WorkspaceShell, a desktop contract control
 * is always appended (flex layout, no hover-only reveal).
 */
export default function NavigationSidebarHeader({ title, meta, actions = [], className = "" }: NavigationSidebarHeaderProps) {
  const workspaceNav = useWorkspaceNavigation();

  return (
    <div className={`flex items-center gap-1 px-2 py-2 border-b border-primary shrink-0 ${className}`.trim()}>
      {typeof title === "string" ? (
        <span className="flex-1 min-w-0 text-xs font-bold text-muted uppercase tracking-widest px-1 truncate">{title}</span>
      ) : (
        <div className="flex-1 min-w-0">{title}</div>
      )}

      {meta != null && meta !== false ? <div className="shrink-0 text-xs text-muted">{meta}</div> : null}

      <div className="flex items-center gap-0.5 shrink-0">
        {actions.map(action => (
          <button
            key={action.key ?? action.label}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title ?? action.label}
            aria-label={action.label}
            className={actionButtonClass}
          >
            {action.icon}
          </button>
        ))}

        {workspaceNav ? (
          <button
            type="button"
            onClick={workspaceNav.collapseDesktopNavigation}
            title={`Hide ${workspaceNav.navigationLabel}`}
            aria-label={`Hide ${workspaceNav.navigationLabel}`}
            className={`${actionButtonClass} hidden lg:inline-flex`}
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
