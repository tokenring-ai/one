/**
 * Every panel renders exactly once, here, through a portal into its own
 * detached element. Containers only attach that element (PanelSlot), so moving
 * a panel between containers moves a DOM node instead of remounting React
 * state, which keeps terminals, editors and scroll positions intact.
 */
import { AlertTriangle } from "lucide-react";
import { Component, memo, type ReactNode, Suspense, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import LoadingState from "../components/ui/LoadingState.tsx";
import Button from "../ui/button.tsx";
import { useLayoutApi, useLayoutState } from "./context.ts";
import { PanelIdentityContext } from "./hooks.ts";
import type { PanelKey, PanelState } from "./types.ts";

class PanelErrorBoundary extends Component<{ children: ReactNode; title: string }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    console.error(`[layout] "${this.props.title}" crashed`, error);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
        <p className="text-sm text-fg">{this.props.title} stopped working.</p>
        <p className="max-w-sm text-xs text-muted">{this.state.error.message}</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}

function sameParams(a: PanelState, b: PanelState) {
  return a.key === b.key && a.viewId === b.viewId && JSON.stringify(a.params) === JSON.stringify(b.params);
}

const PanelFrame = memo(
  function PanelFrame({ panel }: { panel: PanelState }) {
    const { registry } = useLayoutApi();
    const view = registry.view(panel.viewId);
    if (!view) return null;
    const View = view.component;
    const title = registry.titleOf(panel.viewId, panel.params);
    return (
      <PanelIdentityContext.Provider value={{ key: panel.key, viewId: panel.viewId, params: panel.params }}>
        <PanelErrorBoundary title={title}>
          <Suspense fallback={<LoadingState size="sm" className="flex-1" />}>
            <View params={panel.params} />
          </Suspense>
        </PanelErrorBoundary>
      </PanelIdentityContext.Provider>
    );
  },
  (prev, next) => sameParams(prev.panel, next.panel),
);

export function PanelHost() {
  const api = useLayoutApi();
  const state = useLayoutState();
  const panels = Object.values(state.panels);
  return <>{panels.map(panel => createPortal(<PanelFrame panel={panel} />, api.nodeFor(panel.key), panel.key))}</>;
}

/** Attaches a panel's element into a container. */
export function PanelSlot({ panelKey, visible }: { panelKey: PanelKey; visible: boolean }) {
  const api = useLayoutApi();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const node = api.nodeFor(panelKey);
    if (node.parentElement !== host) host.appendChild(node);
    // No cleanup: the next slot for this key moves the node; detaching first would reset iframes and scroll.
  }, [api, panelKey]);
  useLayoutEffect(() => {
    api.nodeFor(panelKey).hidden = !visible;
    api.visibility.set(panelKey, visible);
  }, [api, panelKey, visible]);
  // A slot that goes away (maximize elsewhere, close, move) no longer shows its panel. When the panel
  // moved, its new slot's effects run after this cleanup in the same commit and set it again.
  // Keyed on the store, not `api`, which changes on every navigation.
  const { visibility } = api;
  useLayoutEffect(() => () => visibility.set(panelKey, false), [visibility, panelKey]);
  return <div ref={ref} className={visible ? "flex min-h-0 min-w-0 flex-1" : "contents"} data-slot={panelKey} />;
}
