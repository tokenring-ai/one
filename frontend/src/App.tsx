import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import "./index.css";
import { ChatInputProvider } from "./components/ChatInputContext.tsx";
import { StorageErrorBanner } from "./components/chat/StorageErrorBanner.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import ModelSelector from "./components/ModelSelector.tsx";
import LoginOverlay from "./components/overlay/login-overlay.tsx";
import Sidebar from "./components/Sidebar.tsx";
import { SidebarProvider } from "./components/SidebarContext.tsx";
import ToolSelector from "./components/ToolSelector.tsx";
import TopBar from "./components/TopBar.tsx";
import { notificationManager, ToastContainer, type ToastItem } from "./components/ui/toast.tsx";
import AgentsApp from "./pages/apps/AgentsApp.tsx";
import BlogApp from "./pages/apps/BlogApp.tsx";
import CalendarApp from "./pages/apps/CalendarApp.tsx";
import CanvasApp from "./pages/apps/CanvasApp.tsx";
import ConfigurationApp from "./pages/apps/ConfigurationApp.tsx";
import DocumentsApp from "./pages/apps/DocumentsApp.tsx";
import EmailApp from "./pages/apps/EmailApp.tsx";
import FilesApp from "./pages/apps/FilesApp.tsx";
import MediaApp from "./pages/apps/MediaApp.tsx";
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
import TerminalApp from "./pages/apps/TerminalApp.tsx";
import VaultApp from "./pages/apps/VaultApp.tsx";
import WorkflowsApp from "./pages/apps/WorkflowsApp.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFoundPage from "./pages/NotFoundPage.tsx";
import { useAgentList, useAgentTypes, useWorkflows } from "./rpc.ts";

export default function App() {
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // These are used by Sidebar and TopBar — load them at app level for shared access
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const workflows = useWorkflows();

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

  const currentAgentId = location.pathname.startsWith("/agent/") ? location.pathname.split("/")[2]! : null;

  return (
    <SidebarProvider>
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
              <Sidebar currentAgentId={currentAgentId || ""} agents={agents} workflows={workflows} agentTypes={agentTypes} />
              <main id="main-content" className="flex-1 min-w-0 relative">
                <ErrorBoundary>
                  <Routes>
                    {/* Dashboard home */}
                    <Route path="/" element={<Dashboard />} />

                    {/* App routes */}
                    <Route path="/agents" element={<AgentsApp />} />
                    <Route path="/workflows" element={<WorkflowsApp />} />
                    <Route path="/scheduler" element={<SchedulerApp />} />
                    <Route path="/queue" element={<QueueApp />} />
                    <Route path="/skills" element={<SkillsApp />} />
                    <Route path="/canvas" element={<CanvasApp />} />
                    <Route path="/documents" element={<DocumentsApp />} />
                    <Route path="/research" element={<ResearchApp />} />
                    <Route path="/blog" element={<BlogApp />} />
                    <Route path="/files" element={<FilesApp />} />
                    <Route path="/terminal" element={<TerminalApp />} />
                    <Route path="/email" element={<EmailApp />} />
                    <Route path="/calendar" element={<CalendarApp />} />
                    <Route path="/media" element={<MediaApp />} />
                    <Route path="/social" element={<SocialApp />} />
                    <Route path="/messaging" element={<MessagingApp />} />
                    <Route path="/stocks" element={<StocksApp />} />
                    <Route path="/plugins" element={<PluginsApp />} />
                    <Route path="/configuration" element={<ConfigurationApp />} />
                    <Route path="/services" element={<ServicesApp />} />
                    <Route path="/metrics" element={<MetricsApp />} />
                    <Route path="/settings" element={<SettingsApp />} />
                    <Route path="/vault" element={<VaultApp />} />

                    {/* Agent chat */}
                    <Route path="/agent/:agentId/*" element={<ChatPage key={currentAgentId ?? "chat"} />} />

                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </ErrorBoundary>
      </ChatInputProvider>
    </SidebarProvider>
  );
}
