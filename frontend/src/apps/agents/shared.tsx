import { MessageCircleQuestion, Pause } from "lucide-react";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import type { AgentInstallSource } from "../../features/agents/AgentTypeEditor.tsx";
import { agentSessionTitle, useAgentSessionMetaMap } from "../../hooks/agentSessionMetaStore.ts";
import { AGENT_STATUS_LABEL, agentStatus } from "../../lib/agentSessions.ts";
import { cn } from "../../lib/utils.ts";

/**
 * Vocabulary shared by the Agents app views (list, start page, type
 * editor). Each view is its own React subtree, so anything they
 * share lives here or in small stores rather than in component state.
 */

export const AGENTS_APP_ID = "agents";
/** Absolute paths, for links from other apps (Home's welcome and quick launch). */
export const AGENTS_PATH = "/agents";
/** Community agents are browsed and installed in the Marketplace app. */
export const MARKETPLACE_PATH = "/marketplace/agent";
export const NEW_AGENT_PATH = "/agents/new";

/** The sidebar's tabs: running agents, saved checkpoints, and launching a new agent. */
export const AGENT_LIST_VIEW = "agent-list";
export const AGENT_CHECKPOINTS_VIEW = "agent-checkpoints";
export const AGENT_LAUNCH_VIEW = "agent-launch";
/** The app root: start an agent, or pick a type to view. Retires once a chat opens. */
export const AGENTS_START_VIEW = "agents-start";
export const AGENT_TYPE_DETAIL_VIEW = "agent-type-detail";
export const AGENT_TYPE_CREATE_VIEW = "agent-type-create";
/** Every unattended agent job, at `/agents/jobs` (`?job=<id>` opens one). */
export const AGENT_JOBS_VIEW = "agent-jobs";

/** Fallback group for agent types whose config omits a category. */
export const UNCATEGORIZED = "Uncategorized";

/** Shown next to the actions they trigger. */
export const LAUNCH_SHORTCUT = "Ctrl/⌘+Enter";
export const DELETE_SHORTCUT = "Ctrl/⌘+⌫";

/** Bundled types come from configuration and are read-only; workspace types are editable files. */
export type AgentSource = "bundled" | "workspace";

export interface AgentType {
  type: string;
  displayName: string;
  description: string;
  category?: string;
  enabledTools?: string[];
  source?: AgentSource;
  installedFrom?: AgentInstallSource;
}

export interface RunningAgent {
  id: string;
  createdAt: number;
  agentType: string;
  displayName: string;
  description: string;
  idle: boolean;
  currentActivity: string;
  /** Questions the agent is blocked on until a person answers them. */
  pendingQuestions?: number;
  /** Its first prompt to the model, shortened (its default name). */
  title?: string;
  /** Set on sub-agents: the agent that started this one. */
  parentAgentId?: string;
}

/** True when the agent can't go on until someone answers it. */
export function needsYou(agent: RunningAgent): boolean {
  return (agent.pendingQuestions ?? 0) > 0;
}

/** Agents waiting on you first, then working ones, then idle; newest first within each (shared with every agent list). */
export { sortRunningAgents } from "../../lib/agentSessions.ts";

export function matchesTypeFilter(agentType: AgentType, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    agentType.displayName.toLowerCase().includes(q) ||
    agentType.type.toLowerCase().includes(q) ||
    agentType.description.toLowerCase().includes(q) ||
    agentType.category?.toLowerCase().includes(q) ||
    false
  );
}

export function typeName(agentType: AgentType): string {
  return agentType.displayName || agentType.type;
}

export function sourceOf(agentType: AgentType | null | undefined): AgentSource {
  return agentType?.source ?? "bundled";
}

/** Status is carried by text as well as colour/motion, so it survives greyscale and screen readers. */
export function statusLabel(agent: RunningAgent): string {
  return AGENT_STATUS_LABEL[agentStatus(agent)];
}

export function openAgentLabel(agent: RunningAgent, title = agent.displayName): string {
  return `Open agent ${title}, ${statusLabel(agent).replace("…", "").toLowerCase()}`;
}

export function StatusIcon({ agent, size = "sm" }: { agent: RunningAgent; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <span className="shrink-0 inline-flex" aria-hidden="true">
      {needsYou(agent) ? (
        <MessageCircleQuestion className={cn(dimension, "text-warning")} />
      ) : agent.idle ? (
        <Pause className={cn(dimension, "text-muted")} />
      ) : (
        <BusySpinner className={dimension} />
      )}
    </span>
  );
}

export function StatusText({ agent, className }: { agent: RunningAgent; className?: string }) {
  return (
    <span className={cn("shrink-0 text-xs font-medium", needsYou(agent) ? "text-warning" : agent.idle ? "text-muted" : "text-accent-soft", className)}>
      {statusLabel(agent)}
    </span>
  );
}

/** Amber-tinted count pill used for the running-agent totals. Only one instance should be `live`. */
export function RunningCountBadge({ count, live = false, className }: { count: number; live?: boolean; className?: string }) {
  return (
    <span
      className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium bg-accent-tint text-accent-soft", className)}
      aria-live={live ? "polite" : undefined}
    >
      {count} running
    </span>
  );
}

/** Card for one running agent, used on a type's detail page. Named like the sidebar and chat tab (session title). */
export function RunningAgentCard({ agent, onOpen }: { agent: RunningAgent; onOpen: () => void }) {
  const title = agentSessionTitle(agent, useAgentSessionMetaMap());
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex items-center gap-2.5 min-w-0 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer focus-ring",
        agent.idle ? "bg-surface border-line hover:bg-hover hover:border-line-strong" : "bg-accent-tint border-accent-line hover:bg-hover",
      )}
      aria-label={openAgentLabel(agent, title)}
    >
      <StatusIcon agent={agent} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{title}</span>
          <StatusText agent={agent} />
        </span>
        <span className="block truncate text-xs text-muted">{agent.currentActivity || agent.agentType}</span>
      </span>
    </button>
  );
}

/** Marks a workspace agent so it is obvious at a glance which rows can be edited. */
export function SourceDot({ source }: { source: AgentSource }) {
  if (source !== "workspace") return null;
  return <span role="img" aria-label="Workspace agent" title="Editable workspace agent" className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />;
}
