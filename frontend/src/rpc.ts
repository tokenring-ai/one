import AgentRpcSchema from "@tokenring-ai/agent/rpc/schema";
import AIClientRpcSchema from "@tokenring-ai/ai-client/rpc/schema";
import ConfigRpcSchema from "@tokenring-ai/app/rpc/configSchema";
import AppRpcSchema from "@tokenring-ai/app/rpc/schema";
import AudioRpcSchema from "@tokenring-ai/audio/rpc/schema";
import BlogRpcSchema from "@tokenring-ai/blog/rpc/schema";
import CalendarRpcSchema from "@tokenring-ai/calendar/rpc/schema";
import ChatRpcSchema from "@tokenring-ai/chat/rpc/schema";
import CheckpointRpcSchema from "@tokenring-ai/checkpoint/rpc/schema";
import CloudQuoteRpcSchema from "@tokenring-ai/cloudquote/rpc/schema";
import EmailRpcSchema from "@tokenring-ai/email/rpc/schema";
import FileSystemRpcSchema from "@tokenring-ai/filesystem/rpc/schema";
import ImageGenerationRpcSchema from "@tokenring-ai/image/rpc/schema";
import LifecycleRpcSchema from "@tokenring-ai/lifecycle/rpc/schema";
import MediaLibraryRpcSchema from "@tokenring-ai/media-library/rpc/schema";
import MetricsRpcSchema from "@tokenring-ai/metrics/rpc/schema";
import NewsRPMRpcSchema from "@tokenring-ai/newsrpm/rpc/schema";
import type { IndexedDataSearch } from "@tokenring-ai/newsrpm/schema";
import QueueRpcSchema from "@tokenring-ai/queue/rpc/schema";
import ResearchRpcSchema from "@tokenring-ai/research/rpc/schema";
import SchedulerRpcSchema from "@tokenring-ai/scheduler/rpc/schema";
import SkillsRpcSchema from "@tokenring-ai/skills/rpc/schema";
import TasksRpcSchema from "@tokenring-ai/tasks/rpc/schema";
import TerminalRpcSchema from "@tokenring-ai/terminal/rpc/schema";
import { arrayableToArray } from "@tokenring-ai/utility/array/arrayable";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import VaultRpcSchema from "@tokenring-ai/vault/rpc/schema";
import VideoRpcSchema from "@tokenring-ai/video/rpc/schema";
import createWsRPCClient from "@tokenring-ai/web-host/createWsRPCClient";
import WorkflowRpcSchema from "@tokenring-ai/workflow/rpc/schema";
import { useEffect, useRef } from "react";
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
export const emailRPCClient = createWsRPCClient(baseURL, EmailRpcSchema, rpcAuth);
export const terminalRPCClient = createWsRPCClient(baseURL, TerminalRpcSchema, rpcAuth);
export const vaultRPCClient = createWsRPCClient(baseURL, VaultRpcSchema, rpcAuth);
export const tasksRPCClient = createWsRPCClient(baseURL, TasksRpcSchema, rpcAuth);
export const metricsRPCClient = createWsRPCClient(baseURL, MetricsRpcSchema, rpcAuth);
export const schedulerRPCClient = createWsRPCClient(baseURL, SchedulerRpcSchema, rpcAuth);
export const queueRPCClient = createWsRPCClient(baseURL, QueueRpcSchema, rpcAuth);
export const skillsRPCClient = createWsRPCClient(baseURL, SkillsRpcSchema, rpcAuth);
export const researchRPCClient = createWsRPCClient(baseURL, ResearchRpcSchema, rpcAuth);
export const configRPCClient = createWsRPCClient(baseURL, ConfigRpcSchema, rpcAuth);

export function useAvailableCommands(agentId: string) {
  return useTypedSWR(agentId ? `/agent/getAvailableCommands/${agentId}` : null, async () => {
    const result = await agentRPCClient.getAvailableCommands({ agentId });
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

export function useFilesystemProviders() {
  return useTypedSWR("/filesystem/getFilesystemProviders", () => filesystemRPCClient.getFilesystemProviders({}));
}

export function useFilesystemState(agentId: string | undefined) {
  return useAgentStatusStream(agentId ? `filesystem:${agentId}` : null, signal => filesystemRPCClient.streamFilesystemState({ agentId: agentId! }, signal));
}

export function useDirectoryListing(opts?: { path: string; showHidden?: boolean; provider: string }) {
  return useTypedSWR(opts ? `/filesystem/listDirectory/${opts.provider}/${opts.path}` : null, () =>
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

export function useChatModelsByProvider() {
  return useTypedSWR(`/ai-client/chatModelsByProvider`, () => aiRPCClient.listChatModelsByProvider({}));
}

export function useAvailableTools() {
  return useTypedSWR(`/chat/getAvailableTools`, () => chatRPCClient.getAvailableTools({}));
}

export function useEnabledTools(agentId: string) {
  return useAgentStatusStream(agentId ? `enabled-tools:${agentId}` : null, signal => chatRPCClient.streamEnabledTools({ agentId }, signal));
}

export function useAvailableHooks() {
  return useTypedSWR(`/lifecycle/getAvailableHooks`, () => lifecycleRPCClient.getAvailableHooks({}));
}

export function useEnabledHooks(agentId: string) {
  return useAgentStatusStream(agentId ? `enabled-hooks:${agentId}` : null, signal => lifecycleRPCClient.streamEnabledHooks({ agentId }, signal));
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

export function useEnabledSkills(agentId: string) {
  return useAgentStatusStream(agentId ? `enabled-skills:${agentId}` : null, signal => skillsRPCClient.streamEnabledSkills({ agentId }, signal));
}

export function useAvailableSubAgents(agentId: string) {
  return useTypedSWR(agentId ? `/tasks/getAvailableSubAgents/${agentId}` : null, async () => {
    const result = await tasksRPCClient.getAvailableSubAgents({ agentId });
    switch (result.status) {
      case "success":
        return { agents: result.agents };
      case "agentNotFound":
        throw new Error(`Agent not found: ${agentId}`);
      default: {
        const exhaustive: any = result satisfies never;
        throw new Error(`Unexpected result status: ${exhaustive.status}`);
      }
    }
  });
}

export function useEnabledSubAgents(agentId: string) {
  return useAgentStatusStream(agentId ? `enabled-sub-agents:${agentId}` : null, signal => tasksRPCClient.streamEnabledSubAgents({ agentId }, signal));
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

export function useStockLeaders(list: "MOSTACTIVE" | "PERCENTGAINERS" | "PERCENTLOSERS", limit = 10) {
  return useTypedSWR(`/cloudquote/getLeaders/${list}`, () => cloudquoteRPCClient.getLeaders({ list, limit }), { refreshInterval: 60000 });
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

export function useAppLogs(options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const positionRef = useRef(0);

  useEffect(() => {
    if (enabled) {
      positionRef.current = 0;
    }
  }, [enabled]);

  return useRPCStreamSWR({
    key: enabled ? "app-logs" : null,
    initialData: () => ({ logs: [] as Array<{ timestamp: number; level: "info" | "error"; message: string }> }),
    subscribe: signal => appRPCClient.streamLogs({ fromPosition: positionRef.current }, signal),
    reduce: (prev, chunk) => {
      positionRef.current = chunk.position;
      return { logs: [...(prev?.logs ?? []), ...chunk.logs] };
    },
  });
}

export function useCheckpointList() {
  return useRPCStreamSWR({
    key: "checkpoints",
    subscribe: signal => checkpointRPCClient.streamCheckpoints({}, signal),
  });
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

export function useEmailProviders() {
  return useTypedSWR("/email/getEmailProviders", () => emailRPCClient.getEmailProviders({}));
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

export function useQueues() {
  return useRPCStreamSWR({
    key: "queues",
    subscribe: signal => queueRPCClient.streamQueues({}, signal),
  });
}

export function useImages(search?: string, limit?: number) {
  const key = search ? `images:${search}:${limit ?? 200}` : `images:${limit ?? 200}`;
  return useRPCStreamSWR({
    key,
    subscribe: signal => mediaLibraryRPCClient.streamImages(stripUndefinedKeys({ search, limit }), signal),
  });
}

export function useImageGenerationModels() {
  return useTypedSWR("/ai-client/listImageGenerationModels", () => aiRPCClient.listImageGenerationModels({}));
}

export function useVideos(search?: string, limit?: number) {
  const key = search ? `videos:${search}:${limit ?? 200}` : `videos:${limit ?? 200}`;
  return useRPCStreamSWR({
    key,
    subscribe: signal => mediaLibraryRPCClient.streamVideos(stripUndefinedKeys({ search, limit }), signal),
  });
}

export function useVideoGenerationModels() {
  return useTypedSWR("/ai-client/listVideoGenerationModels", () => aiRPCClient.listVideoGenerationModels({}));
}

export function useAudios(search?: string, limit?: number) {
  const key = search ? `audios:${search}:${limit ?? 200}` : `audios:${limit ?? 200}`;
  return useRPCStreamSWR({
    key,
    subscribe: signal => mediaLibraryRPCClient.streamAudios(stripUndefinedKeys({ search, limit }), signal),
  });
}

export function useSpeechModels() {
  return useTypedSWR("/ai-client/listSpeechModels", () => aiRPCClient.listSpeechModels({}));
}
