import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";

/**
 * Vocabulary and row primitives shared by the Settings views. Each view is its
 * own React subtree, so anything two of them need lives here.
 */

/** The bordered card each group of settings rows sits in. */
export function SettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-secondary border border-primary rounded-xl overflow-hidden", className)}>{children}</div>;
}

export function SettingsRow({ title, description, children, border = true }: { title: string; description?: string; children: ReactNode; border?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-4 py-3.5", border && "border-b border-primary")}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-primary">{title}</p>
        {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
      </div>
      <div className="shrink-0 self-stretch sm:self-auto flex sm:block items-center justify-end">{children}</div>
    </div>
  );
}

export function NavRow({ to, title, description, icon, border = true }: { to: string; title: string; description: string; icon: ReactNode; border?: boolean }) {
  return (
    <Link
      to={to}
      className={cn("flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-hover transition-colors focus-ring", border && "border-b border-primary")}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 text-muted shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="text-xs text-muted mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
    </Link>
  );
}
