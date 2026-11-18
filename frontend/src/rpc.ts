import AgentJobsRpcSchema from "@tokenring-ai/agent/rpc/jobs.schema";
import AgentRpcSchema from "@tokenring-ai/agent/rpc/schema";
import AIClientRpcSchema from "@tokenring-ai/ai-client/rpc/schema";
import ConfigRpcSchema from "@tokenring-ai/app/rpc/configSchema";
import AppRpcSchema from "@tokenring-ai/app/rpc/schema";
import AudioRpcSchema from "@tokenring-ai/audio/rpc/schema";
import BlogRpcSchema from "@tokenring-ai/blog/rpc/schema";
import BotRpcSchema from "@tokenring-ai/bot/rpc/schema";
import BrowserRpcSchema from "@tokenring-ai/browser/rpc/schema";
import CalendarRpcSchema from "@tokenring-ai/calendar/rpc/schema";
import ChatRpcSchema from "@tokenring-ai/chat/rpc/schema";
import CheckpointRpcSchema from "@tokenring-ai/checkpoint/rpc/schema";
import CloudQuoteRpcSchema from "@tokenring-ai/cloudquote/rpc/schema";
import DashboardRpcSchema from "@tokenring-ai/dashboard/rpc/schema";
import DatabaseRpcSchema from "@tokenring-ai/database/rpc/schema";
import type { FilterOperator as DatabaseFilterOperator } from "@tokenring-ai/database/types";
import EmailRpcSchema from "@tokenring-ai/email/rpc/schema";
import RemoteRpcSchema from "@tokenring-ai/filesystem/rpc/remote.schema";
import FileSystemRpcSchema from "@tokenring-ai/filesystem/rpc/schema";
import GitHubRpcSchema from "@tokenring-ai/github/rpc/schema";
import GoalRpcSchema from "@tokenring-ai/goal/rpc/schema";
import GoogleRpcSchema from "@tokenring-ai/google/rpc/schema";
import ImageGenerationRpcSchema from "@tokenring-ai/image/rpc/schema";
import LifecycleRpcSchema from "@tokenring-ai/lifecycle/rpc/schema";
import MarketplaceRpcSchema from "@tokenring-ai/marketplace/rpc/schema";
import MediaLibraryRpcSchema from "@tokenring-ai/media-library/rpc/schema";
import MemoryRpcSchema from "@tokenring-ai/memory/rpc/schema";
import MetricsRpcSchema from "@tokenring-ai/metrics/rpc/schema";
import MonitorRpcSchema from "@tokenring-ai/monitor/rpc/schema";
import NewsletterRpcSchema from "@tokenring-ai/newsletter/rpc/schema";
import NewsRPMRpcSchema from "@tokenring-ai/newsrpm/rpc/schema";
import type { IndexedDataSearch } from "@tokenring-ai/newsrpm/schema";
import QueueRpcSchema from "@tokenring-ai/queue/rpc/schema";
import RedditRpcSchema from "@tokenring-ai/reddit/rpc/schema";
import ResearchRpcSchema from "@tokenring-ai/research/rpc/schema";
import SchedulerRpcSchema from "@tokenring-ai/scheduler/rpc/schema";
import SkillsRpcSchema from "@tokenring-ai/skills/rpc/schema";
import TasksRpcSchema from "@tokenring-ai/tasks/rpc/schema";
import TerminalRpcSchema from "@tokenring-ai/terminal/rpc/schema";
import TodoRpcSchema from "@tokenring-ai/todo/rpc/schema";
import { arrayableToArray } from "@tokenring-ai/utility/array/arrayable";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import VaultRpcSchema from "@tokenring-ai/vault/rpc/schema";
import VideoRpcSchema from "@tokenring-ai/video/rpc/schema";
import WebDesignRpcSchema from "@tokenring-ai/web-design/rpc/schema";
import createWsRPCClient from "@tokenring-ai/web-host/createWsRPCClient";
import UsersRpcSchema from "@tokenring-ai/web-host/rpc/schema";
import WorkflowRpcSchema from "@tokenring-ai/workflow/rpc/schema";
import XRpcSchema from "@tokenring-ai/x/rpc/schema";
import { useCallback, useRef, useSyncExternalStore } from "react";
import useSWR, { type Fetcher, type Key, type SWRConfiguration, type SWRResponse } from "swr";
import { getAgentListSnapshot, refreshAgentList, subscribeAgentList } from "./hooks/agentListStore.ts";
import { useAgentStatusStream, useRPCStreamSWR } from "./hooks/useRPCStreamSWR.ts";
import { getSignedInUsername, rpcAuth, subscribeSignedInUsername } from "./rpcAuth.ts";

export function useTypedSWR<Data = unknown, Err extends Error = Error, SWRKey extends Key = Key>(
  key: SWRKey,
  fetcher: Fetcher<Data, SWRKey> | null,
  config?: SWRConfiguration<Data, Err, Fetcher<Data, SWRKey>>,
): SWRResponse<Data, Err> {
  return useSWR<Data, Err, SWRKey>(key, fetcher, config);
}

const baseURL = new URL("/rpc:ws", window.location.origin);

export const agentRPCClient = createWsRPCClient(baseURL, AgentRpcSchema, rpcAuth);
export const agentJobsRPCClient = createWsRPCClient(baseURL, AgentJobsRpcSchema, rpcAuth);
export const audioRPCClient = createWsRPCClient(baseURL, AudioRpcSchema, rpcAuth);
export const blogRPCClient = createWsRPCClient(baseURL, BlogRpcSchema, rpcAuth);
export const newsletterRPCClient = createWsRPCClient(baseURL, NewsletterRpcSchema, rpcAuth);
export const botRPCClient = createWsRPCClient(baseURL, BotRpcSchema, rpcAuth);
export const browserRPCClient = createWsRPCClient(baseURL, BrowserRpcSchema, rpcAuth);
export const imageGenerationRPCClient = createWsRPCClient(baseURL, ImageGenerationRpcSchema, rpcAuth);
export const videoGenerationRPCClient = createWsRPCClient(baseURL, VideoRpcSchema, rpcAuth);
export const appRPCClient = createWsRPCClient(baseURL, AppRpcSchema, rpcAuth);
export const cloudquoteRPCClient = createWsRPCClient(baseURL, CloudQuoteRpcSchema, rpcAuth);
export const dashboardRPCClient = createWsRPCClient(baseURL, DashboardRpcSchema, rpcAuth);
export const newsrpmRPCClient = createWsRPCClient(baseURL, NewsRPMRpcSchema, rpcAuth);
export const aiRPCClient = createWsRPCClient(baseURL, AIClientRpcSchema, rpcAuth);
export const chatRPCClient = createWsRPCClient(baseURL, ChatRpcSchema, rpcAuth);
export const checkpointRPCClient = createWsRPCClient(baseURL, CheckpointRpcSchema, rpcAuth);
export const filesystemRPCClient = createWsRPCClient(baseURL, FileSystemRpcSchema, rpcAuth);
export const remoteRPCClient = createWsRPCClient(baseURL, RemoteRpcSchema, rpcAuth);
export const githubRPCClient = createWsRPCClient(baseURL, GitHubRpcSchema, rpcAuth);
export const goalRPCClient = createWsRPCClient(baseURL, GoalRpcSchema, rpcAuth);
export const googleRPCClient = createWsRPCClient(baseURL, GoogleRpcSchema, rpcAuth);
export const lifecycleRPCClient = createWsRPCClient(baseURL, LifecycleRpcSchema, rpcAuth);
export const marketplaceRPCClient = createWsRPCClient(baseURL, MarketplaceRpcSchema, rpcAuth);
export const mediaLibraryRPCClient = createWsRPCClient(baseURL, MediaLibraryRpcSchema, rpcAuth);
export const workflowRPCClient = createWsRPCClient(baseURL, WorkflowRpcSchema, rpcAuth);
export const calendarRPCClient = createWsRPCClient(baseURL, CalendarRpcSchema, rpcAuth);
export const webDesignRPCClient = createWsRPCClient(baseURL, WebDesignRpcSchema, rpcAuth);
export const emailRPCClient = createWsRPCClient(baseURL, EmailRpcSchema, rpcAuth);
export const terminalRPCClient = createWsRPCClient(baseURL, TerminalRpcSchema, rpcAuth);
export const vaultRPCClient = createWsRPCClient(baseURL, VaultRpcSchema, rpcAuth);
export const tasksRPCClient = createWsRPCClient(baseURL, TasksRpcSchema, rpcAuth);
export const metricsRPCClient = createWsRPCClient(baseURL, MetricsRpcSchema, rpcAuth);
export const monitorRPCClient = createWsRPCClient(baseURL, MonitorRpcSchema, rpcAuth);
export const schedulerRPCClient = createWsRPCClient(baseURL, SchedulerRpcSchema, rpcAuth);
export const queueRPCClient = createWsRPCClient(baseURL, QueueRpcSchema, rpcAuth);
export const skillsRPCClient = createWsRPCClient(baseURL, SkillsRpcSchema, rpcAuth);
export const todoRPCClient = createWsRPCClient(baseURL, TodoRpcSchema, rpcAuth);
export const researchRPCClient = createWsRPCClient(baseURL, ResearchRpcSchema, rpcAuth);
export const memoryRPCClient = createWsRPCClient(baseURL, MemoryRpcSchema, rpcAuth);
export const configRPCClient = createWsRPCClient(baseURL, ConfigRpcSchema, rpcAuth);
export const databaseRPCClient = createWsRPCClient(baseURL, DatabaseRpcSchema, rpcAuth);
export const xRPCClient = createWsRPCClient(baseURL, XRpcSchema, rpcAuth);
export const redditRPCClient = createWsRPCClient(baseURL, RedditRpcSchema, rpcAuth);
export const usersRPCClient = createWsRPCClient(baseURL, UsersRpcSchema, rpcAuth);

/**
 * Registered agent commands (name, description, inputSchema).
 * Pass an agent id for the agent-scoped view, or omit to list the app-level registry
 * (used by the workflow editor when no agent is open).
 */
export function useAvailableCommands(agentId?: string | null) {
  const key = agentId ? `/agent/getAvailableCommands/${agentId}` : "/agent/getAvailableCommands";
  return useTypedSWR(key, async () => {
    const result = await agentRPCClient.getAvailableCommands(agentId ? { agentId } : {});
    return result.status === "success" ? result.commands : null;
  });
}

export function useCommandHistory(agentId: string) {
  return useTypedSWR(agentId ? `/agent/getCommandHistory/${agentId}` : null, async () => {
    const result = await agentRPCClient.getCommandHistory({ agentId });
    return result.status === "success" ? result.history : null;
  });
}

/**
 * Live agent list, backed by a single shared stream (see `agentListStore`).
 *
 * Many components call this hook at once; the store runs exactly one
 * `streamAgents` subscription for the whole app and fans the latest snapshot
 * out to every caller, so the backend keeps a single listener instead of one
 * per component. The returned shape matches `useRPCStreamSWR` so call sites are
 * unchanged.
 */
export function useAgentList() {
  const { data, error, isConnecting } = useSyncExternalStore(subscribeAgentList, getAgentListSnapshot);
  const mutate = useCallback(() => refreshAgentList(), []);
  return {
    data,
    error: error ? new Error(error) : undefined,
    isLoading: isConnecting && data === undefined,
    isValidating: isConnecting,
    mutate,
  };
}

export function useTerminalConfiguration() {
  return useTypedSWR("/terminal/getTerminalConfiguration", () => terminalRPCClient.getTerminalConfiguration({}));
}

export function useTerminalList(agentId?: string) {
  return useRPCStreamSWR({
    key: agentId ? `terminals:${agentId}` : "terminals",
    subscribe: signal => terminalRPCClient.streamTerminals(stripUndefinedKeys({ agentId }), signal),
  });
}

export function useModel(agentId: string) {
  return useAgentStatusStream(agentId ? `model:${agentId}` : null, signal => chatRPCClient.streamModel({ agentId }, signal));
}

export function useAgentTypes() {
  return useTypedSWR(`/agentTypes`, () => agentRPCClient.getAgentTypes({}));
}

/** The full body of one agent type — fetched on demand, since the type list carries only a summary. */
export function useAgentTypeDetail(type: string | null | undefined) {
  return useTypedSWR(type ? `/agent/getAgentTypeDetail/${type}` : null, async () => {
    const result = await agentRPCClient.getAgentTypeDetail({ type: type! });
    if (result.status === "agentTypeNotFound") throw new Error(`Agent type "${type}" not found`);
    return result;
  });
}

/** The marketplace registry index. Pass `enabled: false` to keep the app off the network. */
export function useMarketplaceItems(enabled: boolean) {
  return useTypedSWR(enabled ? "/marketplace/listMarketplaceItems" : null, () => marketplaceRPCClient.listMarketplaceItems({ refresh: false }));
}

export function useMarketplaceItem(id: string | null | undefined) {
  return useTypedSWR(id ? `/marketplace/getMarketplaceItem/${id}` : null, () => marketplaceRPCClient.getMarketplaceItem({ id: id! }));
}

/** What unattended runs may do under this installation's limits: for the schedule and queue forms. */
export function useJobPolicy() {
  return useTypedSWR("/agent-jobs/getJobPolicy", () => agentJobsRPCClient.getJobPolicy({}));
}

export function useWorkflows() {
  return useTypedSWR("/workflow/listWorkflows", () => workflowRPCClient.listWorkflows({}));
}

/** Everything the debugger can capture right now: the app itself plus each running agent. */
export function useDebugTargets() {
  return useTypedSWR("/app/listDebugTargets", async () => (await appRPCClient.listDebugTargets({})).targets, { refreshInterval: 5000 });
}

/** Snapshot files already written to `<workspaceDirectory>/debug`, newest first. */
export function useDebugSnapshots() {
  return useTypedSWR("/app/listDebugSnapshots", async () => (await appRPCClient.listDebugSnapshots({})).snapshots);
}

/** Live recorder status, so the record button reflects captures made elsewhere. */
export function useDebugRecording() {
  return useRPCStreamSWR({
    key: "debug-recording",
    subscribe: signal => appRPCClient.streamDebugRecording({}, signal),
  });
}

/** How many job records the jobs view follows; the engine keeps the newest 1000. */
const AGENT_JOBS_LIMIT = 500;

/**
 * Unattended agent jobs across every plugin (queue, tasks, workflow, scheduler), newest first,
 * live. Unfiltered on purpose: the view filters locally so a job's parent and children stay known.
 */
export function useAgentJobs() {
  return useRPCStreamSWR({
    key: "agent-jobs",
    subscribe: signal => agentJobsRPCClient.streamJobs({ limit: AGENT_JOBS_LIMIT }, signal),
  });
}

/** Spend and outcomes of unattended jobs over the last `days` days, grouped as asked; refreshes every 30 seconds. */
export function useJobRollup(options: { days: number; groupBy: "schedule" | "queue" | "workflow" | "day" | "owner"; owner?: string }) {
  const { days, groupBy, owner } = options;
  return useTypedSWR(
    `/agent-jobs/getJobRollup/${groupBy}/${days}/${owner ?? ""}`,
    () => agentJobsRPCClient.getJobRollup(stripUndefinedKeys({ days, groupBy, owner })),
    { refreshInterval: 30_000 },
  );
}

/** Agents' browser sessions, live: their tabs, who is using them, and when they were last used. */
export function useBrowserSessions() {
  return useRPCStreamSWR({
    key: "browser-sessions",
    subscribe: signal => browserRPCClient.streamSessions({}, signal),
  });
}

/** Live view of every tracked workflow run: which agent is running it and which step it is on. */
export function useWorkflowRuns() {
  return useRPCStreamSWR({
    key: "workflow-runs",
    subscribe: signal => workflowRPCClient.streamWorkflowRuns({}, signal),
  });
}

export function useTaskConfiguration() {
  return useTypedSWR("/tasks/getTaskConfiguration", () => tasksRPCClient.getTaskConfiguration({}));
}

/** Every task board with its task counts. */
export function useTaskBoards() {
  return useRPCStreamSWR({
    key: "task-boards",
    subscribe: signal => tasksRPCClient.streamBoards({}, signal),
  });
}

/** One board's settings and its tasks, live. */
export function useTaskBoard(boardId: string | null) {
  return useRPCStreamSWR({
    key: `task-board:${boardId}`,
    enabled: boardId !== null,
    subscribe: signal => tasksRPCClient.streamBoard({ board: boardId! }, signal),
  });
}

/** One board's settings (title, icon, columns, automation) without its tasks, live. */
export function useTaskBoardSettings(boardId: string) {
  return useRPCStreamSWR({
    key: `task-board-settings:${boardId}`,
    subscribe: signal => tasksRPCClient.streamBoardSettings({ board: boardId }, signal),
  });
}

/** One task including its markdown body, live. */
export function useTaskDetail(boardId: string, taskId: string) {
  return useRPCStreamSWR({
    key: `task:${boardId}/${taskId}`,
    subscribe: signal => tasksRPCClient.streamTask({ board: boardId, taskId }, signal),
  });
}

/** A task's comments, agent reports and events, live. */
export function useTaskActivity(boardId: string, taskId: string) {
  return useRPCStreamSWR({
    key: `task-activity:${boardId}/${taskId}`,
    subscribe: signal => tasksRPCClient.streamActivity({ board: boardId, taskId }, signal),
  });
}

/** Running and recently finished agent dispatches across every board. */
export function useTaskDispatches() {
  return useRPCStreamSWR({
    key: "task-dispatches",
    subscribe: signal => tasksRPCClient.streamDispatches({}, signal),
  });
}

export function useDefaultDirectories() {
  return useTypedSWR("/filesystem/getDefaultDirectories", () => filesystemRPCClient.getDefaultDirectories({}));
}

export function useFilesystemState(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `filesystem:${agentId}` : null, signal => filesystemRPCClient.streamFilesystemState({ agentId: agentId! }, signal));
}

export function useDirectoryListing(opts?: { path: string; showHidden?: boolean; showIgnored?: boolean }) {
  return useTypedSWR(opts ? `/filesystem/listDirectory/${opts.path}/${opts.showHidden ?? false}/${opts.showIgnored ?? true}` : null, () =>
    filesystemRPCClient.listDirectory({
      path: opts!.path,
      recursive: false,
      showHidden: opts!.showHidden ?? false,
      // gitignore=true asks the backend to drop .gitignore/.aiignore matches.
      gitignore: !(opts!.showIgnored ?? true),
    }),
  );
}

export function useFileContents(path: string | undefined) {
  return useTypedSWR(path ? `/filesystem/getFileContents/${path}` : null, () => filesystemRPCClient.readTextFile({ path: path! }));
}

export function useWorkspaceFileSearch(opts?: { query: string; limit?: number; showIgnored?: boolean }) {
  const query = opts?.query.trim() ?? "";
  const limit = opts?.limit ?? 48;
  return useTypedSWR(opts && query ? `/filesystem/searchWorkspaceFiles/${query}/${limit}/${opts.showIgnored ?? true}` : null, () =>
    filesystemRPCClient.searchWorkspaceFiles({
      query,
      limit,
      gitignore: !(opts!.showIgnored ?? true),
    }),
  );
}

export function useRemoteMounts() {
  return useTypedSWR("/remote/listMounts", () => remoteRPCClient.listMounts({}));
}

export function useRemoteEntry(url: string | null) {
  return useTypedSWR(url ? `/remote/stat/${url}` : null, () => remoteRPCClient.stat({ url: url! }));
}

/** First page of a remote folder; `cursor` fetches a later page. */
export function useRemoteListing(url: string | null, cursor?: string) {
  return useTypedSWR(url ? `/remote/list/${url}/${cursor ?? ""}` : null, () =>
    remoteRPCClient.list(cursor === undefined ? { url: url! } : { url: url!, cursor }),
  );
}

/** Searches one mount (`within` is its URL); a blank query fetches nothing. */
export function useRemoteSearch(query: string, within: string | null) {
  const trimmed = query.trim();
  return useTypedSWR(trimmed && within ? `/remote/search/${within}/${trimmed}` : null, () =>
    remoteRPCClient.search({ query: trimmed, within: within!, limit: 50 }),
  );
}

export function useRemoteContent(url: string | null) {
  return useTypedSWR(url ? `/remote/read/${url}` : null, () => remoteRPCClient.read({ url: url! }));
}

export function useChatModelsByProvider() {
  return useTypedSWR(`/ai-client/chatModelsByProvider`, () => aiRPCClient.listChatModelsByProvider({}));
}

export function useEmbeddingModelsByProvider() {
  return useTypedSWR(`/ai-client/embeddingModelsByProvider`, () => aiRPCClient.listEmbeddingModelsByProvider({}));
}

export function useTranscriptionModelsByProvider() {
  return useTypedSWR(`/ai-client/transcriptionModelsByProvider`, () => aiRPCClient.listTranscriptionModelsByProvider({}));
}

export function useRerankingModelsByProvider() {
  return useTypedSWR(`/ai-client/rerankingModelsByProvider`, () => aiRPCClient.listRerankingModelsByProvider({}));
}

/**
 * Every configured model provider with its key source and live state, plus whether keys can be saved
 * (the vault is unlocked). The server polls every few seconds, so a local server that comes up later shows.
 */
export function useProviderStatuses() {
  return useRPCStreamSWR({
    key: "ai-providers",
    subscribe: signal => aiRPCClient.streamProviders({}, signal),
  });
}

export function useAvailableTools() {
  return useTypedSWR(`/chat/getAvailableTools`, () => chatRPCClient.getAvailableTools({}));
}

export function useToolDirectory() {
  return useTypedSWR(`/chat/getToolDirectory`, () => chatRPCClient.getToolDirectory({}));
}

export function useToolDefinitions() {
  return useTypedSWR(`/chat/listToolDefinitions`, () => chatRPCClient.listToolDefinitions({}));
}

export function useToolDefinition(name: string | null) {
  return useTypedSWR(name ? `/chat/getToolDefinition/${name}` : null, () => chatRPCClient.getToolDefinition({ name: name! }));
}

export function useEnabledTools(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `enabled-tools:${agentId}` : null, signal => chatRPCClient.streamEnabledTools({ agentId: agentId! }, signal));
}

export function useToolApprovalLevels() {
  return useTypedSWR(`/chat/getToolApprovalLevels`, () => chatRPCClient.getToolApprovalLevels({}));
}

/** Standing "always allow" permissions, live, with the highest level a grant can cover. */
export function usePermissionGrants() {
  return useRPCStreamSWR({
    key: "permission-grants",
    subscribe: signal => chatRPCClient.streamPermissionGrants({}, signal),
  });
}

export function useToolApproval(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `tool-approval:${agentId}` : null, signal => chatRPCClient.streamToolApproval({ agentId: agentId! }, signal));
}

export function useChatUsage(agentId: string) {
  return useAgentStatusStream(agentId ? `chat-usage:${agentId}` : null, signal => chatRPCClient.streamChatUsage({ agentId }, signal));
}

export function useTodos(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `todos:${agentId}` : null, signal => todoRPCClient.streamTodos({ agentId: agentId! }, signal));
}

export function useGoal(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `goal:${agentId}` : null, signal => goalRPCClient.streamGoal({ agentId: agentId! }, signal));
}

export function useAvailableHooks() {
  return useTypedSWR(`/lifecycle/getAvailableHooks`, () => lifecycleRPCClient.getAvailableHooks({}));
}

export function useEnabledHooks(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `enabled-hooks:${agentId}` : null, signal => lifecycleRPCClient.streamEnabledHooks({ agentId: agentId! }, signal));
}

export function useSkills(agentId?: string) {
  return useTypedSWR(
    agentId ? `/skills/listSkills/${agentId}` : "/skills/listSkills",
    async () => {
      const result = await skillsRPCClient.listSkills(stripUndefinedKeys({ agentId, includeDisabled: true }));
      if (result.status === "agentNotFound") {
        throw new Error(`Agent not found: ${agentId}`);
      }
      return result;
    },
    { refreshInterval: 10000 },
  );
}

export function useEnabledSkills(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `enabled-skills:${agentId}` : null, signal => skillsRPCClient.streamEnabledSkills({ agentId: agentId! }, signal));
}

export function useStockQuote(symbols: string[]) {
  const key = symbols.length ? `/cloudquote/getQuote/${symbols.join(",")}` : null;
  return useTypedSWR(key, () => cloudquoteRPCClient.getQuote({ symbols }), { refreshInterval: 30000 });
}

/**
 * Live quote rows shared per symbol set: every panel asking for the same
 * symbols reads ONE backend subscription that polls upstream (~15s) and pushes
 * on change. Consume `LiveStatusBadge` with `useLiveStreamStatusFromSWR`.
 */
export function useStockQuotesStream(symbols: string[]) {
  const key = symbols.length ? `cloudquote:quotes:${[...symbols].sort().join(",")}` : null;
  return useRPCStreamSWR({
    key,
    subscribe: signal => cloudquoteRPCClient.streamQuotes({ symbols }, signal),
  });
}

export function useStockPriceHistory(symbol: string | undefined, from?: string, to?: string) {
  return useTypedSWR(symbol ? `/cloudquote/getPriceHistory/${symbol}/${from ?? ""}/${to ?? ""}` : null, () =>
    cloudquoteRPCClient.getPriceHistory(stripUndefinedKeys({ symbol: symbol!, from, to })),
  );
}

export function useStockPriceTicks(symbol: string | undefined) {
  return useTypedSWR(symbol ? `/cloudquote/getPriceTicks/${symbol}` : null, () => cloudquoteRPCClient.getPriceTicks({ symbol: symbol! }), {
    refreshInterval: 60000,
  });
}

export function useStockLeaders(
  list: "MOSTACTIVE" | "PERCENTGAINERS" | "PERCENTLOSERS",
  limit = 10,
  filters?: { type?: "STOCK" | "ETF"; minPrice?: number; maxPrice?: number },
) {
  const filterKey = filters ? `${filters.type ?? ""}/${filters.minPrice ?? ""}/${filters.maxPrice ?? ""}` : "";
  return useTypedSWR(
    `/cloudquote/getLeaders/${list}/${limit}/${filterKey}`,
    () =>
      cloudquoteRPCClient.getLeaders(
        stripUndefinedKeys({
          list,
          limit,
          type: filters?.type,
          minPrice: filters?.minPrice,
          maxPrice: filters?.maxPrice,
        }),
      ),
    { refreshInterval: 60000 },
  );
}

export function useStockHeadlines(symbols: string | undefined, count = 25) {
  return useTypedSWR(symbols ? `/cloudquote/getHeadlinesBySecurity/${symbols}/${count}` : null, () =>
    cloudquoteRPCClient.getHeadlinesBySecurity(stripUndefinedKeys({ symbols: symbols!, count })),
  );
}

export function useFindStock(search: string | undefined, limit = 10) {
  const trimmed = search?.trim();
  return useTypedSWR(trimmed ? `/cloudquote/findStock/${trimmed}/${limit}` : null, () => cloudquoteRPCClient.findStock({ search: trimmed!, limit }), {
    dedupingInterval: 300,
  });
}

export function useNewsRPMIndexedDataSearchResults(search: IndexedDataSearch | undefined) {
  const cacheKey = search
    ? [search.key, ...arrayableToArray(search.value), search.minDate, search.maxDate, search.offset, search.count, search.order].join("|")
    : null;

  return useTypedSWR(cacheKey, () => newsrpmRPCClient.searchIndexedData(search!));
}

export function usePlugins() {
  return useTypedSWR("/app/listPlugins", () => appRPCClient.listPlugins({}));
}

export function useConfigSchema() {
  return useTypedSWR("/config/getConfigSchema", () => configRPCClient.getConfigSchema({}));
}

export function useConfigValues() {
  return useTypedSWR("/config/getConfigValues", () => configRPCClient.getConfigValues({}));
}

// ─── Users and remote access ──────────────────────────────────────────────────

/** Who this tab is signed in as, and their role. Open to every signed-in user. */
export function useMe() {
  // Keyed by the signed-in name so signing in as someone else never shows the previous person's role.
  const signedInAs = useSyncExternalStore(subscribeSignedInUsername, getSignedInUsername, getSignedInUsername);
  return useTypedSWR(["/users/getMe", signedInAs], () => usersRPCClient.getMe({}), { revalidateOnFocus: false });
}

/** Admin only: where links should point, and what is wrong with that address. */
export function useRemoteAccessInfo(enabled = true) {
  return useTypedSWR(enabled ? "/users/getRemoteAccessInfo" : null, () => usersRPCClient.getRemoteAccessInfo({}));
}

/** Admin only. */
export function useUserList(enabled = true) {
  return useTypedSWR(enabled ? "/users/listUsers" : null, () => usersRPCClient.listUsers({}));
}

/** Admin only: sign-in links that have not been used or expired. */
export function usePendingAccessLinks(enabled = true) {
  return useTypedSWR(enabled ? "/users/listAccessLinks" : null, () => usersRPCClient.listAccessLinks({}));
}

// ─── Database ─────────────────────────────────────────────────────────────────

export function useDatabaseConfiguration() {
  return useTypedSWR("/database/getDatabaseConfiguration", () => databaseRPCClient.getDatabaseConfiguration({}));
}

export function useDatabaseTables(datasource: string | undefined) {
  return useTypedSWR(datasource ? `/database/listTables/${datasource}` : null, () => databaseRPCClient.listTables({ datasource: datasource! }));
}

export function useTableSchema(datasource: string | undefined, table: string | undefined) {
  return useTypedSWR(datasource && table ? `/database/getTableSchema/${datasource}/${table}` : null, () =>
    databaseRPCClient.getTableSchema({ datasource: datasource!, table: table! }),
  );
}

export interface RowQuery {
  columns?: string[];
  filters?: { column: string; op: DatabaseFilterOperator; value?: string | number | boolean | null | (string | number)[] }[];
  orderBy?: { column: string; direction: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
}

export function useTableRows(datasource: string | undefined, table: string | undefined, query: RowQuery) {
  const enabled = Boolean(datasource && table);
  return useTypedSWR(enabled ? `/database/selectRows/${datasource}/${table}/${JSON.stringify(query)}` : null, () =>
    databaseRPCClient.selectRows(stripUndefinedKeys({ datasource: datasource!, table: table!, ...query })),
  );
}

export function useDatabaseState(agentId: string | undefined) {
  return useTypedSWR(agentId ? `/database/getDatabaseState/${agentId}` : null, () => databaseRPCClient.getDatabaseState({ agentId: agentId! }));
}

/** Cap client-side log buffer to avoid unbounded memory growth during long sessions. */
const MAX_APP_LOG_ENTRIES = 2000;

export type AppLogEntry = {
  /** Stable id derived from server log position (index into the server log buffer). */
  id: number;
  timestamp: number;
  level: "info" | "error";
  message: string;
};

export function useAppLogs(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const positionRef = useRef(0);

  // Disabling the stream (e.g. leaving the Logs tab) unsubscribes, and the last
  // subscriber leaving drops the shared buffer. A fresh buffer is seeded through
  // `initialData`, so the resume position is reset there too: re-enabling refetches
  // the server's log buffer from the start instead of resuming past logs this
  // client no longer holds. `positionRef` only carries resumes across reconnects
  // of one live buffer.
  return useRPCStreamSWR({
    key: "app-logs",
    enabled,
    initialData: () => {
      positionRef.current = 0;
      return { logs: [] as AppLogEntry[] };
    },
    subscribe: signal => appRPCClient.streamLogs({ fromPosition: positionRef.current }, signal),
    reduce: (prev, chunk) => {
      // Server position is the exclusive end index of this chunk in the server buffer.
      const startIndex = chunk.position - chunk.logs.length;
      positionRef.current = chunk.position;
      const newLogs: AppLogEntry[] = chunk.logs.map((log, i) => ({
        ...log,
        id: startIndex + i,
      }));
      const merged = [...(prev?.logs ?? []), ...newLogs];
      if (merged.length > MAX_APP_LOG_ENTRIES) {
        return { logs: merged.slice(merged.length - MAX_APP_LOG_ENTRIES) };
      }
      return { logs: merged };
    },
  });
}

export function useCheckpointList() {
  return useRPCStreamSWR({
    key: "checkpoints",
    // Request a large page so the browser can group/filter client-side until true pagination is wired in the UI.
    subscribe: signal => checkpointRPCClient.streamCheckpoints({ limit: 500 }, signal),
  });
}

/**
 * The saved checkpoints of one agent, newest first — what the restore UI
 * offers. A targeted query rather than the shared `checkpoints` stream: that
 * stream caps at one page of the global list, so an agent whose checkpoints
 * fall outside it would wrongly look like it had none. Null key disables.
 */
export function useAgentCheckpointList(agentId: string | null | undefined) {
  return useTypedSWR(agentId ? `/checkpoint/listCheckpoints/${agentId}` : null, () =>
    checkpointRPCClient.listCheckpoints({
      agentId: agentId!,
      limit: 200,
      orderBy: "createdAt",
      orderDir: "DESC",
    }),
  );
}

export function useBlogConfiguration() {
  return useTypedSWR("/blog/getBlogConfiguration", () => blogRPCClient.getBlogConfiguration({}));
}

export function useBlogPosts(provider: string | undefined, status: "all" | "draft" | "published" = "all", limit = 50) {
  return useTypedSWR(provider ? `/blog/getAllPosts/${provider}/${status}` : null, () => blogRPCClient.getAllPosts({ provider: provider!, status, limit }), {
    refreshInterval: 30000,
  });
}

export function useBlogPost(provider: string | undefined, id: string | undefined) {
  return useTypedSWR(provider && id ? `/blog/getPost/${provider}/${id}` : null, () => blogRPCClient.getPostById({ provider: provider!, id: id! }), {});
}

export function useBlogState(agentId: string | undefined) {
  return useTypedSWR(agentId ? `/blog/getBlogState/${agentId}` : null, () => blogRPCClient.getBlogState({ agentId: agentId! }));
}

// ─── Newsletter ──────────────────────────────────────────────────────────────

/** Every newsletter of every connected provider, for the Newsletters app's selector. */
export function useNewsletterOptions() {
  return useTypedSWR("/newsletter/options", async () => {
    const { providers } = await newsletterRPCClient.getNewsletterConfiguration({});
    const lists = await Promise.all(
      providers.map(async provider => ({ provider, ...(await newsletterRPCClient.listNewsletters({ provider: provider.name })) })),
    );
    return lists.flatMap(({ provider, newsletters }) =>
      newsletters.map(newsletter => ({ provider: provider.name, newsletter, supportedStatuses: provider.supportedStatuses })),
    );
  });
}

export function useNewsletterIssues(provider: string | undefined, newsletter: string | undefined) {
  return useTypedSWR(
    provider && newsletter ? `/newsletter/listIssues/${provider}/${newsletter}` : null,
    () => newsletterRPCClient.listIssues({ provider: provider!, newsletter: newsletter!, limit: 50 }),
    { refreshInterval: 30000 },
  );
}

export function useNewsletterIssue(provider: string | undefined, id: string | undefined) {
  return useTypedSWR(provider && id ? `/newsletter/getIssue/${provider}/${id}` : null, () => newsletterRPCClient.getIssue({ provider: provider!, id: id! }));
}

export function useNewsletterAudiences(provider: string | undefined, newsletter: string | undefined) {
  return useTypedSWR(provider && newsletter ? `/newsletter/listAudiences/${provider}/${newsletter}` : null, () =>
    newsletterRPCClient.listAudiences({ provider: provider!, newsletter: newsletter! }),
  );
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

/** A repository the GitHub dashboard is looking at, and the account to read it as. */
export interface GitHubRepoRef {
  owner: string;
  repo: string;
  /** Omitted (never `undefined`) so the ref spreads straight into RPC inputs. */
  account?: string;
}

export type GitHubItemState = "open" | "closed" | "all";

function githubRepoArgs(ref: GitHubRepoRef): { owner: string; repo: string; account?: string } {
  return { owner: ref.owner, repo: ref.repo, ...(ref.account ? { account: ref.account } : {}) };
}

function githubRepoKey(ref: GitHubRepoRef): string {
  return `${ref.account ?? ""}/${ref.owner}/${ref.repo}`;
}

export function useGitHubStatus(config?: { refreshInterval?: number }) {
  return useTypedSWR("/github/getStatus", () => githubRPCClient.getStatus({}), config);
}

export function useGitHubWorkspaceRepository() {
  return useTypedSWR("/github/getWorkspaceRepository", () => githubRPCClient.getWorkspaceRepository({}));
}

export function useGitHubRepositorySearch(query: string, account?: string) {
  const trimmed = query.trim();
  return useTypedSWR(trimmed ? `/github/searchRepositories/${account ?? ""}/${trimmed}` : null, () =>
    githubRPCClient.searchRepositories({ query: trimmed, limit: 10, ...(account ? { account } : {}) }),
  );
}

export function useGitHubLabels(ref: GitHubRepoRef | null) {
  return useTypedSWR(ref ? `/github/labels/${githubRepoKey(ref)}` : null, () => githubRPCClient.listLabels(githubRepoArgs(ref!)));
}

/** Issues (never pull requests) of a repository. Keys start with `/github/issues/` so writes can refresh every list at once. */
export function useGitHubIssues(ref: GitHubRepoRef | null, state: GitHubItemState = "open") {
  return useTypedSWR(ref ? `/github/issues/${githubRepoKey(ref)}/list/${state}` : null, () =>
    githubRPCClient.listIssues({ ...githubRepoArgs(ref!), state, perPage: 100, sort: "updated", order: "desc" }),
  );
}

export function useGitHubIssue(ref: GitHubRepoRef | null, issueNumber: number | undefined) {
  return useTypedSWR(ref && issueNumber ? `/github/issues/${githubRepoKey(ref)}/${issueNumber}` : null, () =>
    githubRPCClient.getIssue({ ...githubRepoArgs(ref!), issueNumber: issueNumber! }),
  );
}

export function useGitHubPullRequests(ref: GitHubRepoRef | null, state: GitHubItemState = "open") {
  return useTypedSWR(ref ? `/github/pulls/${githubRepoKey(ref)}/list/${state}` : null, () =>
    githubRPCClient.listPullRequests({ ...githubRepoArgs(ref!), state, perPage: 100, sort: "updated", direction: "desc" }),
  );
}

export function useGitHubPullRequest(ref: GitHubRepoRef | null, prNumber: number | undefined) {
  return useTypedSWR(ref && prNumber ? `/github/pulls/${githubRepoKey(ref)}/${prNumber}` : null, () =>
    githubRPCClient.getPullRequest({ ...githubRepoArgs(ref!), prNumber: prNumber! }),
  );
}

export function useGitHubPRFiles(ref: GitHubRepoRef | null, prNumber: number | undefined, page = 1) {
  return useTypedSWR(ref && prNumber ? `/github/pulls/${githubRepoKey(ref)}/${prNumber}/files/${page}` : null, () =>
    githubRPCClient.getPRFiles({ ...githubRepoArgs(ref!), prNumber: prNumber!, page, perPage: 50 }),
  );
}

export function useGitHubPRStatus(ref: GitHubRepoRef | null, prNumber: number | undefined) {
  return useTypedSWR(ref && prNumber ? `/github/pulls/${githubRepoKey(ref)}/${prNumber}/status` : null, () =>
    githubRPCClient.getPRStatus({ ...githubRepoArgs(ref!), prNumber: prNumber! }),
  );
}

export function useCalendarProviders() {
  return useTypedSWR("/calendar/getCalendarProviders", () => calendarRPCClient.getCalendarProviders({}));
}

export function useCalendarEvents(provider: string | undefined, from: string, to: string) {
  return useTypedSWR(
    provider ? `/calendar/getUpcomingEvents/${provider}/${from}/${to}` : null,
    () => calendarRPCClient.getUpcomingEvents({ provider: provider!, from, to }),
    { refreshInterval: 30000 },
  );
}

export function useEmailConfiguration() {
  return useTypedSWR("/email/getEmailConfiguration", () => emailRPCClient.getEmailConfiguration({}));
}

export function useEmailBoxes(provider: string | undefined) {
  return useTypedSWR(provider ? `/email/getEmailBoxes/${provider}` : null, () => emailRPCClient.getEmailBoxes({ provider: provider! }));
}

export function useEmailMessages(
  provider: string | undefined,
  opts?: {
    box?: string | undefined;
    limit?: number | undefined;
    unreadOnly?: boolean | undefined;
    pageToken?: string | undefined;
  },
) {
  const box = opts?.box ?? "inbox";
  const limit = opts?.limit ?? 50;
  const unreadOnly = opts?.unreadOnly ?? false;
  const pageToken = opts?.pageToken;
  return useTypedSWR(
    provider ? `/email/getMessages/${provider}/${box}/${limit}/${unreadOnly}/${pageToken ?? ""}` : null,
    () => emailRPCClient.getMessages(stripUndefinedKeys({ provider, box, limit, unreadOnly, pageToken })),
    { refreshInterval: 30000 },
  );
}

export function useEmailSearch(provider: string | undefined, query: string | undefined, opts?: { box?: string; limit?: number; unreadOnly?: boolean }) {
  const box = opts?.box ?? "inbox";
  const limit = opts?.limit ?? 50;
  const unreadOnly = opts?.unreadOnly ?? false;
  return useTypedSWR(
    provider && query ? `/email/searchMessages/${provider}/${box}/${query}/${limit}/${unreadOnly}` : null,
    () => emailRPCClient.searchMessages(stripUndefinedKeys({ provider, query, box, limit, unreadOnly })),
    { refreshInterval: 30000 },
  );
}

export function useEmailMessage(provider: string | undefined, messageId: string | undefined) {
  return useTypedSWR(provider && messageId ? `/email/getMessageById/${provider}/${messageId}` : null, () =>
    emailRPCClient.getMessageById(stripUndefinedKeys({ provider: provider, id: messageId })),
  );
}

export function useVaultKeys() {
  return useRPCStreamSWR({
    key: "vault-entries",
    subscribe: signal => vaultRPCClient.streamEntries({}, signal),
  });
}

export function useCostSummary() {
  return useRPCStreamSWR({
    key: "metrics-cost-summary",
    subscribe: signal => metricsRPCClient.streamCostSummary({}, signal),
  });
}

export function useSchedules() {
  return useTypedSWR("/scheduler/listSchedules", () => schedulerRPCClient.listSchedules({}), { refreshInterval: 3000 });
}

export function useSchedulerHistory(name?: string) {
  return useTypedSWR(`/scheduler/getHistory/${name ?? ""}`, () => schedulerRPCClient.getHistory(stripUndefinedKeys({ name: name || undefined })), {
    refreshInterval: 5000,
  });
}

/** Every monitor with its recent firings, and recent events across all monitors; one shared live stream. */
export function useMonitors() {
  return useRPCStreamSWR({
    key: "monitors",
    subscribe: signal => monitorRPCClient.streamMonitors({}, signal),
  });
}

export function useBots() {
  return useRPCStreamSWR({
    key: "bots",
    subscribe: signal => botRPCClient.streamBots({}, signal),
  });
}

/** Connected X accounts and their post length limits. Resolves to null when the X plugin is not installed. */
export function useXAccounts() {
  return useTypedSWR("/x/listAccounts", async () => {
    try {
      return (await xRPCClient.listAccounts({})).accounts;
    } catch {
      return null;
    }
  });
}

/** Connected Reddit accounts. Resolves to null when the Reddit plugin is not installed. */
export function useRedditAccounts() {
  return useTypedSWR("/reddit/listAccounts", async () => {
    try {
      const result = await redditRPCClient.listAccounts({});
      return { accounts: result.accounts, titleMaxLength: result.titleMaxLength };
    } catch {
      return null;
    }
  });
}

export function useQueues() {
  return useRPCStreamSWR({
    key: "queues",
    subscribe: signal => queueRPCClient.streamQueues({}, signal),
  });
}

export function useMediaLibraryConfiguration() {
  return useTypedSWR("/media-library/getMediaLibraryConfiguration", () => mediaLibraryRPCClient.getMediaLibraryConfiguration({}));
}

/** Stream media library entries (optionally filtered by kind and search). */
export function useMedia(opts?: { search?: string; kind?: ("image" | "video" | "audio")[]; limit?: number }) {
  const search = opts?.search;
  const kind = opts?.kind;
  const limit = opts?.limit;
  const kindKey = kind?.length ? [...kind].sort().join(",") : "all";
  const key = `media:${kindKey}:${search ?? ""}:${limit ?? 200}`;
  return useRPCStreamSWR({
    key,
    subscribe: signal => mediaLibraryRPCClient.streamMedia(stripUndefinedKeys({ search, kind, limit }), signal),
  });
}

export function useImageGenerationModels() {
  return useTypedSWR("/ai-client/listImageGenerationModels", () => aiRPCClient.listImageGenerationModels({}));
}

export function useVideoGenerationModels() {
  return useTypedSWR("/ai-client/listVideoGenerationModels", () => aiRPCClient.listVideoGenerationModels({}));
}

export function useSpeechModels() {
  return useTypedSWR("/ai-client/listSpeechModels", () => aiRPCClient.listSpeechModels({}));
}

export function useWebDesignConfiguration() {
  return useTypedSWR("/web-design/getWebDesignConfiguration", () => webDesignRPCClient.getWebDesignConfiguration({}));
}

export function useFlows() {
  return useRPCStreamSWR({
    key: "web-design-flows",
    subscribe: signal => webDesignRPCClient.streamFlows({}, signal),
  });
}

export function useDesigns(flowName: string | null) {
  return useRPCStreamSWR({
    key: flowName ? `web-design-designs:${flowName}` : null,
    subscribe: signal => webDesignRPCClient.streamDesigns({ flowName: flowName! }, signal),
  });
}

export function useDesignHistory(flowName: string | null, designName: string | null) {
  return useTypedSWR(flowName && designName ? (`/web-design/listDesignHistory:${flowName}/${designName}` as const) : null, () =>
    webDesignRPCClient.listDesignHistory({ flowName: flowName!, name: designName! }),
  );
}

export function useResearchConfiguration() {
  return useTypedSWR("/research/getResearchConfiguration", () => researchRPCClient.getResearchConfiguration({}));
}

export function useTopics() {
  return useRPCStreamSWR({
    key: "research-topics",
    subscribe: signal => researchRPCClient.streamTopics({}, signal),
  });
}

export function useItems(topicName: string | null) {
  return useRPCStreamSWR({
    key: topicName ? `research-items:${topicName}` : null,
    subscribe: signal => researchRPCClient.streamItems({ topicName: topicName! }, signal),
  });
}

export function useMemoryConfiguration() {
  return useTypedSWR("/memory/getMemoryConfiguration", () => memoryRPCClient.getMemoryConfiguration({}));
}

export function useMemoryCategories() {
  return useRPCStreamSWR({
    key: "memory-categories",
    subscribe: signal => memoryRPCClient.streamCategories({}, signal),
  });
}

export function useMemories(category: string | null) {
  return useRPCStreamSWR({
    key: category ? `memory-memories:${category}` : null,
    subscribe: signal => memoryRPCClient.streamMemories({ category: category! }, signal),
  });
}
