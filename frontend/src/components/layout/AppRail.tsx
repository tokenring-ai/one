import { Grid2X2, Home, Settings } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { getActiveApp, getAppById } from "./AppRegistry.ts";
import { useAppShell } from "./AppShellContext.tsx";
import AppSwitcher from "./AppSwitcher.tsx";

const railButtonClass =
  "group relative w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-muted hover:text-primary hover:bg-hover transition-colors focus-ring";

interface RailIconButtonProps {
  label: string;
  tooltip?: string;
  current?: boolean;
  highlighted?: boolean;
  expanded?: boolean;
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}

function RailIconButton({ label, tooltip = label, current = false, highlighted = false, expanded, className = "", onClick, children }: RailIconButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  const showTooltip = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPosition({
      left: rect.right + 8,
      top: Math.max(16, Math.min(window.innerHeight - 16, rect.top + rect.height / 2)),
    });
  };

  useEffect(() => {
    if (!tooltipPosition) return;
    const hideTooltip = () => setTooltipPosition(null);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    return () => {
      window.removeEventListener("resize", hideTooltip);
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, [tooltipPosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setTooltipPosition(null);
          onClick();
        }}
        onPointerEnter={showTooltip}
        onPointerLeave={() => setTooltipPosition(null)}
        onFocus={showTooltip}
        onBlur={() => setTooltipPosition(null)}
        className={`${railButtonClass} ${highlighted ? "bg-active text-primary" : ""} ${className}`}
        aria-label={label}
        aria-current={current ? "page" : undefined}
        aria-expanded={expanded}
      >
        {current && <span className="absolute -left-2 w-0.5 h-5 rounded-r bg-accent" aria-hidden="true" />}
        {children}
      </button>
      {tooltipPosition &&
        createPortal(
          <span
            className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg border border-primary bg-tertiary px-2 py-1.5 text-xs font-medium text-primary shadow-lg"
            style={tooltipPosition}
          >
            {tooltip}
          </span>,
          document.body,
        )}
    </>
  );
}

/** Global application navigation. App-owned navigation belongs inside each workspace. */
export default function AppRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pinnedAppIds, recentApps: recentAppEntries, recordRecentApp, toggleAppSwitcher, isAppSwitcherOpen, setAppSwitcherOpen } = useAppShell();
  const activeApp = getActiveApp(location.pathname);

  const pinnedApps = useMemo(() => pinnedAppIds.map(getAppById).filter(app => app && app.id !== "settings"), [pinnedAppIds]);
  const recentApps = useMemo(() => {
    return recentAppEntries
      .filter(entry => !pinnedAppIds.includes(entry.id))
      .map(entry => entry.id)
      .map(getAppById)
      .filter(app => app && app.id !== "settings");
  }, [pinnedAppIds, recentAppEntries]);

  const open = (path: string, appId?: string) => {
    if (appId) recordRecentApp(appId);
    void navigate(path);
  };

  useEffect(() => {
    if (activeApp && activeApp.id !== "settings") recordRecentApp(activeApp.id);
  }, [activeApp, recordRecentApp]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAppSwitcherOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setAppSwitcherOpen]);

  return (
    <>
      <aside aria-label="Applications" className="hidden lg:flex w-14 shrink-0 flex-col items-center border-r border-primary bg-sidebar py-2 z-30">
        <nav className="flex min-h-0 w-full flex-1 flex-col items-center" aria-label="Applications">
          <RailIconButton label="Home" onClick={() => open("/")} current={location.pathname === "/"} highlighted={location.pathname === "/"}>
            <Home className="w-[18px] h-[18px]" aria-hidden="true" />
          </RailIconButton>
          <div className="my-2 h-px w-7 shrink-0 bg-primary" />
          <div className="flex min-h-0 w-full flex-col items-center overflow-y-auto overflow-x-hidden custom-scrollbar px-1">
            <div className="flex w-full flex-col items-center gap-1" role="group" aria-label="Pinned apps">
              {pinnedApps.map(app => {
                if (!app) return null;
                const Icon = app.icon;
                const isActive = activeApp?.id === app.id;
                return (
                  <RailIconButton key={app.id} label={app.label} onClick={() => open(app.path, app.id)} current={isActive} highlighted={isActive}>
                    <Icon className={`w-[18px] h-[18px] ${isActive ? app.iconClass : ""}`} aria-hidden="true" />
                  </RailIconButton>
                );
              })}
            </div>
            {recentApps.length > 0 && (
              <>
                <div className="my-2 h-px w-7 shrink-0 bg-primary" aria-hidden="true" />
                <div className="flex w-full flex-col items-center gap-1" role="group" aria-label="Recently used apps">
                  {recentApps.map(app => {
                    if (!app) return null;
                    const Icon = app.icon;
                    const isActive = activeApp?.id === app.id;
                    return (
                      <RailIconButton
                        key={app.id}
                        label={app.label}
                        tooltip={`${app.label} · Recent`}
                        onClick={() => open(app.path, app.id)}
                        current={isActive}
                        highlighted={isActive}
                      >
                        <Icon className={`w-[18px] h-[18px] ${isActive ? app.iconClass : ""}`} aria-hidden="true" />
                      </RailIconButton>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <RailIconButton label="All apps" onClick={toggleAppSwitcher} highlighted={isAppSwitcherOpen} expanded={isAppSwitcherOpen} className="mt-1">
            <Grid2X2 className="w-[18px] h-[18px]" aria-hidden="true" />
          </RailIconButton>
        </nav>
        <div className="my-2 h-px w-7 shrink-0 bg-primary" />
        <RailIconButton label="Settings" onClick={() => open("/settings")} current={activeApp?.id === "settings"} highlighted={activeApp?.id === "settings"}>
          <Settings className="w-[18px] h-[18px]" aria-hidden="true" />
        </RailIconButton>
      </aside>
      <AppSwitcher />
    </>
  );
}
