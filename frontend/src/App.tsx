import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ChatInputProvider } from "./components/ChatInputContext.tsx";
import { StorageErrorBanner } from "./components/chat/StorageErrorBanner.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { AppShellProvider } from "./components/layout/AppShellContext.tsx";
import DashboardRail from "./components/layout/DashboardRail.tsx";
import LoginOverlay from "./components/overlay/login-overlay.tsx";
import { notificationManager, ToastContainer, type ToastItem } from "./components/ui/toast.tsx";
import { useRestoreLastSession } from "./hooks/useRestoreLastSession.ts";
import { rpcLayoutRemote } from "./layout/rpcRemote.ts";
import NotFoundPage from "./pages/NotFoundPage.tsx";
import AppHost from "./shell/AppHost.tsx";
import { useLayoutRegistry } from "./shell/registry.ts";
import TopBar from "./shell/TopBar.tsx";
import { loadUserApps, USER_APP_BASE_PATH } from "./shell/userApps.ts";
import Button from "./ui/button.tsx";

/** Errors React reports when a lazily imported chunk could not be fetched. */
const CHUNK_LOAD_ERROR = /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|ChunkLoadError|Failed to fetch/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && (error.name === "ChunkLoadError" || CHUNK_LOAD_ERROR.test(error.message));
}

interface RouteErrorBoundaryProps {
  /** Changing it (navigating elsewhere) clears a caught error. */
  resetKey: string;
  children: ReactNode;
  /** Injected by tests; reloads the page by default. */
  reload?: (() => void) | undefined;
}

/**
 * Route-level boundary. Unlike keying the subtree on the pathname, it never
 * remounts healthy dashboards on navigation: only a boundary that has caught an
 * error resets when the route changes. React caches a failed `lazy()` import
 * for the page's lifetime, so "Try Again" after a chunk-load failure reloads
 * the page — the only way to fetch the chunk again.
 */
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Route error boundary caught:", error, errorInfo);
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private retry = () => {
    if (isChunkLoadError(this.state.error)) (this.props.reload ?? (() => window.location.reload()))();
    else this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center justify-center h-full p-6 text-center bg-primary">
        <h1 className="text-lg font-bold text-primary mb-2">Oops! Something went wrong</h1>
        <p className="text-sm text-muted mb-6 max-w-md">
          {isChunkLoadError(error) ? "Part of the app failed to load. Reload to fetch it again." : error.message || "An unexpected error occurred"}
        </p>
        <Button type="button" size="md" className="mt-4" onClick={this.retry}>
          {isChunkLoadError(error) ? "Reload" : "Try Again"}
        </Button>
      </div>
    );
  }
}

export default function App() {
  return (
    <AppShellProvider>
      <AppShell />
    </AppShellProvider>
  );
}

function AppShell() {
  const location = useLocation();
  useRestoreLastSession();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showLoadingBar, setShowLoadingBar] = useState(false);
  const loadingBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  const layoutRegistry = useLayoutRegistry();
  // Saved apps (/my/...) resolve once they have loaded; AppHost shows a spinner until then.
  const onLayoutApp = layoutRegistry.routes.resolve(location.pathname) !== null || location.pathname.startsWith(`${USER_APP_BASE_PATH}/`);
  useEffect(() => {
    void loadUserApps(rpcLayoutRemote);
  }, []);

  return (
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
          <TopBar />
          {/* Storage error banner - shows when localStorage is unavailable */}
          <StorageErrorBanner />
          <div className="flex flex-1 min-h-0">
            <DashboardRail />
            <main id="main-content" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <RouteErrorBoundary resetKey={location.pathname}>
                {location.pathname === "/" ? (
                  <Navigate to="/home" replace />
                ) : onLayoutApp ? (
                  // One stable host for every layout app, so moving between an app's routes never remounts it.
                  <AppHost />
                ) : (
                  <NotFoundPage />
                )}
              </RouteErrorBoundary>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </ChatInputProvider>
  );
}
