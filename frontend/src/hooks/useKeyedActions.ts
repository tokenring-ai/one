import { useCallback, useRef, useState } from "react";

/**
 * Runs actions keyed like `cancel:<id>`, refusing only a repeat of one already running, so an
 * action on one item never silently swallows a click on another (a single app-wide "one action at
 * a time" guard did: no request, no message). `clashes` widens the refusal, e.g. to keep all moves
 * of one list one at a time.
 */
export function useKeyedActions(clashes: (key: string, inFlight: ReadonlySet<string>) => boolean = (key, inFlight) => inFlight.has(key)) {
  const inFlight = useRef(new Set<string>());
  const clashesRef = useRef(clashes);
  clashesRef.current = clashes;
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const execute = useCallback(async <T>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (clashesRef.current(key, inFlight.current)) return undefined;
    inFlight.current.add(key);
    setBusy(new Set(inFlight.current));
    try {
      return await fn();
    } finally {
      inFlight.current.delete(key);
      setBusy(new Set(inFlight.current));
    }
  }, []);
  return { busy, execute };
}
