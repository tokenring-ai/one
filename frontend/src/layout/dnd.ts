/**
 * Drag state for moving panels. HTML5 drag-and-drop; one drag at a time, so
 * module state is enough. Containers subscribe to `onDragEnd` to clear their
 * drop indicators, because the source element may unmount before `dragend`.
 */
import type { DragEvent } from "react";
import type { PanelKey } from "./types.ts";

export const PANEL_MIME = "application/x-tokenring-panel";

interface Drag {
  app: string;
  key: PanelKey;
}

let current: Drag | null = null;
const endListeners = new Set<() => void>();

export function currentDrag(): Drag | null {
  return current;
}

export function endDrag() {
  current = null;
  for (const listener of endListeners) listener();
}

export function onDragEnd(listener: () => void): () => void {
  endListeners.add(listener);
  return () => endListeners.delete(listener);
}

export function dragSourceProps(app: string, key: PanelKey) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      current = { app, key };
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(PANEL_MIME, key);
      e.dataTransfer.setData("text/plain", key);
    },
    onDragEnd: () => endDrag(),
  };
}
