import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ChatInputProvider } from "./components/ChatInputContext.tsx";
import { StorageErrorBanner } from "./components/chat/StorageErrorBanner.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import AppRail from "./components/layout/AppRail.tsx";
import { getActiveApp } from "./components/layout/AppRegistry.ts";
import { AppShellProvider } from "./components/layout/AppShellContext.tsx";
import ModelSelector from "./components/ModelSelector.tsx";
import LoginOverlay from "./components/overlay/login-overlay.tsx";
import ToolSelector from "./components/ToolSelector.tsx";
import TopBar from "./components/TopBar.tsx";
import { notificationManager, ToastContainer, type ToastItem } from "./components/ui/toast.tsx";
import AgentsApp from "./pages/apps/AgentsApp.tsx";
import BlogApp from "./pages/apps/BlogApp.tsx";
import BotsApp from "./pages/apps/BotsApp.tsx";
import CalendarApp from "./pages/apps/CalendarApp.tsx";
import ConfigurationApp from "./pages/apps/ConfigurationApp.tsx";
import DatabaseApp from "./pages/apps/DatabaseApp.tsx";
import DebugApp from "./pages/apps/DebugApp.tsx";
import DocumentsApp from "./pages/apps/DocumentsApp.tsx";
import EmailApp from "./pages/apps/EmailApp.tsx";
import FilesApp from "./pages/apps/FilesApp.tsx";
import MediaApp from "./pages/apps/MediaApp.tsx";
import MemoriesApp from "./pages/apps/MemoriesApp.tsx";
import MessagingApp from "./pages/apps/MessagingApp.tsx";
import MetricsApp from "./pages/apps/MetricsApp.tsx";
import PluginsApp from "./pages/apps/PluginsApp.tsx";
import QueueApp from "./pages/apps/QueueApp.tsx";
import ResearchApp from "./pages/apps/ResearchApp.tsx";
import SchedulerApp from "./pages/apps/SchedulerApp.tsx";
import ServicesApp from "./pages/apps/ServicesApp.tsx";
import SettingsApp from "./pages/apps/SettingsApp.tsx";
import SkillsApp from "./pages/apps/SkillsApp.tsx";
import SocialApp from "./pages/apps/SocialApp.tsx";
import StocksApp from "./pages/apps/StocksApp.tsx";
import TasksApp from "./pages/apps/TasksApp.tsx";
import TerminalApp from "./pages/apps/TerminalApp.tsx";
import VaultApp from "./pages/apps/VaultApp.tsx";
import WebDesignApp from "./pages/apps/WebDesignApp.tsx";
import WorkflowsApp from "./pages/apps/WorkflowsApp.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFoundPage from "./pages/NotFoundPage.tsx";
import { useAgentList } from "./rpc.ts";

export default function App() {
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Used by TopBar; each app loads whatever else it needs itself.
  const agents = useAgentList();

  useEffect(() => {
    const cleanup = notificationManager.subscribeToasts(setToasts);
    return cleanup as () => void;
  }, []);

  // Show loading bar during route transitions (key changes on every navigation)
  useEffect(() => {
    setShowLoadingBar(true);
    if (loadingBarTimeoutRef.current) {
      clearTimeout(loadingBarTimeoutRef.current);
    }
    loadingBarTimeoutRef.current = setTimeout(() => {
      setShowLoadingBar(false);
    }, 300);
    return () => {
      if (loadingBarTimeoutRef.current) {
        clearTimeout(loadingBarTimeoutRef.current);
      }
    };
  }, [location.key]);

  useEffect(() => {
    const activeApp = getActiveApp(location.pathname);
    document.title = activeApp ? `${activeApp.label} · TokenRing One` : "TokenRing One";
  }, [location.pathname]);

  const currentAgentId = location.pathname.startsWith("/agent/") ? location.pathname.split("/")[2]! : null;

  return (
    <AppShellProvider>
      <ChatInputProvider>
        <ErrorBoundary>
          <LoginOverlay />
          <ToastContainer toasts={toasts} onRemove={id => notificationManager.removeToast(id)} />
          {/* Route transition loading bar */}
          {showLoadingBar && (
            <div
              key={location.key}
              data-testid="route-loading-bar"
              className="fixed top-0 left-0 right-0 h-1 bg-linear-to-r from-accent via-accent to-accent z-[100] route-loading-bar"
              role="progressbar"
              aria-label="Loading page"
            />
          )}
          <div className="flex flex-col h-dvh bg-primary/50 text-secondary antialiased font-sans selection:bg-active overflow-hidden">
            {/* Skip to main content link for accessibility */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-primary focus:rounded-lg focus-ring"
            >
              Skip to main content
            </a>
            <TopBar
              currentAgentId={currentAgentId}
              agents={agents}
              agentControls={
                currentAgentId ? (
                  <>
                    <ModelSelector agentId={currentAgentId} />
                    <ToolSelector agentId={currentAgentId} />
                  </>
                ) : undefined
              }
            />
            {/* Storage error banner - shows when localStorage is unavailable */}
            <StorageErrorBanner />
            <div className="flex flex-1 min-h-0">
              <AppRail />
              <main id="main-content" className="flex-1 min-w-0 relative">
                <ErrorBoundary>
                  <Routes>
                    {/* Dashboard home */}
                    <Route path="/" element={<Dashboard />} />

                    {/* App routes */}
                    {/* Optional param keeps the app mounted while browsing between agent types */}
                    <Route path="/agents/:agentType?" element={<AgentsApp />} />
                    {/* Optional param keeps the app mounted while navigating between workflows */}
                    <Route path="/workflows/:workflowName?" element={<WorkflowsApp />} />
                    {/* Optional params keep the app mounted while navigating between tasks */}
                    <Route path="/tasks/:listName?/:taskName?" element={<TasksApp />} />
                    {/* Optional param keeps the app mounted while navigating between bots */}
                    <Route path="/bots/:botId?" element={<BotsApp />} />
                    <Route path="/scheduler" element={<SchedulerApp />} />
                    <Route path="/queue" element={<QueueApp />} />
                    <Route path="/skills" element={<SkillsApp />} />
                    {/* Optional params keep the app mounted while navigating between designs */}
                    <Route path="/web-design/:flowName?/:designName?" element={<WebDesignApp />} />
                    <Route path="/documents" element={<DocumentsApp />} />
                    <Route path="/research/:topicName?/:itemName?" element={<ResearchApp />} />
                    <Route path="/memories/:category?/:memoryName?" element={<MemoriesApp />} />
                    {/* Optional param keeps the app mounted while navigating between posts */}
                    <Route path="/blog/:blogId?" element={<BlogApp />} />
                    {/* Optional param keeps the app mounted while navigating between files */}
                    <Route path="/files/:fileId?" element={<FilesApp />} />
                    <Route path="/terminal/:terminalId?" element={<TerminalApp />} />
                    {/* Optional param keeps the app mounted while navigating between email providers */}
                    <Route path="/email/:provider?" element={<EmailApp />} />
                    {/* Optional param keeps the app mounted while navigating between datasources */}
                    <Route path="/database/:datasource?" element={<DatabaseApp />} />
                    {/* Optional param keeps the app mounted while navigating between calendar providers */}
                    <Route path="/calendar/:provider?" element={<CalendarApp />} />
                    <Route path="/media" element={<MediaApp />} />
                    <Route path="/social" element={<SocialApp />} />
                    <Route path="/messaging" element={<MessagingApp />} />
                    <Route path="/stocks" element={<StocksApp />} />
                    <Route path="/plugins" element={<PluginsApp />} />
                    {/* Optional param keeps the app mounted while navigating between plugins */}
                    <Route path="/configuration/:plugin?" element={<ConfigurationApp />} />
                    <Route path="/services" element={<ServicesApp />} />
                    <Route path="/metrics" element={<MetricsApp />} />
                    <Route path="/debug" element={<DebugApp />} />
                    <Route path="/settings" element={<SettingsApp />} />
                    <Route path="/vault" element={<VaultApp />} />

                    {/* Agent chat — rendered by the Agents app so its sidebar stays alongside the chat */}
                    <Route path="/agent/:agentId/*" element={<AgentsApp />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </ErrorBoundary>
      </ChatInputProvider>
    </AppShellProvider>
  );
}
