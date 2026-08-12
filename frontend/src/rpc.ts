import AgentRpcSchema from "@tokenring-ai/agent/rpc/schema";
import AIClientRpcSchema from "@tokenring-ai/ai-client/rpc/schema";
import ConfigRpcSchema from "@tokenring-ai/app/rpc/configSchema";
import AppRpcSchema from "@tokenring-ai/app/rpc/schema";
import AudioRpcSchema from "@tokenring-ai/audio/rpc/schema";
import BlogRpcSchema from "@tokenring-ai/blog/rpc/schema";
import BotRpcSchema from "@tokenring-ai/bot/rpc/schema";
import CalendarRpcSchema from "@tokenring-ai/calendar/rpc/schema";
import ChatRpcSchema from "@tokenring-ai/chat/rpc/schema";
import CheckpointRpcSchema from "@tokenring-ai/checkpoint/rpc/schema";
import CloudQuoteRpcSchema from "@tokenring-ai/cloudquote/rpc/schema";
import DatabaseRpcSchema from "@tokenring-ai/database/rpc/schema";
import type { FilterOperator as DatabaseFilterOperator } from "@tokenring-ai/database/types";
import EmailRpcSchema from "@tokenring-ai/email/rpc/schema";
import FileSystemRpcSchema from "@tokenring-ai/filesystem/rpc/schema";
import ImageGenerationRpcSchema from "@tokenring-ai/image/rpc/schema";
import LifecycleRpcSchema from "@tokenring-ai/lifecycle/rpc/schema";
import MediaLibraryRpcSchema from "@tokenring-ai/media-library/rpc/schema";
import MemoryRpcSchema from "@tokenring-ai/memory/rpc/schema";
import MetricsRpcSchema from "@tokenring-ai/metrics/rpc/schema";
import NewsRPMRpcSchema from "@tokenring-ai/newsrpm/rpc/schema";
import type { IndexedDataSearch } from "@tokenring-ai/newsrpm/schema";
import QueueRpcSchema from "@tokenring-ai/queue/rpc/schema";
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
import WorkflowRpcSchema from "@tokenring-ai/workflow/rpc/schema";
import { useRef } from "react";
import useSWR, { type Fetcher, type Key, type SWRConfiguration, type SWRResponse } from "swr";
import { useAgentStatusStream, useRPCStreamSWR } from "./hooks/useRPCStreamSWR.ts";
import { rpcAuth } from "./rpcAuth.ts";

export function useTypedSWR<Data = unknown, Err extends Error = Error, SWRKey extends Key = Key>(
  key: SWRKey,
  fetcher: Fetcher<Data, SWRKey> | null,
  config?: SWRConfiguration<Data, Err, Fetcher<Data, SWRKey>>,
): SWRResponse<Data, Err> {
  return useSWR<Data, Err, SWRKey>(key, fetcher, config);
}

const baseURL = new URL("/rpc:ws", window.location.origin);

export const agentRPCClient = createWsRPCClient(baseURL, AgentRpcSchema, rpcAuth);
export const audioRPCClient = createWsRPCClient(baseURL, AudioRpcSchema, rpcAuth);
export const blogRPCClient = createWsRPCClient(baseURL, BlogRpcSchema, rpcAuth);
export const botRPCClient = createWsRPCClient(baseURL, BotRpcSchema, rpcAuth);
export const imageGenerationRPCClient = createWsRPCClient(baseURL, ImageGenerationRpcSchema, rpcAuth);
export const videoGenerationRPCClient = createWsRPCClient(baseURL, VideoRpcSchema, rpcAuth);
export const appRPCClient = createWsRPCClient(baseURL, AppRpcSchema, rpcAuth);
export const cloudquoteRPCClient = createWsRPCClient(baseURL, CloudQuoteRpcSchema, rpcAuth);
export const newsrpmRPCClient = createWsRPCClient(baseURL, NewsRPMRpcSchema, rpcAuth);
export const aiRPCClient = createWsRPCClient(baseURL, AIClientRpcSchema, rpcAuth);
export const chatRPCClient = createWsRPCClient(baseURL, ChatRpcSchema, rpcAuth);
export const checkpointRPCClient = createWsRPCClient(baseURL, CheckpointRpcSchema, rpcAuth);
export const filesystemRPCClient = createWsRPCClient(baseURL, FileSystemRpcSchema, rpcAuth);
export const lifecycleRPCClient = createWsRPCClient(baseURL, LifecycleRpcSchema, rpcAuth);
export const mediaLibraryRPCClient = createWsRPCClient(baseURL, MediaLibraryRpcSchema, rpcAuth);
export const workflowRPCClient = createWsRPCClient(baseURL, WorkflowRpcSchema, rpcAuth);
export const calendarRPCClient = createWsRPCClient(baseURL, CalendarRpcSchema, rpcAuth);
export const webDesignRPCClient = createWsRPCClient(baseURL, WebDesignRpcSchema, rpcAuth);
export const emailRPCClient = createWsRPCClient(baseURL, EmailRpcSchema, rpcAuth);
export const terminalRPCClient = createWsRPCClient(baseURL, TerminalRpcSchema, rpcAuth);
export const vaultRPCClient = createWsRPCClient(baseURL, VaultRpcSchema, rpcAuth);
export const tasksRPCClient = createWsRPCClient(baseURL, TasksRpcSchema, rpcAuth);
export const metricsRPCClient = createWsRPCClient(baseURL, MetricsRpcSchema, rpcAuth);
export const schedulerRPCClient = createWsRPCClient(baseURL, SchedulerRpcSchema, rpcAuth);
export const queueRPCClient = createWsRPCClient(baseURL, QueueRpcSchema, rpcAuth);
export const skillsRPCClient = createWsRPCClient(baseURL, SkillsRpcSchema, rpcAuth);
export const todoRPCClient = createWsRPCClient(baseURL, TodoRpcSchema, rpcAuth);
export const researchRPCClient = createWsRPCClient(baseURL, ResearchRpcSchema, rpcAuth);
export const memoryRPCClient = createWsRPCClient(baseURL, MemoryRpcSchema, rpcAuth);
export const configRPCClient = createWsRPCClient(baseURL, ConfigRpcSchema, rpcAuth);
export const databaseRPCClient = createWsRPCClient(baseURL, DatabaseRpcSchema, rpcAuth);

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

export function useAgentList() {
  return useRPCStreamSWR({
    key: "agents",
    subscribe: signal => agentRPCClient.streamAgents({}, signal),
  });
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

export function useTaskLists() {
  return useRPCStreamSWR({
    key: "task-lists",
    subscribe: signal => tasksRPCClient.streamTaskLists({}, signal),
  });
}

/** Tasks in one list, or across every list when `list` is null. */
export function useTasks(list: string | null) {
  return useRPCStreamSWR({
    key: list ? `tasks:${list}` : "tasks:all",
    subscribe: signal => tasksRPCClient.streamTasks(list ? { list } : {}, signal),
  });
}

export function useTask(list: string | undefined, name: string | undefined) {
  return useTypedSWR(list && name ? `/tasks/getTask/${list}/${name}` : null, () => tasksRPCClient.getTask({ list: list!, name: name! }));
}

/** Live view of every tracked task run and the batches they belong to. */
export function useTaskRuns() {
  return useRPCStreamSWR({
    key: "task-runs",
    subscribe: signal => tasksRPCClient.streamTaskRuns({}, signal),
  });
}

export function useFilesystemProviders() {
  return useTypedSWR("/filesystem/getFilesystemProviders", () => filesystemRPCClient.getFilesystemProviders({}));
}

export function useFilesystemState(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `filesystem:${agentId}` : null, signal => filesystemRPCClient.streamFilesystemState({ agentId: agentId! }, signal));
}

export function useDirectoryListing(opts?: { path: string; showHidden?: boolean; provider: string }) {
  return useTypedSWR(opts ? `/filesystem/listDirectory/${opts.provider}/${opts.path}/${opts.showHidden ?? false}` : null, () =>
    filesystemRPCClient.listDirectory({
      path: opts!.path,
      recursive: false,
      showHidden: opts!.showHidden ?? false,
      provider: opts!.provider,
    }),
  );
}

export function useFileContents(path: string | undefined, provider: string | undefined) {
  return useTypedSWR(path && provider ? `/filesystem/getFileContents/${provider}/${path}` : null, () =>
    filesystemRPCClient.readTextFile({
      path: path!,
      provider: provider!,
    }),
  );
}

export function useWorkspaceFileSearch(opts?: { provider: string; query: string; limit?: number }) {
  const query = opts?.query.trim() ?? "";
  const limit = opts?.limit ?? 48;
  return useTypedSWR(opts && query ? `/filesystem/searchWorkspaceFiles/${opts.provider}/${query}/${limit}` : null, () =>
    filesystemRPCClient.searchWorkspaceFiles({
      provider: opts!.provider,
      query,
      limit,
    }),
  );
}

export function useChatModelsByProvider() {
  return useTypedSWR(`/ai-client/chatModelsByProvider`, () => aiRPCClient.listChatModelsByProvider({}));
}

export function useAvailableTools() {
  return useTypedSWR(`/chat/getAvailableTools`, () => chatRPCClient.getAvailableTools({}));
}

export function useEnabledTools(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `enabled-tools:${agentId}` : null, signal => chatRPCClient.streamEnabledTools({ agentId: agentId! }, signal));
}

export function useToolApprovalLevels() {
  return useTypedSWR(`/chat/getToolApprovalLevels`, () => chatRPCClient.getToolApprovalLevels({}));
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

export function useStockPriceChart(symbol: string | undefined, interval: string) {
  return useTypedSWR(symbol ? `/cloudquote/getPriceChart/${symbol}/${interval}` : null, () => cloudquoteRPCClient.getPriceChart({ symbol: symbol!, interval }));
}

export function useStockLeaders(list: "MOSTACTIVE" | "PERCENTGAINERS" | "PERCENTLOSERS", limit = 10) {
  return useTypedSWR(`/cloudquote/getLeaders/${list}`, () => cloudquoteRPCClient.getLeaders({ list, limit }), { refreshInterval: 60000 });
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

  // Keep a stable key so disabling the stream (e.g. leaving the Logs tab) preserves
  // accumulated logs and the resume position; only pause the subscription.
  return useRPCStreamSWR({
    key: "app-logs",
    enabled,
    initialData: () => ({ logs: [] as AppLogEntry[] }),
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

export function useSchedulerTasks(agentId: string | undefined) {
  return useTypedSWR(
    agentId ? `/scheduler/getTasks/${agentId}` : null,
    async () => {
      const result = await schedulerRPCClient.getTasks({ agentId: agentId! });
      if (result.status === "agentNotFound") {
        throw new Error(`Agent not found: ${agentId}`);
      }
      return result;
    },
    { refreshInterval: 5000 },
  );
}

export function useSchedulerStatus(agentId: string | undefined) {
  return useTypedSWR(
    agentId ? `/scheduler/getStatus/${agentId}` : null,
    async () => {
      const result = await schedulerRPCClient.getStatus({ agentId: agentId! });
      if (result.status === "agentNotFound") {
        throw new Error(`Agent not found: ${agentId}`);
      }
      return result;
    },
    { refreshInterval: 3000 },
  );
}

export function useSchedulerHistory(agentId: string | undefined, taskName?: string) {
  return useTypedSWR(
    agentId ? `/scheduler/getHistory/${agentId}/${taskName ?? ""}` : null,
    async () => {
      const result = await schedulerRPCClient.getHistory(stripUndefinedKeys({ agentId: agentId!, taskName: taskName || undefined }));
      if (result.status === "agentNotFound") {
        throw new Error(`Agent not found: ${agentId}`);
      }
      return result;
    },
    { refreshInterval: 5000 },
  );
}

export function useBots() {
  return useRPCStreamSWR({
    key: "bots",
    subscribe: signal => botRPCClient.streamBots({}, signal),
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
