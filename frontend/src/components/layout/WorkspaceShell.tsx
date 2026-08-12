import { Menu, PanelLeftOpen, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import { WorkspaceNavigationProvider } from "./WorkspaceNavigationContext.tsx";

const MIN_NAVIGATION_WIDTH = 220;
const MAX_NAVIGATION_WIDTH = 380;
const DEFAULT_NAVIGATION_WIDTH = 280;

function clampWidth(width: number): number {
  return Math.min(MAX_NAVIGATION_WIDTH, Math.max(MIN_NAVIGATION_WIDTH, width));
}

export interface WorkspaceShellProps {
  appId: string;
  title: string;
  navigationLabel?: string;
  navigation: React.ReactNode;
  children: React.ReactNode;
  /** Mobile collection roots show navigation; selected resources show main. */
  hasSelection?: boolean;
  className?: string;
}

/**
 * Shared collection/tree workspace geometry. Desktop gets one resizable app-owned
 * navigator. Mobile gets a single-screen master/detail flow instead of a split.
 */
export default function WorkspaceShell({
  appId,
  title,
  navigationLabel = `${title} navigation`,
  navigation,
  children,
  hasSelection = true,
  className = "h-full",
}: WorkspaceShellProps) {
  const location = useLocation();
  const openKey = `tokenring-workspace-navigation-open:${appId}`;
  const widthKey = `tokenring-workspace-navigation-width:${appId}`;

  const [desktopOpen, setDesktopOpen] = useLocalStorageState(openKey, true, {
    serialize: String,
    deserialize: raw => raw === "true",
  });

  const [navigationWidth, setNavigationWidth] = useLocalStorageState(widthKey, DEFAULT_NAVIGATION_WIDTH, {
    serialize: String,
    deserialize: raw => {
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? clampWidth(value) : DEFAULT_NAVIGATION_WIDTH;
    },
  });

  const [mobileOpen, setMobileOpen] = useState(() => !hasSelection);
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== previousPath.current) {
      previousPath.current = location.pathname;
      if (hasSelection) setMobileOpen(false);
    }
  }, [hasSelection, location.pathname]);

  useEffect(() => {
    setMobileOpen(!hasSelection);
  }, [hasSelection]);

  const setDesktopNavigationOpen = useCallback(
    (open: boolean) => {
      setDesktopOpen(open);
    },
    [setDesktopOpen],
  );

  const collapseDesktopNavigation = useCallback(() => {
    setDesktopNavigationOpen(false);
  }, [setDesktopNavigationOpen]);

  const navigationContextValue = useMemo(
    () => ({
      collapseDesktopNavigation,
      navigationLabel,
    }),
    [collapseDesktopNavigation, navigationLabel],
  );

  const resizeBy = useCallback(
    (delta: number) => {
      setNavigationWidth(current => clampWidth(current + delta));
    },
    [setNavigationWidth],
  );

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = navigationWidth;
    const onMove = (moveEvent: PointerEvent) => setNavigationWidth(clampWidth(startWidth + moveEvent.clientX - startX));
    const onUp = (upEvent: PointerEvent) => {
      setNavigationWidth(clampWidth(startWidth + upEvent.clientX - startX));
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <WorkspaceNavigationProvider value={navigationContextValue}>
      <div className={`relative flex min-h-0 w-full overflow-hidden bg-primary ${className}`}>
        <aside
          aria-label={navigationLabel}
          style={{ "--workspace-navigation-width": `${navigationWidth}px` } as React.CSSProperties}
          className={`workspace-navigation-pane absolute inset-0 z-40 min-h-0 flex-col bg-sidebar lg:relative lg:inset-auto lg:z-auto lg:shrink-0 lg:border-r lg:border-primary ${mobileOpen ? "flex" : "hidden"} ${desktopOpen ? "lg:flex" : "lg:hidden"}`}
        >
          <div className="lg:hidden h-12 shrink-0 flex items-center gap-3 px-3 border-b border-primary">
            <span className="flex-1 text-sm font-semibold text-primary">{title}</span>
            {hasSelection && (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-16 w-11 place-items-center rounded-lg text-muted hover:text-primary hover:bg-hover focus-ring"
                aria-label={`Close ${navigationLabel}`}
                autoFocus
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 min-w-0">{navigation}</div>
        </aside>
        {desktopOpen && (
          <div
            role="separator"
            aria-label={`Resize ${navigationLabel}`}
            aria-orientation="vertical"
            aria-valuemin={MIN_NAVIGATION_WIDTH}
            aria-valuemax={MAX_NAVIGATION_WIDTH}
            aria-valuenow={navigationWidth}
            tabIndex={0}
            onPointerDown={beginResize}
            onDoubleClick={() => {
              setNavigationWidth(DEFAULT_NAVIGATION_WIDTH);
            }}
            onKeyDown={event => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                resizeBy(event.shiftKey ? -32 : -8);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                resizeBy(event.shiftKey ? 32 : 8);
              } else if (event.key === "Home") {
                event.preventDefault();
                setNavigationWidth(MIN_NAVIGATION_WIDTH);
              } else if (event.key === "End") {
                event.preventDefault();
                setNavigationWidth(MAX_NAVIGATION_WIDTH);
              }
            }}
            className="group hidden lg:flex w-1 shrink-0 cursor-col-resize touch-none items-center justify-center -ml-1 z-10 focus:outline-none"
          >
            <span className="h-10 w-px rounded-full bg-transparent group-hover:bg-accent group-focus:bg-accent transition-colors" />
          </div>
        )}

        <section className="flex min-w-0 min-h-0 flex-1 flex-col" aria-label={`${title} workspace`}>
          <div className="lg:hidden h-11 shrink-0 flex items-center gap-2 px-2 border-b border-primary bg-secondary">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 items-center gap-2 px-3 rounded-lg text-xs font-medium text-primary hover:bg-hover focus-ring"
              aria-expanded={mobileOpen}
            >
              <Menu className="w-4 h-4" />
              <span>Browse</span>
            </button>
            <span className="min-w-0 truncate text-xs text-muted">{title}</span>
          </div>
          {!desktopOpen && (
            <button
              type="button"
              onClick={() => setDesktopNavigationOpen(true)}
              className="hidden lg:grid absolute left-2 top-2 z-20 w-8 h-8 place-items-center rounded-lg border border-primary bg-secondary text-muted hover:text-primary hover:bg-hover focus-ring"
              aria-label={`Show ${navigationLabel}`}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
        </section>
      </div>
    </WorkspaceNavigationProvider>
  );
}
