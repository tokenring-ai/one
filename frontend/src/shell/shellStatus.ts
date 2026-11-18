import { useSyncExternalStore } from "react";

/** Title of the panel the URL focuses in the current layout app; feeds the top bar breadcrumb. */
let activeTitle: string | null = null;
const listeners = new Set<() => void>();

export function setActiveTitle(title: string | null) {
  if (title === activeTitle) return;
  activeTitle = title;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useActiveTitle(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => activeTitle,
    () => null,
  );
}
