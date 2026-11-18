import { Bot, Loader2, MessageCircleQuestion, Pause, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BusySpinner from "../components/ui/BusySpinner.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.tsx";
import { agentSessionTitle, useAgentSessionMetaMap } from "../hooks/agentSessionMetaStore.ts";
import { useAnnouncer } from "../hooks/useAnnouncer.tsx";
import { agentCountSummary, agentStatusLine, nestSubAgents, sortRunningAgents } from "../lib/agentSessions.ts";
import { cn } from "../lib/utils.ts";
import { useAgentList } from "../rpc.ts";
import { getLayoutRegistry } from "./registry.ts";

/** Where an agent's chat opens: inside the current layout app when it can show chats, else the Agents app. */
export function chatUrlFor(pathname: string, agentId: string): string {
  const registry = getLayoutRegistry();
  const route = registry.routes.resolve(pathname);
  const app = route ? registry.app(route.app) : undefined;
  if (app?.views.includes("chat")) {
    const url = registry.routes.urlFor(app.id, "chat", { agentId });
    if (url) return url;
  }
  return `/agent/${encodeURIComponent(agentId)}`;
}

/** True when the agent is blocked on a question only a person can answer. */
function isWaiting(agent: { pendingQuestions?: number }): boolean {
  return (agent.pendingQuestions ?? 0) > 0;
}

function waitingLabel(count: number): string {
  return count === 1 ? "Waiting for your answer" : `${count} questions waiting for you`;
}

/**
 * What the agents are doing, app-wide. Replaces the old "current agent"
 * dropdown: which agent you are looking at is a panel's business, not the shell's.
 */
export default function AgentActivity() {
  const agents = useAgentList();
  const metaMap = useAgentSessionMetaMap();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The same order as Active agents: blocked on a question first, then working, then idle.
  const list = sortRunningAgents(agents.data ?? []);
  const waiting = list.filter(isWaiting).length;
  const running = list.filter(a => !a.idle && !isWaiting(a)).length;
  const { announce, region } = useAnnouncer();
  const loaded = !agents.isLoading && agents.data !== undefined;
  const lastWaiting = useRef<number | null>(null);
  // Say so when another agent starts needing you, wherever you are in the app. Focus is left alone.
  useEffect(() => {
    if (!loaded) return;
    const before = lastWaiting.current;
    lastWaiting.current = waiting;
    if (before !== null && waiting > before) announce(waiting === 1 ? "1 agent is waiting for your answer" : `${waiting} agents are waiting for your answer`);
  }, [loaded, waiting, announce]);

  const summary = agents.isLoading ? "Agents" : agentCountSummary(list);

  return (
    <>
      {region}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Agent activity: ${summary}`}
            className={cn(
              "flex h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap focus-ring hover:bg-hover",
              waiting ? "text-warning" : running ? "text-fg-secondary" : "text-muted",
            )}
          >
            {waiting ? (
              <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
            ) : running ? (
              <BusySpinner size="sm" />
            ) : (
              <Bot className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{summary}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {agents.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
            </div>
          ) : list.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted">No agents.</p>
          ) : (
            nestSubAgents(list).map(({ agent, depth }) => {
              const title = agentSessionTitle(agent, metaMap);
              return (
                <DropdownMenuItem
                  key={agent.id}
                  className="items-start gap-2.5 py-2"
                  style={depth > 0 ? { paddingLeft: `${0.5 + depth}rem` } : undefined}
                  onSelect={() => void navigate(chatUrlFor(pathname, agent.id))}
                >
                  <span className="mt-0.5 shrink-0">
                    {isWaiting(agent) ? (
                      <MessageCircleQuestion className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                    ) : agent.idle ? (
                      <Pause className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    ) : (
                      <BusySpinner size="sm" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-fg">{title}</span>
                    {/* Status, type and start time, as in Active agents, so two agents with the same name can be told apart. */}
                    <span className={cn("block truncate text-[11px]", isWaiting(agent) ? "text-warning" : "text-muted")}>
                      {isWaiting(agent) ? waitingLabel(agent.pendingQuestions ?? 0) : agentStatusLine(agent, title)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
          <div className="my-1 border-t border-line-subtle" role="separator" />
          <DropdownMenuItem className="gap-2 text-xs" onSelect={() => void navigate("/agents")}>
            <Plus className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> Launch or manage agents
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
