import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils.ts";
import { type NotificationItem, notificationManager } from "./toast.tsx";

const toastIcons = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const toastColors = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-blue-400",
  warning: "text-amber-400",
};

export default function NotificationMenu() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [justOpened, setJustOpened] = useState(false);

  useEffect(() => {
    const cleanup = notificationManager.subscribeNotifications(setNotifications);
    return cleanup as () => void;
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpen = () => {
    if (unreadCount > 0) {
      setJustOpened(true);
      setTimeout(() => setJustOpened(false), 2000);
    }
    setIsOpen(true);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-hover transition-colors text-muted focus-ring"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-secondary border border-primary rounded-lg shadow-xl overflow-hidden z-50"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-primary">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-primary">Notifications</h3>
                  {justOpened && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                    >
                      All marked as read
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => notificationManager.markAllAsRead()}
                      className="text-xs text-muted hover:text-primary transition-colors"
                      aria-label="Mark all as read"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => notificationManager.clearNotifications()}
                      className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors focus-ring"
                      aria-label="Clear all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-md hover:bg-hover text-muted hover:text-primary transition-colors focus-ring"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-80">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted">No notifications</div>
                ) : (
                  notifications.map(notification => (
                    <motion.div
                      key={notification.id}
                      className="px-4 py-3 border-b border-primary hover:bg-hover transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => notificationManager.markAsRead(notification.id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          notificationManager.markAsRead(notification.id);
                        }
                      }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: notification.read ? 0.6 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn("text-sm font-bold mt-0.5", toastColors[notification.type])}>{toastIcons[notification.type]}</span>
                        <div className="flex-1 min-w-0">
                          {notification.title && <h4 className="text-sm font-medium text-primary mb-1">{notification.title}</h4>}
                          <p className="text-sm text-muted wrap-break-word">{notification.message}</p>
                          <span className="text-xs text-dim mt-1 block">{formatTimeAgo(notification.timestamp)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
