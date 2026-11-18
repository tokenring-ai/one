import { instantiate, isStructural, type LayoutAction, type ModelContext, reduce, type ViewLookup, validate } from "./model.ts";
import type { LayoutState, LayoutTemplate } from "./types.ts";

const HISTORY_LIMIT = 60;

/**
 * What views set at runtime (titles, badges) describes the live view, not the
 * arrangement. When another arrangement is adopted (loaded, synced, reset,
 * undone), panels that stay open keep their live values: their views only set
 * them again when their own data changes. Badges never come from elsewhere, so
 * a stored count can't outlive what it counted.
 */
function keepLiveRuntime(next: LayoutState, current: LayoutState | null): LayoutState {
  for (const [key, panel] of Object.entries(next.panels)) {
    const live = current?.panels[key];
    delete panel.badge;
    if (live?.badge) panel.badge = { ...live.badge };
    if (live?.title !== undefined) panel.title = live.title;
  }
  return next;
}

export type StoreChange = "local" | "remote" | "reset";

/**
 * One app's layout: current state plus undo/redo. A plain external store
 * (`useSyncExternalStore`); persistence subscribes to it from outside.
 */
export class LayoutStore {
  private state: LayoutState;
  private past: LayoutState[] = [];
  private future: LayoutState[] = [];
  private listeners = new Set<(change: StoreChange) => void>();
  /** True when the current state came from storage rather than the template. */
  restored: boolean;

  constructor(
    readonly ctx: ModelContext,
    private readonly lookup: ViewLookup,
    private readonly template: LayoutTemplate,
    initial?: unknown,
  ) {
    const restored = initial === undefined ? null : validate(initial, ctx, lookup);
    this.state = keepLiveRuntime(restored ?? instantiate(template, ctx, lookup), null);
    this.restored = !!restored;
  }

  getState = (): LayoutState => this.state;

  subscribe = (listener: (change: StoreChange) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(change: StoreChange) {
    for (const listener of this.listeners) listener(change);
  }

  /** Returns true when the action changed the layout. */
  dispatch = (action: LayoutAction): boolean => {
    const next = reduce(this.state, action, this.ctx);
    if (next === this.state) return false;
    if (isStructural(action)) {
      this.past.push(this.state);
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future = [];
    }
    this.state = next;
    this.emit("local");
    return true;
  };

  canUndo = () => this.past.length > 0;
  canRedo = () => this.future.length > 0;

  undo = (): boolean => {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(this.state);
    this.state = keepLiveRuntime(structuredClone(prev), this.state);
    this.emit("local");
    return true;
  };

  redo = (): boolean => {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.state);
    this.state = keepLiveRuntime(structuredClone(next), this.state);
    this.emit("local");
    return true;
  };

  /** Back to the app's shipped layout (undoable). */
  reset = () => {
    this.past.push(this.state);
    this.future = [];
    this.state = keepLiveRuntime(instantiate(this.template, this.ctx, this.lookup), this.state);
    this.restored = false;
    this.emit("reset");
  };

  /** Adopt a layout from elsewhere (another tab or device). Not undoable; invalid input is ignored. */
  adoptRemote = (raw: unknown): boolean => {
    const next = validate(raw, this.ctx, this.lookup);
    if (!next) return false;
    this.state = keepLiveRuntime(next, this.state);
    this.past = [];
    this.future = [];
    this.restored = true;
    this.emit("remote");
    return true;
  };
}
