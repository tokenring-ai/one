import { useEffect, useState } from "react";

/**
 * Increment a hidden counter on an interval while `condition` is true.
 * The counter value is not returned — it exists solely to trigger re-renders.
 *
 * @example
 * // Tick every 15s while there are scheduled tasks
 * useTick(15_000, runningTaskCount > 0 || hasUpcomingTasks);
 *
 * // Tick every 2s while items are running
 * useTick(2_000, running.length > 0);
 */
export function useTick(intervalMs: number, condition: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!condition) return;
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, condition]);
}
