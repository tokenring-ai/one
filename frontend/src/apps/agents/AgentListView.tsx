import { Check, CornerDownRight, Ellipsis, Pin, Search, Workflow, X } from "lucide-react";
import { createElement, Fragment, useEffect, useMemo, useState } from "react";
import AgentTodoList from "../../components/AgentTodoList.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { agentSessionTitle, comparePinnedFirst, useAgentSessionMetaActions, useAgentSessionMetaMap } from "../../hooks/agentSessionMetaStore.ts";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.ts";
import type { PanelMenuItem } from "../../layout/context.ts";
import { usePaneLink, usePanel, usePanelMenu } from "../../layout/hooks.ts";
import { PaneLink } from "../../layout/links.tsx";
import { agentCountSummary, agentStatusLine, nestSubAgents } from "../../lib/agentSessions.ts";
import { cn } from "../../lib/utils.ts";
import { useAgentJobs } from "../../rpc.ts";
import { CHAT_VIEW } from "../chat/ids.ts";
import { useBranchAgent } from "../chat/useBranchAgent.ts";
import { agentMenuItems } from "./agentMenu.ts";
import { AGENT_JOBS_VIEW, AGENT_LAUNCH_VIEW, needsYou, openAgentLabel, type RunningAgent, StatusIcon, StatusText, sortRunningAgents } from "./shared.tsx";
import { useAgentActions } from "./useAgentActions.ts";
import { useMonitorAgent } from "./useMonitorAgent.ts";

/** The ⋯ menu on one agent row; the same items as the area menu offers for the open agent. */
function RowMenu({ title, items }: { title: string; items: readonly PanelMenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${title}`}
          title="Actions"
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted opacity-60 transition-opacity hover:bg-hover hover:text-fg hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 focus-ring cursor-pointer"
        >
          <Ellipsis className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {items.map(entry => (
          <Fragment key={entry.id}>
            {entry.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem className={cn("gap-2 text-xs", entry.danger && "text-error")} disabled={entry.disabled} onSelect={() => entry.onSelect()}>
              {entry.icon && createElement(entry.icon, { className: cn("h-3.5 w-3.5", entry.danger ? "text-error" : "text-muted"), "aria-hidden": true })}
              {entry.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The way from the sidebar to the jobs page: agents the plugins run unattended, with how many are active. */
function AgentJobsLink() {
  const jobs = useAgentJobs();
  const active = (jobs.data?.jobs ?? []).filter(job => job.status === "queued" || job.status === "running").length;
  return (
    <PaneLink
      view={AGENT_JOBS_VIEW}
      className="flex items-center gap-2 border-t border-line px-3 py-2 text-xs text-secondary hover:bg-hover hover:text-primary focus-ring"
      title="Agents run unattended by Tasks, Queues, Workflows and the Scheduler"
    >
      <Workflow className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1">Agent jobs</span>
      {active > 0 && <span className="rounded-full bg-accent-tint px-1.5 text-accent-soft tabular-nums">{active} active</span>}
    </PaneLink>
  );
}

/**
 * The Running tab of the Agents app: running agents, the ones waiting on you
 * first, with their live todo lists. Rows are links (a plain click opens the
 * chat here, a modified click a browser tab); each row's ⋯ holds the rest.
 */
export default function AgentListView() {
  const panel = usePanel();
  const openPane = usePaneLink();
  const branchAgent = useBranchAgent();
  const openLaunch = () => openPane(AGENT_LAUNCH_VIEW);
  const { agents, agentList, routeAgentId, openAgent, deleteAgent, deletingAgentId, confirmOpen, ConfirmDialog } = useAgentActions();

  // Session management: per-session titles/pins + a text filter over running agents.
  const metaMap = useAgentSessionMetaMap();
  const { setTitle, togglePinned } = useAgentSessionMetaActions();
  const [sessionQuery, setSessionQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const sortedAgents = useMemo(() => {
    const sorted = sortRunningAgents(agentList).sort((a, b) => comparePinnedFirst(a.id, b.id, metaMap));
    const query = sessionQuery.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      agent =>
        agentSessionTitle(agent, metaMap).toLowerCase().includes(query) ||
        agent.agentType.toLowerCase().includes(query) ||
        agent.currentActivity.toLowerCase().includes(query),
    );
  }, [agentList, metaMap, sessionQuery]);

  // The tab carries the count (amber while someone needs you) instead of a heading inside the list.
  const waiting = agentList.filter(needsYou).length;
  useEffect(() => {
    panel.setBadge(
      agentList.length === 0
        ? null
        : {
            tone: waiting > 0 ? "warning" : "info",
            count: agentList.length,
            label: agentCountSummary(agentList),
          },
    );
  }, [panel, agentList.length, waiting]);

  const startRename = (agent: RunningAgent) => {
    setRenamingId(agent.id);
    setRenameDraft(agentSessionTitle(agent, metaMap));
  };
  const commitRename = (agentId: string) => {
    setTitle(agentId, renameDraft);
    setRenamingId(null);
    setRenameDraft("");
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const monitorAgent = useMonitorAgent();
  const menuFor = (agent: RunningAgent) =>
    agentMenuItems(agent.id, {
      pinned: Boolean(metaMap[agent.id]?.pinned),
      togglePinned: () => togglePinned(agent.id),
      rename: () => startRename(agent),
      branch: () => void branchAgent(agent.id),
      monitor: () => monitorAgent(agent.id),
      end: () => void deleteAgent(agent.id),
      ending: deletingAgentId === agent.id,
    });

  // The area's ⋯ acts on the agent whose chat is open.
  const selected = routeAgentId ? agentList.find(agent => agent.id === routeAgentId) : undefined;
  usePanelMenu(selected ? { label: agentSessionTitle(selected, metaMap), items: menuFor(selected) } : null);

  // Ctrl/⌘+⌫ ends the agent whose chat is open. Not `allowInEditable`: in the chat composer
  // (or any input / Monaco / xterm) the same chord is the platform's word/line delete.
  useKeyboardShortcuts([
    {
      key: "Backspace",
      enabled: panel.isVisible && !confirmOpen && routeAgentId !== null,
      handler: () => {
        if (routeAgentId) void deleteAgent(routeAgentId);
      },
    },
  ]);

  return (
    <ViewShell tone="sidebar" scroll={false} footer={<AgentJobsLink />}>
      <div className="h-full overflow-y-auto py-1">
        {agentList.length > 3 && (
          <div className="flex items-center gap-1.5 mx-2 my-1.5 px-2 py-1 rounded-md bg-tertiary border border-control">
            <Search className="w-3 h-3 shrink-0 text-muted" aria-hidden="true" />
            <input
              type="text"
              value={sessionQuery}
              onChange={event => setSessionQuery(event.target.value)}
              placeholder="Filter sessions…"
              aria-label="Filter running sessions"
              className="w-full min-w-0 bg-transparent text-xs text-primary placeholder-muted outline-none"
            />
            {sessionQuery && (
              <button
                type="button"
                onClick={() => setSessionQuery("")}
                className="p-0.5 text-muted hover:text-primary rounded focus-ring"
                aria-label="Clear session filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {agents.isLoading && agentList.length === 0 ? (
          <LoadingState size="sm" className="py-6" />
        ) : agents.error && agentList.length === 0 ? (
          <ErrorState title="Failed to load agents" error={agents.error} onRetry={() => void agents.mutate()} variant="inline" />
        ) : agentList.length === 0 ? (
          <EmptyState
            title="No agents running"
            variant="inline"
            action={
              <button type="button" onClick={openLaunch} className="text-xs text-accent-soft hover:underline focus-ring rounded cursor-pointer">
                Launch an agent
              </button>
            }
          />
        ) : sortedAgents.length === 0 ? (
          <EmptyState title={`No sessions match “${sessionQuery.trim()}”`} variant="inline" />
        ) : (
          <ul aria-label="Running agents">
            {nestSubAgents(sortedAgents).map(({ agent, depth }) => {
              const parent = depth > 0 ? agentList.find(candidate => candidate.id === agent.parentAgentId) : undefined;
              const isSelected = routeAgentId === agent.id;
              const sessionTitle = agentSessionTitle(agent, metaMap);
              const isRenaming = renamingId === agent.id;
              const pinned = Boolean(metaMap[agent.id]?.pinned);
              const statusLine = needsYou(agent) ? (
                <StatusText agent={agent} className="block truncate" />
              ) : (
                <span className="block truncate text-xs text-muted">{agentStatusLine(agent, sessionTitle)}</span>
              );
              return (
                <li
                  key={agent.id}
                  className={cn(
                    "group relative mx-1.5 my-1 rounded-md border transition-colors",
                    isSelected
                      ? "bg-active border-line"
                      : needsYou(agent)
                        ? // Waiting on an answer: the loudest row in the list.
                          "bg-warning/10 border-warning hover:bg-hover"
                        : agent.idle
                          ? "border-transparent hover:bg-hover"
                          : // Busy agents get a tint so the distinction survives a quick scan.
                            "bg-accent-tint border-accent-line hover:bg-hover",
                  )}
                  aria-current={isSelected ? "true" : undefined}
                  // Sub-agents sit under the agent that started them.
                  style={depth > 0 ? { marginLeft: `${0.375 + depth}rem` } : undefined}
                  data-depth={depth}
                >
                  <div className="flex items-start gap-1 pr-1">
                    {isRenaming ? (
                      // Not inside the link: clicks in the field must not open the chat.
                      <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
                        <input
                          type="text"
                          autoFocus
                          value={renameDraft}
                          onChange={event => setRenameDraft(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === "Enter") commitRename(agent.id);
                            if (event.key === "Escape") cancelRename();
                          }}
                          aria-label="Rename session"
                          title="Session names are saved in this browser only"
                          className="w-full min-w-0 bg-tertiary border border-primary rounded px-1.5 py-0.5 text-sm text-primary outline-none focus-ring"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(agent.id)}
                          className="p-0.5 text-success rounded focus-ring shrink-0"
                          aria-label="Save session title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-0.5 text-muted hover:text-error rounded focus-ring shrink-0"
                          aria-label="Cancel renaming"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <PaneLink
                        view={CHAT_VIEW}
                        params={{ agentId: agent.id }}
                        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left cursor-pointer focus-ring"
                        aria-label={`${openAgentLabel(agent, sessionTitle)}${parent ? `, sub-agent of ${agentSessionTitle(parent, metaMap)}` : ""}`}
                      >
                        {depth > 0 && <CornerDownRight className="mt-1 -mr-1 h-3 w-3 shrink-0 text-dim" aria-hidden="true" />}
                        <span className="mt-1">
                          <StatusIcon agent={agent} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={cn("min-w-0 truncate text-sm font-medium", isSelected ? "text-primary" : "text-secondary")}>{sessionTitle}</span>
                            {pinned && <Pin className="h-3 w-3 shrink-0 text-accent" aria-label="Pinned" />}
                          </span>
                          {statusLine}
                        </span>
                      </PaneLink>
                    )}
                    <span className="mt-1.5">
                      <RowMenu title={sessionTitle} items={menuFor(agent)} />
                    </span>
                  </div>
                  {isRenaming && <p className="px-2 pb-1.5 text-[10px] text-dim">Session names are saved in this browser only.</p>}
                  {/* Todos sit outside the card link so the mobile collapse toggle is not nested inside it. */}
                  <AgentTodoList
                    agentId={agent.id}
                    agentName={sessionTitle}
                    onSelect={() => openAgent(agent.id)}
                    collapsibleOnMobile
                    className="mx-2 mb-1.5 ml-7 border-t border-line-subtle pt-1.5"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
