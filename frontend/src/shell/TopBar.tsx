import { ChevronRight, Grid2X2, LogOut, Settings, WifiOff } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatSettingsDropdown from "../components/ChatSettingsDropdown.tsx";
import { useAppShell } from "../components/layout/AppShellContext.tsx";
import { LightDarkSelector } from "../components/ui/light-dark-selector.tsx";
import NotificationMenu from "../components/ui/notification-menu.tsx";
import SignInOnPhoneButton from "../components/users/SignInOnPhoneButton.tsx";
import { useConnectionStatus } from "../hooks/useConnectionStatus.ts";
import { cn } from "../lib/utils.ts";
import { getSignedInUsername, signOut, subscribeSignedInUsername } from "../rpcAuth.ts";
import { getActiveDashboardManifest } from "../shell/appCatalog.ts";
import Logo from "../tokenring-logo-small.webp";
import AgentActivity from "./AgentActivity.tsx";
import { useLayoutRegistry } from "./registry.ts";
import { useActiveTitle } from "./shellStatus.ts";

/** "App › focused resource", derived from the URL. */
function Breadcrumb() {
  const { pathname } = useLocation();
  const registry = useLayoutRegistry();
  const route = registry.routes.resolve(pathname);
  const layoutApp = route ? registry.app(route.app) : undefined;
  const title = useActiveTitle();
  const label = layoutApp?.label ?? getActiveDashboardManifest(pathname)?.label ?? null;
  if (!label) return null;
  return (
    <nav aria-label="Location" className="flex min-w-0 items-center gap-1.5 text-sm">
      <span className="shrink-0 font-semibold text-fg">{label}</span>
      {/* Phones get the view's name from the tab strip; here it would truncate to a bare chevron. */}
      {layoutApp && title && (
        <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden="true" />
          <span className="min-w-0 truncate text-fg-secondary" title={title}>
            {title}
          </span>
        </span>
      )}
    </nav>
  );
}

export default function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isOnline } = useConnectionStatus();
  const { toggleSwitcher, isSwitcherOpen } = useAppShell();
  const signedInUsername = useSyncExternalStore(subscribeSignedInUsername, getSignedInUsername, getSignedInUsername);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const iconButton = "grid h-8 w-8 place-items-center rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer";

  return (
    <header className="z-50 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-raised px-2 sm:gap-3">
      <button type="button" onClick={() => void navigate("/")} className="flex shrink-0 items-center gap-2 rounded-md focus-ring" aria-label="TokenRing Home">
        <img src={Logo} alt="" className="h-8 w-auto" />
        <span className="hidden text-sm font-semibold tracking-tight text-fg lg:block">TokenRing One</span>
      </button>

      {/* The app catalog is a full-height sheet on small screens, where there is no rail. */}
      <button
        type="button"
        onClick={toggleSwitcher}
        className={cn(iconButton, "lg:hidden", isSwitcherOpen ? "bg-active text-fg" : "text-muted")}
        aria-label="Open app switcher"
        aria-expanded={isSwitcherOpen}
      >
        <Grid2X2 className="h-4.5 w-4.5" aria-hidden="true" />
      </button>

      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
      <Breadcrumb />
      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {!isOnline && (
          <div className="mr-2 flex items-center gap-1.5 text-xs text-[var(--status-danger-fg)]">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:block">Offline</span>
          </div>
        )}
        <AgentActivity />
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <LightDarkSelector />
        <ChatSettingsDropdown />
        <button
          type="button"
          onClick={() => void navigate("/settings")}
          className={cn(iconButton, pathname === "/settings" ? "text-fg" : "text-muted")}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
        <NotificationMenu />
        {signedInUsername !== null && <SignInOnPhoneButton className={cn(iconButton, "text-muted")} />}
        {signedInUsername !== null && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className={cn(iconButton, "text-muted disabled:opacity-60")}
            aria-label="Sign out"
            title={`Sign out ${signedInUsername}`}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
