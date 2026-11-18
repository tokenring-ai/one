import { type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/utils.ts";
import { getDashboardManifestById } from "../../shell/appCatalog.ts";

export interface ViewHeaderAction {
  /** Stable key; falls back to `label`. */
  key?: string | undefined;
  icon: ReactNode;
  /** Accessible name for the button. */
  label: string;
  title?: string | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
}

export interface ViewHeaderProps {
  /**
   * `panel` — a 44px bar with an icon badge, for a main-area panel or a page.
   * `navigator` — a compact, content-hugging row for a sidebar.
   */
  variant?: "panel" | "navigator" | undefined;
  /**
   * Omit it on a navigator whose dock tab already names the panel — repeating
   * the tab's title inside the panel is the most common way these sidebars end
   * up looking like they have two title bars.
   */
  title?: ReactNode | undefined;
  subtitle?: ReactNode | undefined;
  /**
   * Takes the icon and gradient from the dashboard manifest, which already owns
   * them for the rail, switcher and launcher. Prefer this over passing `icon`
   * and `iconGradient` by hand: hardcoding them at the call site is how three
   * dashboards ended up with headers that did not match their own rail entry.
   */
  dashboardId?: string | undefined;
  /** A component (`Box`) or an element (`<Box />`); both are sized by the badge. */
  icon?: ElementType | ReactElement | undefined;
  /** Tailwind gradient classes for the icon badge, e.g. `from-violet-500 to-purple-600`. */
  iconGradient?: string | undefined;
  /** Content between the title and the actions: search, filters, selectors. */
  middle?: ReactNode | undefined;
  /** Icon buttons rendered on the right. */
  actions?: readonly ViewHeaderAction[] | undefined;
  /** Arbitrary right-hand content, rendered after `actions`. */
  children?: ReactNode | undefined;
  className?: string | undefined;
}

const actionButtonClass =
  "p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed shrink-0";

function Actions({ actions, children }: { actions: readonly ViewHeaderAction[]; children?: ReactNode }) {
  if (actions.length === 0 && children == null) return null;
  return (
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
      {children}
    </div>
  );
}

/**
 * The one header every view and page uses.
 *
 * Replaced `PanelToolbar` (h-11, now deleted), `DashboardToolbar`'s identity
 * block (h-10), `NavigationSidebarHeader` (py-2, now an alias for the navigator
 * variant), the two dozen hand-rolled bars that sat at six further heights and
 * `AppPageHeader` (the legacy plugin pages are views now). Two variants cover
 * every call site, and fixing the height here is what makes panels line up
 * across a dashboard.
 */
export default function ViewHeader({
  variant = "panel",
  title,
  subtitle,
  dashboardId,
  icon,
  iconGradient,
  middle,
  actions = [],
  children,
  className,
}: ViewHeaderProps) {
  if (variant === "navigator") {
    // Content-hugging, not a fixed height: the dock tab above is the panel's
    // title bar, so this row is subordinate to it and must not out-weigh it.
    return (
      <div className={cn("shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-primary", className)}>
        {title == null ? (
          <span className="flex-1" />
        ) : typeof title === "string" ? (
          // Deliberately not `SectionLabel`'s uppercase treatment: that is the
          // dominant heading *inside* a panel, and two of them adjacent read as
          // having no hierarchy at all.
          <span className="flex-1 min-w-0 truncate px-1 text-xs font-medium text-muted">{title}</span>
        ) : (
          <div className="flex-1 min-w-0">{title}</div>
        )}
        {middle != null ? <div className="shrink-0 text-xs text-muted">{middle}</div> : null}
        <Actions actions={actions}>{children}</Actions>
      </div>
    );
  }

  const manifest = dashboardId ? getDashboardManifestById(dashboardId) : undefined;
  const Icon = icon ?? manifest?.icon;
  const IconComponent = Icon as ElementType;
  const gradient = iconGradient ?? manifest?.gradient ?? "from-accent to-accent-hover";

  return (
    <div className={cn("shrink-0 h-11 flex items-center gap-2 px-3 border-b border-primary bg-secondary", className)}>
      {Icon ? (
        <span
          className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-linear-to-br shadow-sm [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-white", gradient)}
        >
          {/* lucide icons are forwardRef objects, not functions, so test for an
              element rather than for a callable. */}
          {isValidElement(Icon) ? Icon : <IconComponent className="w-4 h-4 text-white" aria-hidden="true" />}
        </span>
      ) : null}
      <div className="min-w-0 flex items-baseline gap-2">
        {typeof title === "string" ? <h2 className="truncate text-sm font-semibold text-primary">{title}</h2> : title}
        {subtitle ? typeof subtitle === "string" ? <p className="hidden md:block truncate text-xs text-muted">{subtitle}</p> : subtitle : null}
      </div>
      {middle != null ? <div className="flex-1 flex items-center gap-2 min-w-0">{middle}</div> : <div className="flex-1" />}
      <Actions actions={actions}>{children}</Actions>
    </div>
  );
}
