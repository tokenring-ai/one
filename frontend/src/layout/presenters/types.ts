import type { DragEvent, ReactNode } from "react";
import type { LayoutApi } from "../context.ts";
import type { ContainerNode, LayoutState, PanelKey, PanelState } from "../types.ts";

export interface ItemDropProps {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/** Everything a presenter needs to draw one container. */
export interface PresenterContext {
  node: ContainerNode;
  state: LayoutState;
  api: LayoutApi;
  /** The item the container shows (tabs, carousel); the URL's active key when it lives here. */
  visible: PanelKey | null;
  focused: boolean;
  panel(key: PanelKey): PanelState | undefined;
  title(key: PanelKey): string;
  icon(key: PanelKey): ReactNode;
  /** Renders the panel's element at this spot. */
  slot(key: PanelKey, visible: boolean): ReactNode;
  /** Container-level buttons (maximize, options). */
  actions: ReactNode;
  /** Draggable handle props for an item. */
  drag(key: PanelKey): Record<string, unknown>;
  /** Insert-before/after drop handling on an item element along an axis. */
  itemDrop(index: number, axis: "x" | "y"): ItemDropProps;
  /** Drop at the end of an item strip (empty space after the last item). */
  stripDrop: ItemDropProps;
  /** Index where a dragged item would be inserted, for drawing a marker. */
  insertAt: number | null;
}

export interface Presenter {
  header?(ctx: PresenterContext): ReactNode;
  body(ctx: PresenterContext): ReactNode;
  footer?(ctx: PresenterContext): ReactNode;
}
