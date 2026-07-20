import formatError from "@tokenring-ai/utility/error/formatError";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Cpu,
  DollarSign,
  FileText,
  FolderOpen,
  GitBranch,
  Image,
  ListOrdered,
  Lock,
  Mail,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  PenTool,
  Plug,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Timer,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { agentRPCClient, type useAgentList, type useAgentTypes, type useWorkflows, workflowRPCClient } from "../rpc";
import ConfirmDialog from "./overlay/confirm-dialog.tsx";
import { useSidebar } from "./SidebarContext";
import ErrorState from "./ui/ErrorState.tsx";
import LoadingState from "./ui/LoadingState.tsx";
import { toastManager } from "./ui/toast";

interface SidebarProps {
  currentAgentId: string;
  agents: ReturnType<typeof useAgentList>;
  workflows: ReturnType<typeof useWorkflows>;
  agentTypes: ReturnType<typeof useAgentTypes>;
}

interface AppNavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}

const APP_NAV_ITEMS: AppNavItem[] = [
  { path: "/agents", icon: <Cpu className="w-4 h-4" />, label: "Agents", color: "text-amber-500" },
  { path: "/workflows", icon: <GitBranch className="w-4 h-4" />, label: "Workflows", color: "text-cyan-500" },
  { path: "/scheduler", icon: <Timer className="w-4 h-4" />, label: "Scheduler", color: "text-indigo-400" },
  { path: "/queue", icon: <ListOrdered className="w-4 h-4" />, label: "Queue", color: "text-sky-400" },
  { path: "/skills", icon: <Sparkles className="w-4 h-4" />, label: "Skills", color: "text-violet-400" },
  { path: "/canvas", icon: <PenTool className="w-4 h-4" />, label: "Canvas", color: "text-purple-400" },
  { path: "/documents", icon: <FileText className="w-4 h-4" />, label: "Documents", color: "text-lime-400" },
  { path: "/research", icon: <Search className="w-4 h-4" />, label: "Research", color: "text-indigo-400" },
  { path: "/blog", icon: <BookOpen className="w-4 h-4" />, label: "Blog", color: "text-rose-400" },
  { path: "/files", icon: <FolderOpen className="w-4 h-4" />, label: "Files", color: "text-accent-soft" },
  { path: "/terminal", icon: <Terminal className="w-4 h-4" />, label: "Terminal", color: "text-gray-400" },
  { path: "/email", icon: <Mail className="w-4 h-4" />, label: "Email", color: "text-red-400" },
  { path: "/calendar", icon: <CalendarDays className="w-4 h-4" />, label: "Calendar", color: "text-sky-400" },
  { path: "/media", icon: <Image className="w-4 h-4" />, label: "Media", color: "text-pink-400" },
  { path: "/social", icon: <Share2 className="w-4 h-4" />, label: "Social", color: "text-blue-400" },
  { path: "/stocks", icon: <TrendingUp className="w-4 h-4" />, label: "Stocks", color: "text-emerald-400" },
  { path: "/messaging", icon: <MessageSquare className="w-4 h-4" />, label: "Messaging", color: "text-teal-400" },
  { path: "/plugins", icon: <Package className="w-4 h-4" />, label: "Plugins", color: "text-fuchsia-400" },
  { path: "/configuration", icon: <SlidersHorizontal className="w-4 h-4" />, label: "Configuration", color: "text-amber-400" },
  { path: "/services", icon: <Plug className="w-4 h-4" />, label: "Services", color: "text-violet-400" },
  { path: "/metrics", icon: <DollarSign className="w-4 h-4" />, label: "Metrics", color: "text-emerald-400" },
  { path: "/settings", icon: <Settings className="w-4 h-4" />, label: "Settings", color: "text-stone-400" },
  { path: "/vault", icon: <Lock className="w-4 h-4" />, label: "Vault", color: "text-amber-400" },
];

export default function Sidebar({ currentAgentId, agents, workflows, agentTypes }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarExpanded, toggleSidebar, isMobileOpen, setMobileOpen, localStorageAvailable } = useSidebar();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [storageBannerDismissed, setStorageBannerDismissed] = useState(false);

  const navigateAndClose = (path: string) => {
    void navigate(path);
    setMobileOpen(false);
  };

  // Determine active app from current pathname
  const activeApp =
    APP_NAV_ITEMS.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + "/"))?.path ??
    (location.pathname.startsWith("/agent/") ? "/agents" : null);

  const createAgent = async (type: string) => {
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: type, headless: false });
      await agents.mutate();
      navigateAndClose(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const spawnWorkflow = async (name: string) => {
    try {
      const { id } = await workflowRPCClient.spawnWorkflow({ name, headless: false });
      await agents.mutate();
      navigateAndClose(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const agentId = confirmDelete;
    setConfirmDelete(null);
    await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from sidebar in Chat Web UI" });
    await agents.mutate();
    if (currentAgentId === agentId) navigateAndClose("/agents");
  };

  const handleDeleteClick = async (agentId: string, isIdle: boolean) => {
    if (isIdle) {
      await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from sidebar in Chat Web UI" });
      await agents.mutate();
      if (currentAgentId === agentId) navigateAndClose("/agents");
    } else {
      setConfirmDelete(agentId);
    }
  };

  const groupedTemplates = (agentTypes.data || []).reduce(
    (acc, t) => {
      const cat = t.category || "Uncategorized";
      (acc[cat] ??= []).push(t);
      return acc;
    },
    {} as Record<string, typeof agentTypes.data & {}>,
  );

  // Context panel: what to show below the nav based on active app
  const showAgentPanel = activeApp === "/agents" || location.pathname.startsWith("/agent/");
  const showWorkflowPanel = activeApp === "/workflows";

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        aria-label="Navigation sidebar"
        className={`fixed md:relative border-r border-primary bg-sidebar flex flex-col shrink-0 overflow-hidden h-[calc(100vh-3rem)] md:h-full transition-all duration-300 ease-in-out md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} ${isSidebarExpanded ? "w-72" : "w-12"} top-12 left-0 md:top-auto md:left-auto z-40`}
      >
        {!localStorageAvailable && !storageBannerDismissed && isSidebarExpanded && (
          <div role="alert" aria-live="polite" className="shrink-0 border-b border-warning/30 bg-warning/10 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="flex-1 text-2xs text-primary leading-snug">Sidebar preferences will not be saved because browser storage is unavailable.</p>
            <button
              type="button"
              onClick={() => setStorageBannerDismissed(true)}
              className="shrink-0 p-1 rounded-md hover:bg-warning/20 transition-colors focus-ring"
              aria-label="Dismiss storage warning"
            >
              <X className="w-3.5 h-3.5 text-primary" />
            </button>
          </div>
        )}

        {/* App nav rail + collapse toggle */}
        <div className={`flex shrink-0 border-b border-primary ${isSidebarExpanded ? "items-center" : "flex-col items-center py-2 gap-0.5"}`}>
          {isSidebarExpanded ? (
            /* Expanded: horizontal nav items */
            <div className="flex-1 flex items-center overflow-x-auto px-1 gap-0.5 scrollbar-none">
              {APP_NAV_ITEMS.slice(0, 6).map(item => {
                const isActive = activeApp === item.path;
                return (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => navigateAndClose(item.path)}
                    className={`flex items-center gap-1 px-2 py-2 text-xs font-medium transition-colors border-b-2 -mb-px shrink-0 focus-ring cursor-pointer rounded-t-md ${
                      isActive ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary"
                    }`}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className={isActive ? item.color : ""}>{item.icon}</span>
                  </button>
                );
              })}
              <div className="flex-1" />
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 mr-1 text-muted hover:text-primary transition-colors focus-ring hidden md:block cursor-pointer rounded-md active:scale-[0.98]"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 mr-1 text-muted hover:text-primary md:hidden focus-ring cursor-pointer rounded-md active:scale-[0.98]"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Collapsed: vertical icon rail */
            <>
              {APP_NAV_ITEMS.map(item => {
                const isActive = activeApp === item.path;
                return (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => {
                      navigateAndClose(item.path);
                    }}
                    className={`p-1.5 rounded-md transition-colors focus-ring cursor-pointer active:scale-[0.98] ${isActive ? `${item.color} bg-active` : "text-muted hover:text-primary hover:bg-hover"}`}
                    aria-label={item.label}
                    title={item.label}
                    tabIndex={0}
                  >
                    {item.icon}
                  </button>
                );
              })}
              <div className="w-8 h-px bg-primary my-1" />
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 text-muted hover:text-primary transition-colors focus-ring cursor-pointer rounded-md active:scale-[0.98]"
                aria-label="Expand sidebar"
                tabIndex={0}
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Context panel (only shown when expanded) */}
        {isSidebarExpanded && (
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 md:py-4">
            {/* Agents panel: shown on /agents or /agent/:id */}
            {showAgentPanel && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <span className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest">Active Agents</span>
                    <span className="text-2xs text-muted" aria-live="polite">
                      {agents.data?.length ?? 0} running
                    </span>
                  </div>
                  {agents.isLoading ? (
                    <LoadingState size="sm" className="py-8" />
                  ) : agents.error ? (
                    <ErrorState title="Failed to load agents" error={agents.error} onRetry={() => void agents.mutate()} variant="inline" />
                  ) : (agents.data?.length ?? 0) === 0 ? (
                    <div className="px-3 py-4 text-center text-muted text-2xs italic">No active agents</div>
                  ) : (
                    agents.data!.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => navigateAndClose(`/agent/${agent.id}`)}
                        onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigateAndClose(`/agent/${agent.id}`);
                          }
                        }}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-md transition-all cursor-pointer focus-ring ${currentAgentId === agent.id ? "bg-active border border-primary" : "hover:bg-hover border border-transparent"}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open agent ${agent.displayName}`}
                        aria-current={currentAgentId === agent.id ? "page" : undefined}
                      >
                        <div className="shrink-0" aria-hidden="true">
                          {agent.idle ? (
                            <Pause className="w-3.5 h-3.5 text-muted" />
                          ) : (
                            <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${currentAgentId === agent.id ? "text-primary" : "text-secondary"}`}>
                            {agent.displayName}
                          </div>
                          <div className="text-2xs text-muted mt-0.5 truncate">{agent.currentActivity}</div>
                        </div>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            void handleDeleteClick(agent.id, agent.idle);
                          }}
                          className="p-1.5 text-muted hover:text-red-500 transition-colors opacity-40 hover:opacity-100 group-focus-within:opacity-100 focus-ring cursor-pointer rounded-md active:scale-[0.98]"
                          aria-label={`Delete agent ${agent.displayName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Launch Agent */}
                <div className="space-y-3">
                  <span className="text-2xs font-bold text-accent/90 uppercase tracking-widest px-2 block">Launch Agent</span>
                  {agentTypes.isLoading ? (
                    <LoadingState size="sm" className="py-4" />
                  ) : agentTypes.error ? (
                    <ErrorState title="Failed to load agent types" error={agentTypes.error} onRetry={() => void agentTypes.mutate()} variant="inline" />
                  ) : (
                    Object.entries(groupedTemplates).map(([category, templates]) => (
                      <div key={category}>
                        <h3 className="text-2xs font-semibold text-muted uppercase tracking-wider mb-1 px-2">{category}</h3>
                        <div className="space-y-1">
                          {templates.map(template => (
                            <button
                              type="button"
                              key={template.type}
                              onClick={() => createAgent(template.type)}
                              className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-hover transition-all text-left group w-full focus-ring cursor-pointer active:scale-[0.98]"
                              aria-label={`Create new agent: ${template.displayName}`}
                            >
                              <User className="w-3.5 h-3.5 text-accent/70 group-hover:text-accent shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-secondary group-hover:text-primary truncate">{template.displayName}</div>
                                <div className="text-2xs text-muted line-clamp-1 mt-0.5">{template.description}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Workflows panel */}
            {showWorkflowPanel && (
              <div className="space-y-1">
                <span className="text-2xs font-bold text-cyan-600 dark:text-cyan-500/90 uppercase tracking-widest px-2 block mb-2">Workflows</span>
                {workflows.isLoading ? (
                  <LoadingState size="sm" className="py-8" />
                ) : workflows.error ? (
                  <ErrorState title="Failed to load workflows" error={workflows.error} onRetry={() => void workflows.mutate()} variant="inline" />
                ) : (workflows.data?.length ?? 0) === 0 ? (
                  <div className="px-3 py-4 text-center text-muted text-2xs italic">No workflows available</div>
                ) : (
                  workflows.data!.map(workflow => (
                    <button
                      type="button"
                      key={workflow.name}
                      onClick={() => spawnWorkflow(workflow.name)}
                      className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-hover transition-all text-left group w-full focus-ring cursor-pointer active:scale-[0.98]"
                      aria-label={`Spawn workflow: ${workflow.displayName}`}
                    >
                      <GitBranch className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5 opacity-70 group-hover:opacity-100" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-secondary group-hover:text-primary truncate">{workflow.displayName}</div>
                        <div className="text-2xs text-muted line-clamp-1 mt-0.5">{workflow.description}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Other apps: show expanded nav list for secondary navigation */}
            {!showAgentPanel && !showWorkflowPanel && (
              <div className="space-y-0.5">
                <span className="text-2xs font-bold text-muted uppercase tracking-widest px-2 block mb-2">Apps</span>
                {APP_NAV_ITEMS.map(item => {
                  const isActive = activeApp === item.path;
                  return (
                    <button
                      type="button"
                      key={item.path}
                      onClick={() => navigateAndClose(item.path)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all w-full text-left focus-ring cursor-pointer active:scale-[0.98] ${
                        isActive ? "bg-active border border-primary" : "hover:bg-hover border border-transparent"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={isActive ? item.color : "text-muted"}>{item.icon}</span>
                      <span className={`text-sm font-medium ${isActive ? "text-primary" : "text-secondary"}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </aside>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Running Agent"
          message="This agent is currently running. Are you sure you want to delete it? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
          variant="danger"
        />
      )}
    </>
  );
}
