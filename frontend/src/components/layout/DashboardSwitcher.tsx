import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import { AppWindow, Bot, Bug, FilePlus2, LayoutGrid, Moon, Pin, Search, Sun, UserPlus, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resetToNewDocument } from "../../features/documents/documentsStore.ts";
import { agentSessionTitle, useAgentSessionMetaMap } from "../../hooks/agentSessionMetaStore.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, useAgentList, useAgentTypes } from "../../rpc.ts";
import { type DashboardManifest, VISIBLE_DASHBOARD_MANIFESTS } from "../../shell/appCatalog.ts";
import { getLayoutRegistry } from "../../shell/registry.ts";
import { toastManager } from "../ui/toast.tsx";
import { useAppShell } from "./AppShellContext.tsx";

/**
 * The command palette (Cmd/Ctrl+K): one searchable surface for dashboards,
 * running agents, agent types to launch, dock views, and quick actions.
 */

type PaletteItem =
  | { kind: "action"; key: string; icon: typeof Zap; label: string; hint: string; run: () => void }
  | {
      kind: "agent";
      key: string;
      id: string;
      title: string;
      hint: string;
      busy: boolean;
      run: () => void;
    }
  | { kind: "agentType"; key: string; title: string; hint: string; run: () => void }
  | { kind: "dashboard"; key: string; manifest: DashboardManifest; run: () => void }
  | { kind: "view"; key: string; viewId: string; title: string; hint: string; run: () => void };

const SECTION_ORDER = ["action", "agent", "agentType", "dashboard", "view"] as const;
const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  action: "Actions",
  agent: "Running agents",
  agentType: "Launch an agent",
  dashboard: "Dashboards",
  view: "Panels",
};

const MAX_PER_SECTION = 8;

export default function DashboardSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSwitcherOpen, setSwitcherOpen, pinnedDashboardIds, togglePinnedDashboard } = useAppShell();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const metaMap = useAgentSessionMetaMap();
  const [resolvedTheme, setTheme] = useTheme();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(0);
  const launchingTypesRef = useRef(new Set<string>());
  const openedAtPath = useRef<string | null>(null);

  useEffect(() => {
    // Remember where the switcher was opened, so navigating while it is open
    // (back/forward buttons, deep links) closes it. The ref resets on close.
    if (isSwitcherOpen && openedAtPath.current === null) openedAtPath.current = location.pathname;
    if (isSwitcherOpen && location.pathname !== openedAtPath.current) setSwitcherOpen(false);
    if (!isSwitcherOpen) openedAtPath.current = null;
  }, [isSwitcherOpen, location.pathname, setSwitcherOpen]);

  useEffect(() => {
    if (!isSwitcherOpen) {
      setQuery("");
      setStatus("");
      setSelected(0);
    }
  }, [isSwitcherOpen]);

  const results = useMemo<PaletteItem[]>(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const matches = (...fields: (string | undefined)[]) => fields.some(field => field?.toLocaleLowerCase().includes(normalized));

    const allActions: Extract<PaletteItem, { kind: "action" }>[] = [
      {
        kind: "action",
        key: "toggle-theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        hint: "Appearance",
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      {
        kind: "action",
        key: "new-agent",
        icon: UserPlus,
        label: "New agent",
        hint: "Agents",
        run: () => navigate("/agents/new"),
      },
      {
        kind: "action",
        key: "new-document",
        icon: FilePlus2,
        label: "New document",
        hint: "Documents",
        run: () => {
          resetToNewDocument();
          void navigate("/documents");
        },
      },
      {
        kind: "action",
        key: "debug-capture",
        icon: Bug,
        label: "Open debugging & capture",
        hint: "Debugging",
        run: () => navigate("/debug"),
      },
    ];
    const actions = allActions.filter(action => normalized === "" || matches(action.label, action.hint));

    const allAgents: Extract<PaletteItem, { kind: "agent" }>[] = (agents.data ?? []).map(agent => ({
      kind: "agent",
      key: `agent:${agent.id}`,
      id: agent.id,
      title: agentSessionTitle(agent, metaMap),
      hint: agent.currentActivity || agent.agentType,
      busy: !agent.idle,
      run: () => navigate(`/agent/${agent.id}`),
    }));
    const runningAgents = allAgents.filter(item => normalized === "" || matches(item.title, item.hint)).slice(0, MAX_PER_SECTION);

    const allTypes: Extract<PaletteItem, { kind: "agentType" }>[] = (agentTypes.data ?? [])
      .filter(type => !launchingTypesRef.current.has(type.type))
      .map(type => ({
        kind: "agentType",
        key: `agentType:${type.type}`,
        title: type.displayName,
        hint: type.description || type.type,
        run: () => {
          if (launchingTypesRef.current.has(type.type)) return;
          launchingTypesRef.current.add(type.type);
          agentRPCClient
            .createAgent({ agentType: type.type })
            .then(({ id }) => {
              toastManager.success(`Launched ${type.displayName}`);
              void navigate(`/agent/${id}`);
            })
            .catch((error: unknown) => toastManager.error(`Failed to launch ${type.displayName}: ${formatError(error)}`, { duration: 5000 }))
            .finally(() => launchingTypesRef.current.delete(type.type));
        },
      }));
    const types = allTypes.filter(item => normalized !== "" && matches(item.title, item.hint)).slice(0, MAX_PER_SECTION);

    const dashboards: PaletteItem[] = VISIBLE_DASHBOARD_MANIFESTS.filter(
      dashboard => normalized === "" || matches(dashboard.label, dashboard.description, dashboard.group),
    ).map<Extract<PaletteItem, { kind: "dashboard" }>>(manifest => ({
      kind: "dashboard",
      key: `dashboard:${manifest.id}`,
      manifest,
      run: () => navigate(manifest.path),
    }));

    // Views with a URL of their own that need no parameters (a landing page, a create form, a settings
    // page), in any app. The list only appears once the user types, so it never drowns the empty palette.
    const registry = getLayoutRegistry();
    const views: PaletteItem[] =
      normalized === ""
        ? []
        : registry.apps
            .filter(app => !app.hidden)
            .flatMap(app =>
              app.views.flatMap(viewId => {
                const view = registry.view(viewId);
                const url = view?.route !== undefined ? registry.routes.urlFor(app.id, viewId, {}) : null;
                if (!view || !url || url === app.path) return [];
                const title = registry.titleOf(viewId, {});
                if (!matches(title, view.description ?? "", app.label)) return [];
                return [
                  {
                    kind: "view" as const,
                    key: `view:${app.id}:${viewId}`,
                    viewId,
                    title,
                    hint: `${app.label}${view.description ? ` · ${view.description}` : ""}`,
                    run: () => navigate(url),
                  },
                ];
              }),
            )
            .slice(0, MAX_PER_SECTION);

    const bySection: Record<(typeof SECTION_ORDER)[number], PaletteItem[]> = {
      action: actions,
      agent: runningAgents,
      agentType: types,
      dashboard: dashboards,
      view: views,
    };

    return SECTION_ORDER.flatMap(section => bySection[section]);
  }, [query, agents.data, agentTypes.data, metaMap, resolvedTheme, setTheme, navigate]);

  useEffect(() => {
    setSelected(previous => Math.min(previous, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // Keep the keyboard-highlighted row visible.
  useEffect(() => {
    document.getElementById(`palette-item-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!isSwitcherOpen) return null;

  const close = () => setSwitcherOpen(false);

  const runItem = (item: PaletteItem) => {
    close();
    item.run();
  };

  const togglePin = (id: string, label: string) => {
    const wasPinned = pinnedDashboardIds.includes(id);
    const changed = togglePinnedDashboard(id);
    setStatus(changed ? `${label} ${wasPinned ? "removed from" : "pinned to"} the rail.` : "The rail can hold up to seven pinned dashboards.");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    // Arrow navigation and Enter drive the combobox only: on a focused Pin / close button
    // Enter must activate that button rather than run the highlighted result.
    if (!(event.target instanceof HTMLInputElement) || event.target.id !== "dashboard-switcher-search") return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected(previous => (results.length === 0 ? 0 : (previous + 1) % results.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(previous => (results.length === 0 ? 0 : (previous - 1 + results.length) % results.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = results[selected];
      if (item) runItem(item);
    }
  };

  // Section boundaries for accessible grouping in the flat result list.
  let lastSection: string | null = null;

  return (
    <FocusTrap
      focusTrapOptions={{ initialFocus: "#dashboard-switcher-search", escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true }}
    >
      <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="dashboard-switcher-title" onKeyDown={handleKeyDown}>
        <button
          type="button"
          className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
          onClick={close}
          aria-label="Close command palette"
          tabIndex={-1}
        />
        <section className="absolute inset-x-0 top-0 bottom-0 md:inset-auto md:left-[4.5rem] md:top-3 md:w-[min(46rem,calc(100vw-6rem))] md:max-h-[calc(100dvh-1.5rem)] flex flex-col bg-sidebar border-primary md:border rounded-none md:rounded-2xl shadow-2xl overflow-hidden">
          <header className="shrink-0 flex items-center gap-3 p-3 sm:p-4 border-b border-primary">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
              <input
                id="dashboard-switcher-search"
                type="search"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                placeholder="Search dashboards, agents, panels, actions…"
                className="w-full h-11 pl-10 pr-4 bg-input border border-control rounded-xl text-sm text-primary placeholder:text-muted focus-accent"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={results[selected] ? `palette-item-${selected}` : undefined}
              />
            </div>
            <span className="hidden sm:inline-flex px-1.5 py-1 border border-primary rounded-md text-xs text-muted">Esc</span>
            <button
              type="button"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-primary hover:bg-hover focus-ring"
              aria-label="Close command palette"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div id="palette-results" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4" role="listbox" aria-label="Palette results">
            <div className="flex items-start justify-between gap-4 px-1 pb-3">
              <div>
                <h2 id="dashboard-switcher-title" className="text-sm font-semibold text-primary">
                  Command palette
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {query.trim()
                    ? "Agents, panels, dashboards and actions matching your search"
                    : "Jump anywhere — or type to search panels and agent types. Pin dashboards to the rail."}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted tabular-nums">{pinnedDashboardIds.length}/7 pinned</span>
            </div>

            {results.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="w-7 h-7 mx-auto text-dim" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-primary">Nothing matches “{query.trim()}”</p>
                <p className="mt-1 text-xs text-muted">Try a dashboard, running agent, panel name, or action.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {results.map((item, index) => {
                  const showHeader = item.kind !== lastSection;
                  lastSection = item.kind;
                  const highlighted = index === selected;
                  const itemId = `palette-item-${index}`;
                  const Icon =
                    item.kind === "action"
                      ? item.icon
                      : item.kind === "dashboard"
                        ? item.manifest.icon
                        : item.kind === "agent"
                          ? Bot
                          : item.kind === "agentType"
                            ? UserPlus
                            : AppWindow;

                  return (
                    <div key={item.key}>
                      {showHeader && (
                        <h3 className="px-1 pt-3 pb-1.5 text-xs font-bold uppercase tracking-widest text-muted first:pt-0">{SECTION_LABELS[item.kind]}</h3>
                      )}
                      <div
                        id={itemId}
                        role="option"
                        tabIndex={-1}
                        aria-selected={highlighted}
                        onMouseMove={() => setSelected(index)}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border px-2 py-1.5 transition-colors",
                          highlighted ? "bg-active border-accent-muted" : "border-transparent hover:border-primary hover:bg-hover",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => runItem(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left focus-ring"
                        >
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                              item.kind === "dashboard" ? `bg-linear-to-br ${item.manifest.gradient} text-white shadow-sm` : "bg-tertiary text-muted",
                            )}
                          >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium text-primary truncate">
                                {item.kind === "agent"
                                  ? item.title
                                  : item.kind === "dashboard"
                                    ? item.manifest.label
                                    : item.kind === "action"
                                      ? item.label
                                      : item.title}
                              </span>
                              {item.kind === "agent" && item.busy && (
                                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                                  <Zap className="w-3 h-3" aria-hidden="true" />
                                  busy
                                </span>
                              )}
                            </span>
                            <span className="block mt-0.5 text-xs text-muted truncate">
                              {item.kind === "dashboard" ? item.manifest.description : item.hint}
                            </span>
                          </span>
                          {item.kind === "agent" && <span className="shrink-0 hidden sm:block font-mono text-[10px] text-dim">{item.id.slice(0, 8)}</span>}
                          {item.kind === "dashboard" && <span className="shrink-0 text-[10px] uppercase tracking-wide text-dim">{item.manifest.group}</span>}
                        </button>
                        {item.kind === "dashboard" && item.manifest.id !== "settings" && (
                          <button
                            type="button"
                            onClick={() => togglePin(item.manifest.id, item.manifest.label)}
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-lg focus-ring transition-colors",
                              pinnedDashboardIds.includes(item.manifest.id) ? "text-accent bg-accent-subtle" : "text-dim hover:text-primary hover:bg-hover",
                            )}
                            aria-label={`${pinnedDashboardIds.includes(item.manifest.id) ? "Unpin" : "Pin"} ${item.manifest.label}`}
                            aria-pressed={pinnedDashboardIds.includes(item.manifest.id)}
                          >
                            <Pin className={cn("w-3.5 h-3.5", pinnedDashboardIds.includes(item.manifest.id) && "fill-current")} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="shrink-0 flex items-center gap-2 px-4 py-2 border-t border-primary text-[11px] text-muted" role="status" aria-live="polite">
            <LayoutGrid className="w-3 h-3" aria-hidden="true" />
            {status || "↑↓ to browse · Enter to open"}
          </p>
        </section>
      </div>
    </FocusTrap>
  );
}
