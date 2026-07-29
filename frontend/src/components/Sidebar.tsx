import {
  AlertTriangle,
  BookOpen,
  Bot,
  CalendarDays,
  Cpu,
  Database,
  DollarSign,
  FileText,
  FolderOpen,
  Frame,
  GitBranch,
  Image,
  ListOrdered,
  Lock,
  Mail,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "./SidebarContext";

interface AppNavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}

const APP_NAV_ITEMS: AppNavItem[] = [
  { path: "/agents", icon: <Cpu className="w-4 h-4" />, label: "Agents", color: "text-amber-500" },
  { path: "/workflows", icon: <GitBranch className="w-4 h-4" />, label: "Workflows", color: "text-cyan-500" },
  { path: "/bots", icon: <Bot className="w-4 h-4" />, label: "Bots", color: "text-teal-400" },
  { path: "/scheduler", icon: <Timer className="w-4 h-4" />, label: "Scheduler", color: "text-indigo-400" },
  { path: "/queue", icon: <ListOrdered className="w-4 h-4" />, label: "Queue", color: "text-sky-400" },
  { path: "/skills", icon: <Sparkles className="w-4 h-4" />, label: "Skills", color: "text-violet-400" },
  { path: "/web-design", icon: <Frame className="w-4 h-4" />, label: "Web Design", color: "text-purple-400" },
  { path: "/documents", icon: <FileText className="w-4 h-4" />, label: "Documents", color: "text-lime-400" },
  { path: "/research", icon: <Search className="w-4 h-4" />, label: "Research", color: "text-indigo-400" },
  { path: "/blog", icon: <BookOpen className="w-4 h-4" />, label: "Blog", color: "text-rose-400" },
  { path: "/files", icon: <FolderOpen className="w-4 h-4" />, label: "Files", color: "text-accent-soft" },
  { path: "/terminal", icon: <Terminal className="w-4 h-4" />, label: "Terminal", color: "text-gray-400" },
  { path: "/email", icon: <Mail className="w-4 h-4" />, label: "Email", color: "text-red-400" },
  { path: "/database", icon: <Database className="w-4 h-4" />, label: "Database", color: "text-cyan-400" },
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

/** App navigation only — each app owns whatever contextual list or detail view it needs. */
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSidebarExpanded, toggleSidebar, isMobileOpen, setMobileOpen, localStorageAvailable } = useSidebar();
  const [storageBannerDismissed, setStorageBannerDismissed] = useState(false);

  const navigateAndClose = (path: string) => {
    void navigate(path);
    setMobileOpen(false);
  };

  // Determine active app from current pathname; a chat page counts as the Agents app.
  const activeApp =
    APP_NAV_ITEMS.find(item => location.pathname === item.path || location.pathname.startsWith(item.path + "/"))?.path ??
    (location.pathname.startsWith("/agent/") ? "/agents" : null);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        aria-label="Navigation sidebar"
        className={`fixed md:relative border-r border-primary bg-sidebar flex flex-col shrink-0 overflow-hidden h-[calc(100vh-3rem)] md:h-full transition-all duration-300 ease-in-out md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} ${isSidebarExpanded ? "w-56" : "w-12"} top-12 left-0 md:top-auto md:left-auto z-40`}
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

        {/* Header: label + collapse/expand toggle */}
        <div className={`flex shrink-0 items-center border-b border-primary ${isSidebarExpanded ? "px-3 py-2" : "justify-center py-2"}`}>
          {isSidebarExpanded ? (
            <>
              <span className="flex-1 text-2xs font-bold text-muted uppercase tracking-widest">Apps</span>
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 text-muted hover:text-primary transition-colors focus-ring hidden md:block cursor-pointer rounded-md active:scale-[0.98]"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1.5 text-muted hover:text-primary md:hidden focus-ring cursor-pointer rounded-md active:scale-[0.98]"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 text-muted hover:text-primary transition-colors focus-ring cursor-pointer rounded-md active:scale-[0.98]"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav
          aria-label="Apps"
          className={`flex-1 overflow-y-auto custom-scrollbar py-2 ${isSidebarExpanded ? "px-2 space-y-0.5" : "px-1 flex flex-col items-center gap-0.5"}`}
        >
          {APP_NAV_ITEMS.map(item => {
            const isActive = activeApp === item.path;
            return isSidebarExpanded ? (
              <button
                type="button"
                key={item.path}
                onClick={() => navigateAndClose(item.path)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all w-full text-left focus-ring cursor-pointer active:scale-[0.98] ${
                  isActive ? "bg-active border border-primary" : "hover:bg-hover border border-transparent"
                }`}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={isActive ? item.color : "text-muted"}>{item.icon}</span>
                <span className={`text-sm font-medium ${isActive ? "text-primary" : "text-secondary"}`}>{item.label}</span>
              </button>
            ) : (
              <button
                type="button"
                key={item.path}
                onClick={() => navigateAndClose(item.path)}
                className={`p-1.5 rounded-md transition-colors focus-ring cursor-pointer active:scale-[0.98] ${
                  isActive ? `${item.color} bg-active` : "text-muted hover:text-primary hover:bg-hover"
                }`}
                aria-label={item.label}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
