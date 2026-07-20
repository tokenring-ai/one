import { useCallback, useEffect, useRef, useState } from "react";

export function useConnectionStatus(staleThresholdMs = 30000) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isStale, setIsStale] = useState(false);
  const lastActivityRef = useRef(lastActivity);
  lastActivityRef.current = lastActivity;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      setIsStale(Date.now() - lastActivityRef.current > staleThresholdMs);
    }, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [staleThresholdMs]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    setLastActivity(now);
    setIsStale(false);
  }, []);

  return {
    isOnline,
    isStale,
    lastActivity,
    recordActivity,
  };
}
