import { motion } from "framer-motion";
import { RefreshCw, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { toastManager } from "../ui/toast.tsx";

interface ConnectionStatusBannerProps {
  isConnecting: boolean;
  connectionError: string | null;
  reconnectAttempts: number;
  onReconnect?: () => void;
}

/**
 * Connection status banner that displays connection state and provides
 * visual feedback for reconnection attempts.
 */
export default function ConnectionStatusBanner({ isConnecting, connectionError, reconnectAttempts, onReconnect }: ConnectionStatusBannerProps) {
  // Show toast notification when connection is lost after multiple attempts
  useEffect(() => {
    if (reconnectAttempts === 1 && connectionError) {
      toastManager.warning("Connection lost. Attempting to reconnect...", { duration: 5000 });
    }
  }, [reconnectAttempts, connectionError]);

  if (!isConnecting && !connectionError) {
    return null;
  }

  const isCritical = reconnectAttempts > 5;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={`overflow-hidden border-b border-primary ${isCritical ? "bg-error/10" : "bg-warning/10"}`}
    >
      <div className="px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isConnecting ? <RefreshCw className="w-4 h-4 text-warning animate-spin shrink-0" /> : <WifiOff className="w-4 h-4 text-error shrink-0" />}

          <div className="flex flex-col min-w-0">
            <span className={`text-xs font-medium ${isCritical ? "text-error" : "text-warning"}`}>
              {isConnecting ? (reconnectAttempts > 0 ? `Reconnecting... (attempt ${reconnectAttempts})` : "Connecting to agent...") : "Connection lost"}
            </span>
            {connectionError && reconnectAttempts > 0 && <span className="text-2xs text-muted font-mono truncate">{connectionError}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {reconnectAttempts > 0 && (
            <span className="text-2xs text-muted font-mono hidden sm:inline">{Math.min(Math.round((1.5 ** reconnectAttempts * 1000) / 1000), 30)}s delay</span>
          )}

          {onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-warning hover:bg-warning/80 text-primary rounded-md transition-colors focus-ring"
              aria-label="Manually reconnect"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Reconnect</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
