import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "../../lib/utils.ts";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClose?: () => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const toastStyles = {
  success: "border-toast-success bg-toast-success text-toast-success",
  error: "border-toast-error bg-toast-error text-toast-error",
  info: "border-toast-info bg-toast-info text-toast-info",
  warning: "border-toast-warning bg-toast-warning text-toast-warning",
};

export default function Toast({ type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (duration > 0 && !isPaused) {
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, isPaused]);

  useEffect(() => {
    if (!isVisible && onClose) {
      const timer = setTimeout(onClose, 300); // Wait for exit animation
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  const Icon = toastIcons[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 100, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn("flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-75 max-w-md", toastStyles[type])}
          role="alert"
          aria-live={type === "error" ? "assertive" : "polite"}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          <Icon className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {title && <h4 className="font-medium text-sm mb-1">{title}</h4>}
            <p className="text-sm leading-relaxed wrap-break-word">{message}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
                  e.preventDefault();
                  setIsVisible(false);
                }
              }}
              className="shrink-0 p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus-ring"
              aria-label="Close toast"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toast Container for managing multiple toasts
interface ToastContainerProps {
  toasts: ToastProps[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={() => toast.id && onRemove(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Simple toast context and hook for easy usage
export interface ToastItem extends ToastProps {
  id: string;
}

interface NotificationItem extends ToastItem {
  timestamp: number;
  read: boolean;
}

class NotificationManager {
  private listeners: Set<(notifications: NotificationItem[]) => void> = new Set();
  private toastListeners: Set<(toasts: ToastItem[]) => void> = new Set();
  private notifications: NotificationItem[] = [];
  private activeToasts: ToastItem[] = [];

  subscribeNotifications(listener: (notifications: NotificationItem[]) => void) {
    this.listeners.add(listener);
    listener([...this.notifications]);
    return () => this.listeners.delete(listener);
  }

  subscribeToasts(listener: (toasts: ToastItem[]) => void) {
    this.toastListeners.add(listener);
    listener([...this.activeToasts]);
    return () => this.toastListeners.delete(listener);
  }

  add(toast: Omit<ToastItem, "id">): string {
    const id = Math.random().toString(36).slice(2, 11);
    const notification: NotificationItem = { ...toast, id, timestamp: Date.now(), read: false };

    this.notifications.unshift(notification);
    if (this.notifications.length > 50) this.notifications.pop();
    this.notifyNotifications();

    this.activeToasts.push({ ...toast, id });
    this.notifyToasts();

    return id;
  }

  removeToast(id: string) {
    this.activeToasts = this.activeToasts.filter(t => t.id !== id);
    this.notifyToasts();
  }

  markAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.notifyNotifications();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => {
      n.read = true;
    });
    this.notifyNotifications();
  }

  clearNotifications() {
    this.notifications = [];
    this.notifyNotifications();
  }

  private notifyNotifications() {
    this.listeners.forEach(listener => {
      listener([...this.notifications]);
    });
  }

  private notifyToasts() {
    this.toastListeners.forEach(listener => {
      listener([...this.activeToasts]);
    });
  }

  success(message: string, options?: Partial<ToastProps>) {
    return this.add({ type: "success", message, ...options });
  }

  error(message: string, options?: Partial<ToastProps>) {
    return this.add({ type: "error", message, ...options });
  }

  info(message: string, options?: Partial<ToastProps>) {
    return this.add({ type: "info", message, ...options });
  }

  warning(message: string, options?: Partial<ToastProps>) {
    return this.add({ type: "warning", message, ...options });
  }
}

export const notificationManager = new NotificationManager();
export const toastManager = {
  success: (msg: string, opts?: Partial<ToastProps>) => notificationManager.success(msg, opts),
  error: (msg: string, opts?: Partial<ToastProps>) => notificationManager.error(msg, opts),
  info: (msg: string, opts?: Partial<ToastProps>) => notificationManager.info(msg, opts),
  warning: (msg: string, opts?: Partial<ToastProps>) => notificationManager.warning(msg, opts),
  remove: (id: string) => notificationManager.removeToast(id),
};

export type { NotificationItem };
