import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AgentPackageConfigSchema } from "@tokenring-ai/agent/schema";
import { ChatAgentConfigSchema, type TokenRingToolDefinition } from "@tokenring-ai/chat/schema";
import { LifecycleAgentConfigSchema } from "@tokenring-ai/lifecycle/schema";
import { like } from "@tokenring-ai/utility/string/like";
import bundledAgents from "../config/agents/index.ts";
import config from "../config/index.ts";

const repoRoot = path.resolve(import.meta.dir, "../..");
const pluginRoot = path.join(repoRoot, "plugin");

type AgentEntry = { chat?: unknown; lifecycle?: Record<string, unknown> };
const agents = (bundledAgents as { agents: Record<string, AgentEntry> }).agents;

/** Agent types added for first-party apps, with the frontend constant each one must equal. */
const APP_AGENT_TYPES = ["writer", "messaging", "social"] as const;

type ConfigWithTools = { tools?: Record<string, unknown> };

/**
 * Every tool name the app can register: code tools each plugin passes to
 * `chatService.addTools` (all of them export those from tools.ts), plus the
 * agent-backed tools declared under `tools:` in the packaged config and in
 * each plugin's shipped config (ChatService.reconfigureTools registers those).
 */
async function collectToolNames(): Promise<string[]> {
  const names = new Set<string>(Object.keys((config as ConfigWithTools).tools ?? {}));
  for (const dir of readdirSync(pluginRoot)) {
    const toolsFile = path.join(pluginRoot, dir, "tools.ts");
    if (existsSync(toolsFile)) {
      const mod = (await import(toolsFile)) as { default?: TokenRingToolDefinition<any>[] };
      for (const tool of mod.default ?? []) names.add(tool.name);
    }
    const configFile = path.join(pluginRoot, dir, "config", "index.ts");
    if (existsSync(configFile)) {
      const mod = (await import(configFile)) as { default?: ConfigWithTools };
      for (const toolName of Object.keys(mod.default?.tools ?? {})) names.add(toolName);
    }
  }
  return [...names];
}

function readFrontendConstant(relativeFile: string, pattern: RegExp): string {
  const match = readFileSync(path.join(repoRoot, relativeFile), "utf8").match(pattern);
  if (!match?.[1]) throw new Error(`Could not find constant in ${relativeFile}`);
  return match[1];
}

describe("bundled agent types", () => {
  it("validates against the agent package config schema", () => {
    const parsed = AgentPackageConfigSchema.parse({
      agents: agents,
      commands: (bundledAgents as { commands?: unknown }).commands ?? {},
    });
    for (const type of APP_AGENT_TYPES) {
      expect(parsed.agents[type]).toBeDefined();
    }
  });

  it("are composed into the app's packaged config", () => {
    const configAgents = (config as { agents: Record<string, unknown> }).agents;
    for (const type of APP_AGENT_TYPES) expect(configAgents[type]).toBeDefined();
    // The coding agents must survive the merge.
    expect(configAgents.code).toBeDefined();
  });

  it.each([...APP_AGENT_TYPES])("%s has a valid chat and lifecycle slice", (type: string) => {
    const agent = agents[type];
    const chat = ChatAgentConfigSchema.parse(agent?.chat);
    expect(chat.systemPrompt.length).toBeGreaterThan(200);
    expect(chat.enabledTools?.length).toBeGreaterThan(0);
    if (agent?.lifecycle) {
      // `enabledHooks+` is a merge directive; validate the slice as it would be after merging.
      const { "enabledHooks+": appended, ...rest } = agent.lifecycle;
      LifecycleAgentConfigSchema.parse({ ...rest, enabledHooks: appended });
    }
  });

  it("every enabledTools entry resolves to a registered tool", async () => {
    const toolNames = await collectToolNames();
    const unresolved: string[] = [];
    for (const [type, agent] of Object.entries(agents)) {
      const { enabledTools = [] } = ChatAgentConfigSchema.parse(agent.chat);
      for (const pattern of enabledTools) {
        if (!toolNames.some(toolName => like(pattern, toolName))) unresolved.push(`${type}: ${pattern}`);
      }
    }
    expect(unresolved).toEqual([]);
  });

  it("the bot tools the messaging and social agents rely on are registered", async () => {
    const toolNames = await collectToolNames();
    expect(toolNames).toEqual(expect.arrayContaining(["bot_list", "bot_listConversations", "bot_sendMessage", "bot_resetConversation"]));
  });

  it("the messaging agent's lifecycle hook exists", async () => {
    const hook = (await import("@tokenring-ai/email/hooks/addSelectedEmail")).default;
    expect(agents.messaging?.lifecycle?.["enabledHooks+"]).toEqual([hook.name]);
  });

  it("matches the agent type names the frontend apps look up", () => {
    const writer = readFrontendConstant("frontend/src/apps/documents/shared.tsx", /WRITER_AGENT_TYPE = "([^"]+)"/);
    const social = readFrontendConstant("frontend/src/apps/social/shared.ts", /SOCIAL_AGENT_TYPE = "([^"]+)"/);
    const messaging = readFrontendConstant("frontend/src/features/messaging/useMessagingData.ts", /MESSAGING_AGENT_TYPES = \["([^"]+)"/);
    expect([writer, messaging, social]).toEqual([...APP_AGENT_TYPES]);
  });

  it("the writer answers selection rewrites without tools or preamble", () => {
    const { systemPrompt } = ChatAgentConfigSchema.parse(agents.writer?.chat);
    expect(systemPrompt).toContain("Do not call any tools");
    expect(systemPrompt).toContain("no code fences");
  });

  it("the messaging and social agents ask before sending", () => {
    for (const type of ["messaging", "social"]) {
      const { systemPrompt } = ChatAgentConfigSchema.parse(agents[type]?.chat);
      expect(systemPrompt).toMatch(/Never (send|post)/);
    }
  });
});

/**
 * Context handler names the plugins register: the keys of each plugin's `contextHandlers.ts`, plus
 * names passed to `registerContextHandler` in its plugin.ts (a string, or a constant exported
 * somewhere in that plugin).
 */
async function collectContextHandlerNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for (const dir of readdirSync(pluginRoot)) {
    const handlersFile = path.join(pluginRoot, dir, "contextHandlers.ts");
    if (existsSync(handlersFile)) {
      const mod = (await import(handlersFile)) as { default?: Record<string, unknown> };
      for (const name of Object.keys(mod.default ?? {})) names.add(name);
    }
    const pluginFile = path.join(pluginRoot, dir, "plugin.ts");
    if (!existsSync(pluginFile)) continue;
    for (const [, literal, constant] of readFileSync(pluginFile, "utf8").matchAll(/registerContextHandler\(\s*(?:"([^"]+)"|(\w+))/g)) {
      if (literal) names.add(literal);
      else if (constant) {
        const found = new Bun.Glob("**/*.ts").scanSync({ cwd: path.join(pluginRoot, dir) });
        for (const file of found) {
          if (file.includes("node_modules")) continue;
          const match = readFileSync(path.join(pluginRoot, dir, file), "utf8").match(new RegExp(`export const ${constant} = "([^"]+)"`));
          if (match?.[1]) names.add(match[1]);
        }
      }
    }
  }
  return names;
}

describe("plugin tools", () => {
  it("only require context handlers that some plugin registers", async () => {
    const registered = await collectContextHandlerNames();
    const missing: string[] = [];
    for (const dir of readdirSync(pluginRoot)) {
      const toolsFile = path.join(pluginRoot, dir, "tools.ts");
      if (!existsSync(toolsFile)) continue;
      const mod = (await import(toolsFile)) as { default?: TokenRingToolDefinition<any>[] };
      for (const tool of mod.default ?? []) {
        for (const handler of tool.requiredContextHandlers ?? []) {
          if (!registered.has(handler)) missing.push(`${tool.name} requires "${handler}"`);
        }
      }
    }
    // A missing handler makes every chat turn of an agent with that tool enabled throw.
    expect(missing).toEqual([]);
  });
});
