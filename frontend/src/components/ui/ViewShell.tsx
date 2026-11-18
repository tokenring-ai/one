import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type ViewShellTone = "surface" | "sidebar";
export type ViewShellPad = "none" | "compact" | "page";
export type ViewShellWidth = "full" | "prose" | "wide";

export interface ViewShellProps {
  children: ReactNode;
  /**
   * `surface` is the default panel background, already painted by `ViewFrame`;
   * `sidebar` is the tint a navigator sits on. Setting this here is what lets a
   * view stop repainting its own root — 23 of them were doing so redundantly.
   */
  tone?: ViewShellTone | undefined;
  header?: ReactNode | undefined;
  footer?: ReactNode | undefined;
  /** Default `true`. Pass `false` when a child owns scrolling (Monaco, xterm, a data grid). */
  scroll?: boolean | undefined;
  /** Body padding. Collapses the eleven ad-hoc combinations to three. */
  pad?: ViewShellPad | undefined;
  /** Content width clamp, centred. Collapses the six ad-hoc clamps to three. */
  width?: ViewShellWidth | undefined;
  className?: string | undefined;
  /** Extra classes for the body element. */
  bodyClassName?: string | undefined;
  "data-testid"?: string | undefined;
}

const tones: Record<ViewShellTone, string> = {
  surface: "bg-primary",
  sidebar: "bg-secondary",
};

const pads: Record<ViewShellPad, string> = {
  none: "",
  compact: "p-2",
  page: "px-4 sm:px-6 py-5",
};

const widths: Record<ViewShellWidth, string> = {
  full: "",
  prose: "max-w-3xl mx-auto",
  wide: "max-w-6xl mx-auto",
};

/**
 * The frame every view renders into: an optional header and footer that never
 * scroll, and a body that does.
 *
 * `ViewFrame` gives a view only a bare box, so each one previously invented its
 * own header height, scroll container, padding and content width. Routing them
 * through one component is what makes two panels side by side look like parts
 * of the same application.
 */
export default function ViewShell({
  children,
  tone = "surface",
  header,
  footer,
  scroll = true,
  pad = "none",
  width = "full",
  className,
  bodyClassName,
  "data-testid": testId,
}: ViewShellProps) {
  return (
    <div className={cn("h-full w-full min-h-0 min-w-0 flex flex-col", tones[tone], className)} data-testid={testId}>
      {header}
      {/* A non-scrolling body is a flex column: its child owns the scrolling and
          sizes itself with `flex-1`, the way these views did as children of a
          hand-rolled `h-full flex flex-col` root. */}
      <div className={cn("flex-1 min-h-0 min-w-0", scroll ? "overflow-y-auto" : "flex flex-col overflow-hidden", pads[pad], bodyClassName)}>
        {width === "full" ? children : <div className={widths[width]}>{children}</div>}
      </div>
      {footer}
    </div>
  );
}
