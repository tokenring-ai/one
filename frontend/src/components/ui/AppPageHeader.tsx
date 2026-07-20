import type React from "react";
import { cn } from "../../lib/utils.ts";

export interface AppPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  /** Tailwind gradient classes for the icon badge, e.g. `from-violet-500 to-purple-600` */
  iconGradient?: string;
  /** Extra classes on the icon badge container */
  iconClassName?: string;
  /** `default` = py-3; `compact` = py-2 / py-2.5 */
  size?: "default" | "compact";
  className?: string;
  children?: React.ReactNode;
}

export default function AppPageHeader({
  title,
  subtitle,
  icon,
  iconGradient = "from-accent to-accent-hover",
  iconClassName,
  size = "default",
  className,
  children,
}: AppPageHeaderProps) {
  const isCompact = size === "compact";
  const middleGrows = children != null || typeof title !== "string";

  return (
    <div className={cn("shrink-0 border-b border-primary bg-secondary flex items-center gap-3", isCompact ? "px-4 py-2" : "px-4 sm:px-6 py-3", className)}>
      <div
        className={cn(
          "rounded-lg bg-linear-to-br flex items-center justify-center shadow-sm shrink-0",
          isCompact ? "w-6 h-6 [&>svg]:w-3.5 [&>svg]:h-3.5" : "w-7 h-7 [&>svg]:w-4 [&>svg]:h-4",
          "[&>svg]:text-white",
          iconGradient,
          iconClassName,
        )}
      >
        {icon}
      </div>
      <div className={cn("min-w-0", middleGrows && "flex-1")}>
        {typeof title === "string" ? <h1 className="text-sm font-semibold text-primary">{title}</h1> : title}
        {subtitle ? typeof subtitle === "string" ? <p className="text-2xs text-muted">{subtitle}</p> : subtitle : null}
      </div>
      {children ? <div className="flex-1 flex items-center justify-end gap-2 min-w-0">{children}</div> : null}
    </div>
  );
}
