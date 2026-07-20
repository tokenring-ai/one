import { ChevronDown, Loader2, Menu, Pause, Settings, WifiOff, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConnectionStatus } from "../hooks/useConnectionStatus.ts";
import type { useAgentList } from "../rpc.ts";
import { useSidebar } from "./SidebarContext.tsx";
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
  const { toggleMobileSidebar } = useSidebar();

  const agentList = agents.data || [];
  const currentAgent = agentList.find(a => a.id === currentAgentId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-12 border-b border-primary bg-secondary flex items-center px-4 gap-3 shrink-0 z-50">
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate("/")}
        className="flex items-center gap-2 focus-ring rounded-md shrink-0 cursor-pointer"
        aria-label="TokenRing Home"
      >
        <div className="w-7 h-7 rounded-md bg-linear-to-br from-cyan-500 to-accent-hover flex items-center justify-center shadow-accent">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="text-primary font-bold tracking-tight text-sm hidden md:block">TokenRing</span>
      </button>

      {/* Mobile Menu Button - Hidden on desktop */}
      <button
        type="button"
        onClick={toggleMobileSidebar}
        className="md:hidden p-2 rounded-md hover:bg-hover transition-colors text-muted focus-ring cursor-pointer"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

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
              <span className="text-primary font-medium max-w-48 truncate" title={currentAgent.displayName}>
                {currentAgent.displayName}
              </span>
            </>
          ) : (
            <span className="text-muted">Select agent</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
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
                      <div className="text-2xs text-muted truncate">{agent.currentActivity}</div>
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
          className={`p-2 rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer ${location.pathname === "/settings" ? "text-primary" : "text-muted"}`}
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
