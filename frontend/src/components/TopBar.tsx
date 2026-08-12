import { ChevronDown, Grid2X2, Loader2, Pause, Settings, WifiOff } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import { useConnectionStatus } from "../hooks/useConnectionStatus.ts";
import type { useAgentList } from "../rpc.ts";
import Logo from "../tokenring-logo-small.webp";
import { getActiveApp } from "./layout/AppRegistry.ts";
import { useAppShell } from "./layout/AppShellContext.tsx";
import { LightDarkSelector } from "./ui/light-dark-selector.tsx";
import NotificationMenu from "./ui/notification-menu.tsx";

interface TopBarProps {
  currentAgentId: string | null;
  agents: ReturnType<typeof useAgentList>;
  agentControls?: React.ReactNode;
}

export default function TopBar({ currentAgentId, agents, agentControls }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isOnline } = useConnectionStatus();
  const { toggleAppSwitcher, isAppSwitcherOpen } = useAppShell();
  const activeApp = getActiveApp(location.pathname);

  const agentList = agents.data || [];
  const currentAgent = agentList.find(a => a.id === currentAgentId);

  useClickOutside(ref, () => setOpen(false), { enabled: open });

  return (
    <header className="h-14 border-b border-primary bg-secondary flex items-center px-2 gap-2 sm:gap-3 shrink-0 z-50">
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 focus-ring rounded-md shrink-0 cursor-pointer"
        aria-label="TokenRing Home"
      >
        <div className="w-9 h-9 flex items-center justify-center">
          <img src={Logo} className="w-auto h-9 text-white" aria-label="TokenRing Logo" />
        </div>
        <span className="pl-2 text-primary font-bold tracking-tight text-md hidden lg:block">TokenRing One</span>
      </button>

      {/* App catalog moves into a full-height sheet on mobile. */}
      <button
        type="button"
        onClick={toggleAppSwitcher}
        className={`lg:hidden grid h-11 w-11 place-items-center rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer ${isAppSwitcherOpen ? "text-primary bg-active" : "text-muted"}`}
        aria-label="Open app switcher"
        aria-expanded={isAppSwitcherOpen}
      >
        <Grid2X2 className="w-5 h-5" />
      </button>

      {activeApp && <span className="lg:hidden min-w-0 truncate text-xs font-semibold text-primary">{activeApp.label}</span>}

      <div className="w-px h-5 bg-primary shrink-0" />

      {/* Agent Dropdown */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover transition-colors focus-ring text-sm cursor-pointer"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {currentAgent ? (
            <>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentAgent.idle ? "bg-accent" : "bg-amber-500"}`} />
              <span className="hidden sm:block text-primary font-medium max-w-48 truncate" title={currentAgent.displayName}>
                {currentAgent.displayName}
              </span>
            </>
          ) : (
            <span className="hidden sm:block text-muted">Select agent</span>
          )}
          <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-muted shrink-0" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-secondary border border-primary rounded-card shadow-card z-50 overflow-hidden" role="listbox">
            {agents.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-muted animate-spin" />
              </div>
            ) : agentList.length === 0 ? (
              <>
                <div className="px-4 py-3 text-xs text-muted text-center">No active agents</div>
                <div className="border-t border-primary">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate("/agents");
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs flex items-center gap-2 text-primary hover:bg-hover transition-colors text-left cursor-pointer focus-ring rounded-md"
                    aria-label="Create new agent or workflow"
                  >
                    <span className="text-cyan-400 font-semibold">+</span>
                    <span>Create New Agent</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {agentList.map(agent => (
                  <button
                    type="button"
                    key={agent.id}
                    role="option"
                    aria-selected={agent.id === currentAgentId}
                    onClick={() => {
                      void navigate(`/agent/${agent.id}`);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover transition-colors cursor-pointer focus-ring rounded-md ${agent.id === currentAgentId ? "bg-active" : ""}`}
                  >
                    <div className="shrink-0">
                      {agent.idle ? (
                        <Pause className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                      <div className="text-xs text-muted truncate">{agent.currentActivity}</div>
                    </div>
                  </button>
                ))}
                <div className="border-t border-primary">
                  <button
                    type="button"
                    onClick={() => {
                      void navigate("/agents");
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs flex items-center gap-2 text-primary hover:bg-hover transition-colors text-left cursor-pointer focus-ring rounded-md"
                    aria-label="Create new agent or workflow"
                  >
                    <span className="text-cyan-400 font-semibold">+</span>
                    <span>Create New Agent</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Agent-specific controls (model selector, tool selector) */}
      {agentControls && (
        <>
          <div className="w-px h-5 bg-primary shrink-0 hidden md:block" />
          <div className="hidden md:flex items-center gap-1">{agentControls}</div>
        </>
      )}

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-1">
        {!isOnline && (
          <div className="flex items-center gap-1.5 text-red-400 text-xs mr-2">
            <WifiOff className="w-4 h-4" />
            <span className="hidden sm:block">Offline</span>
          </div>
        )}
        <LightDarkSelector />
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className={`hidden md:grid p-2 rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer ${location.pathname === "/settings" ? "text-primary" : "text-muted"}`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <NotificationMenu />
      </div>
    </header>
  );
}
