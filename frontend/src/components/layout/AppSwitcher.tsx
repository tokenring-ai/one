import { FocusTrap } from "focus-trap-react";
import { Pin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { APP_GROUPS, APP_REGISTRY } from "./AppRegistry.ts";
import { useAppShell } from "./AppShellContext.tsx";

export default function AppSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAppSwitcherOpen, setAppSwitcherOpen, pinnedAppIds, togglePinnedApp } = useAppShell();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const openedAtPath = useRef(location.pathname);

  useEffect(() => {
    if (isAppSwitcherOpen) openedAtPath.current = location.pathname;
    if (isAppSwitcherOpen && location.pathname !== openedAtPath.current) setAppSwitcherOpen(false);
  }, [isAppSwitcherOpen, location.pathname, setAppSwitcherOpen]);

  useEffect(() => {
    if (!isAppSwitcherOpen) {
      setQuery("");
      setStatus("");
    }
  }, [isAppSwitcherOpen]);

  const filteredApps = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return APP_REGISTRY;
    return APP_REGISTRY.filter(app => `${app.label} ${app.description} ${app.group}`.toLocaleLowerCase().includes(normalized));
  }, [query]);

  if (!isAppSwitcherOpen) return null;

  const close = () => setAppSwitcherOpen(false);
  const selectApp = (path: string) => {
    close();
    void navigate(path);
  };
  const togglePin = (id: string, label: string) => {
    const wasPinned = pinnedAppIds.includes(id);
    const changed = togglePinnedApp(id);
    setStatus(changed ? `${label} ${wasPinned ? "removed from" : "pinned to"} the app rail.` : "The app rail can hold up to seven pinned apps.");
  };

  return (
    <FocusTrap
      focusTrapOptions={{ initialFocus: "#app-switcher-search", escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true }}
    >
      <div
        className="fixed inset-0 z-[80]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-switcher-title"
        onKeyDown={event => event.key === "Escape" && close()}
      >
        <button
          type="button"
          className="absolute inset-0 w-full h-full bg-black/60 backdrop-blur-sm cursor-default"
          onClick={close}
          aria-label="Close app switcher"
          tabIndex={-1}
        />
        <section className="absolute inset-x-0 top-0 bottom-0 md:inset-auto md:left-[4.5rem] md:top-3 md:w-[min(46rem,calc(100vw-6rem))] md:max-h-[calc(100dvh-1.5rem)] flex flex-col bg-sidebar border-primary md:border rounded-none md:rounded-2xl shadow-2xl overflow-hidden">
          <header className="shrink-0 flex items-center gap-3 p-3 sm:p-4 border-b border-primary">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" aria-hidden="true" />
              <input
                id="app-switcher-search"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Find an app…"
                className="w-full h-11 pl-10 pr-4 bg-input border border-primary rounded-xl text-sm text-primary placeholder:text-muted focus-accent"
              />
            </div>
            <span className="hidden sm:inline-flex px-1.5 py-1 border border-primary rounded-md text-xs text-muted">Esc</span>
            <button
              type="button"
              onClick={close}
              className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:text-primary hover:bg-hover focus-ring"
              aria-label="Close app switcher"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4">
            <div className="flex items-start justify-between gap-4 px-1 pb-4">
              <div>
                <h2 id="app-switcher-title" className="text-base font-semibold text-primary">
                  All apps
                </h2>
                <p className="mt-1 text-xs text-muted">Pin up to seven apps for one-click access. The active app always appears in the rail.</p>
              </div>
              <span className="shrink-0 text-xs text-muted tabular-nums">{pinnedAppIds.length}/7 pinned</span>
            </div>

            {filteredApps.length === 0 ? (
              <div className="py-16 text-center">
                <Search className="w-7 h-7 mx-auto text-dim" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-primary">No apps found</p>
                <p className="mt-1 text-xs text-muted">Try a different name or category.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {APP_GROUPS.map(group => {
                  const apps = filteredApps.filter(app => app.group === group);
                  if (apps.length === 0) return null;
                  return (
                    <section key={group} aria-labelledby={`app-group-${group.replaceAll(" ", "-")}`}>
                      <h3 id={`app-group-${group.replaceAll(" ", "-")}`} className="px-1 mb-2 text-xs font-bold uppercase tracking-widest text-muted">
                        {group}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {apps.map(app => {
                          const Icon = app.icon;
                          const isPinned = pinnedAppIds.includes(app.id);
                          const isActive =
                            location.pathname === app.path ||
                            location.pathname.startsWith(`${app.path}/`) ||
                            (app.id === "agents" && location.pathname.startsWith("/agent/"));
                          return (
                            <div
                              key={app.id}
                              className={`group flex items-center gap-1 p-1 rounded-xl border transition-colors ${isActive ? "bg-active border-accent-muted" : "border-transparent hover:border-primary hover:bg-hover"}`}
                            >
                              <button
                                type="button"
                                onClick={() => selectApp(app.path)}
                                className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left rounded-lg focus-ring"
                              >
                                <span
                                  className={`w-10 h-10 shrink-0 rounded-xl bg-linear-to-br ${app.gradient} flex items-center justify-center text-white shadow-sm`}
                                >
                                  <Icon className="w-5 h-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-primary truncate">{app.label}</span>
                                  <span className="block mt-0.5 text-xs text-muted truncate">{app.description}</span>
                                </span>
                              </button>
                              {app.id !== "settings" && (
                                <button
                                  type="button"
                                  onClick={() => togglePin(app.id, app.label)}
                                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg focus-ring transition-colors sm:h-8 sm:w-8 ${isPinned ? "text-accent bg-accent-subtle" : "text-dim hover:text-primary hover:bg-hover"}`}
                                  aria-label={`${isPinned ? "Unpin" : "Pin"} ${app.label}`}
                                  aria-pressed={isPinned}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
        </section>
      </div>
    </FocusTrap>
  );
}
