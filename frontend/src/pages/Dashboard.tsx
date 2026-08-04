import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CheckpointBrowser from "../components/CheckpointBrowser.tsx";
import AppCard, { type AppCardDef } from "../components/dashboard/AppCard.tsx";
import { APP_GROUPS, APP_REGISTRY } from "../components/layout/AppRegistry.ts";
import { useAgentList } from "../rpc.ts";

const APPS: AppCardDef[] = APP_REGISTRY.map(app => {
  const Icon = app.icon;
  return { id: app.id, path: app.path, label: app.label, description: app.description, icon: <Icon />, gradient: app.gradient };
});

export default function Dashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const activeCount = agents.data?.length ?? 0;
  const showAgentBadge = !agents.isLoading && !agents.error && activeCount > 0;
  const appsWithBadges = APPS.map(app => (app.id === "agents" && showAgentBadge ? { ...app, badge: String(activeCount) } : app));

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <p className="text-2xs font-bold text-accent uppercase tracking-widest mb-2">Local workspace</p>
            <h1 className="text-primary text-3xl font-bold tracking-tight mb-1">What do you want to work on?</h1>
            <p className="text-xs text-muted">Agents, creative tools, and local data share one workspace.</p>
          </div>

          <div className="flex items-center gap-4 px-4 py-3 bg-secondary border border-primary rounded-xl shadow-sm">
            <div className="flex items-center gap-2">
              {agents.isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 text-muted animate-spin" />
                  <span className="text-xs text-muted">Loading agents…</span>
                </>
              ) : agents.error ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-xs text-warning" title={formatError(agents.error)}>
                    Unable to load agents
                  </span>
                </>
              ) : (
                <>
                  <div className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-amber-500 animate-pulse" : "bg-tertiary"}`} />
                  <span className="text-xs text-primary font-medium">
                    {activeCount} active {activeCount === 1 ? "agent" : "agents"}
                  </span>
                </>
              )}
            </div>
            <div className="w-px h-4 bg-primary" />
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => navigate("/agents")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring shadow-button-primary"
            >
              <User className="w-3.5 h-3.5" /> New Agent
            </button>
          </div>

          <div className="space-y-7">
            {APP_GROUPS.map(group => {
              const groupedApps = appsWithBadges.filter(app => APP_REGISTRY.find(definition => definition.id === app.id)?.group === group);
              return (
                <section key={group}>
                  <h2 className="text-2xs font-bold text-muted uppercase tracking-widest px-1 mb-3">{group}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {groupedApps.map(app => (
                      <AppCard key={app.id} app={app} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <CheckpointBrowser agents={agents} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-primary bg-secondary px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-2xs text-muted">© {new Date().getFullYear()} TokenRing AI</span>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/tokenring-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-muted hover:text-primary transition-colors focus-ring"
            >
              GitHub
            </a>
            <a
              href="https://tokenring.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-muted hover:text-primary transition-colors focus-ring"
            >
              tokenring.ai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
