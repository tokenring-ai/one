import { Grid2X2, Home, Settings } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { CORE_APPS } from "../../apps/manifests.ts";
import { PLUGIN_LAYOUT_APPS } from "../../plugins/layoutManifests.ts";
import { getActiveDashboardManifest, getDashboardManifestById } from "../../shell/appCatalog.ts";
import { USER_APP_BASE_PATH, useUserApps } from "../../shell/userApps.ts";
import { useAppShell } from "./AppShellContext.tsx";
import DashboardSwitcher from "./DashboardSwitcher.tsx";

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

/** Global navigation between dashboards. Navigation within a dashboard belongs to its own views. */
export default function DashboardRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pinnedDashboardIds, recentDashboards: recentEntries, recordRecentDashboard, toggleSwitcher, isSwitcherOpen, setSwitcherOpen } = useAppShell();
  const activeDashboard = getActiveDashboardManifest(location.pathname);
  const { apps: userApps } = useUserApps();

  const pinned = useMemo(
    () => pinnedDashboardIds.map(getDashboardManifestById).filter(dashboard => dashboard && dashboard.id !== "settings"),
    [pinnedDashboardIds],
  );
  const recent = useMemo(() => {
    return recentEntries
      .filter(entry => !pinnedDashboardIds.includes(entry.id))
      .map(entry => entry.id)
      .map(getDashboardManifestById)
      .filter(dashboard => dashboard && dashboard.id !== "settings");
  }, [pinnedDashboardIds, recentEntries]);

  const open = (path: string, dashboardId?: string) => {
    if (dashboardId) recordRecentDashboard(dashboardId);
    void navigate(path);
  };

  useEffect(() => {
    if (activeDashboard && activeDashboard.id !== "settings" && !activeDashboard.hidden) recordRecentDashboard(activeDashboard.id);
  }, [activeDashboard, recordRecentDashboard]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSwitcherOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setSwitcherOpen]);

  return (
    <>
      <aside className="hidden lg:flex w-14 shrink-0 flex-col items-center border-r border-primary bg-sidebar py-2 z-30">
        <nav className="flex min-h-0 w-full flex-1 flex-col items-center" aria-label="Dashboards">
          <RailIconButton label="Home" onClick={() => open("/")} current={activeDashboard?.id === "home"} highlighted={activeDashboard?.id === "home"}>
            <Home className="w-[18px] h-[18px]" aria-hidden="true" />
          </RailIconButton>
          <div className="my-2 h-px w-7 shrink-0 bg-primary" />
          <div className="flex min-h-0 w-full flex-col items-center overflow-y-auto overflow-x-hidden custom-scrollbar px-1">
            <div className="flex w-full flex-col items-center gap-1" role="group" aria-label="Pinned dashboards">
              {pinned.map(dashboard => {
                if (!dashboard) return null;
                const Icon = dashboard.icon;
                const isActive = activeDashboard?.id === dashboard.id;
                return (
                  <RailIconButton
                    key={dashboard.id}
                    label={dashboard.label}
                    onClick={() => open(dashboard.path, dashboard.id)}
                    current={isActive}
                    highlighted={isActive}
                  >
                    <Icon className={`w-[18px] h-[18px] ${isActive ? dashboard.iconClass : ""}`} aria-hidden="true" />
                  </RailIconButton>
                );
              })}
            </div>
            {userApps.length > 0 && (
              <>
                <div className="my-2 h-px w-7 shrink-0 bg-primary" aria-hidden="true" />
                <div className="flex w-full flex-col items-center gap-1" role="group" aria-label="My apps">
                  {userApps.map(app => {
                    const Icon = [...CORE_APPS, ...PLUGIN_LAYOUT_APPS].find(base => base.id === app.meta.basedOn)?.icon ?? Grid2X2;
                    const path = `${USER_APP_BASE_PATH}/${app.slug}`;
                    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);
                    return (
                      <RailIconButton
                        key={app.id}
                        label={app.meta.label}
                        tooltip={`${app.meta.label} · My app`}
                        onClick={() => open(path)}
                        current={isActive}
                        highlighted={isActive}
                      >
                        <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
                      </RailIconButton>
                    );
                  })}
                </div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <div className="my-2 h-px w-7 shrink-0 bg-primary" aria-hidden="true" />
                <div className="flex w-full flex-col items-center gap-1" role="group" aria-label="Recently used dashboards">
                  {recent.map(dashboard => {
                    if (!dashboard) return null;
                    const Icon = dashboard.icon;
                    const isActive = activeDashboard?.id === dashboard.id;
                    return (
                      <RailIconButton
                        key={dashboard.id}
                        label={dashboard.label}
                        tooltip={`${dashboard.label} · Recent`}
                        onClick={() => open(dashboard.path, dashboard.id)}
                        current={isActive}
                        highlighted={isActive}
                      >
                        <Icon className={`w-[18px] h-[18px] ${isActive ? dashboard.iconClass : ""}`} aria-hidden="true" />
                      </RailIconButton>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <RailIconButton
            label="More apps"
            tooltip="More apps (see everything)"
            onClick={toggleSwitcher}
            highlighted={isSwitcherOpen}
            expanded={isSwitcherOpen}
            className="mt-1"
          >
            <Grid2X2 className="w-[18px] h-[18px]" aria-hidden="true" />
          </RailIconButton>
        </nav>
        <div className="my-2 h-px w-7 shrink-0 bg-primary" />
        <RailIconButton
          label="Settings"
          onClick={() => open("/settings")}
          current={activeDashboard?.id === "settings"}
          highlighted={activeDashboard?.id === "settings"}
        >
          <Settings className="w-[18px] h-[18px]" aria-hidden="true" />
        </RailIconButton>
      </aside>
      <DashboardSwitcher />
    </>
  );
}
