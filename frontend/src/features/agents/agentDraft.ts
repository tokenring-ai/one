/**
 * Editing model for an agent definition.
 *
 * An agent file is a loose object: on top of the core config fields, every plugin bolts on its own
 * slice (`chat`, `filesystem`, `scheduler`, …). The editor surfaces the handful of fields that make
 * sense in a form and carries everything else through untouched, so saving from the UI never drops a
 * key the UI does not know about.
 */

export type AgentRecord = Record<string, unknown>;

/** An agent body with the three fields the backend schema requires, ready to send over RPC. */
export type AgentBody = AgentRecord & { displayName: string; description: string; category: string };

/** Fields the editor renders directly. Everything else lives in `rest` / `restChat`. */
export interface AgentDraft {
  displayName: string;
  category: string;
  description: string;
  systemPrompt: string;
  enabledTools: string[];
  initialCommands: string[];
  idleTimeout: number;
  maxRunTime: number;
  minimumRunning: number;
  /** Top-level keys the form does not surface, preserved verbatim. */
  rest: AgentRecord;
  /** Keys of the `chat` slice the form does not surface, preserved verbatim. */
  restChat: AgentRecord;
}

/** Matches the config schema's requirement that an agent type be a safe file name. */
const AGENT_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Names that are Agents dashboard routes (`/agents/new`, `/agents/marketplace`, `/agents/jobs`), so an
 * agent type with one of them could never be opened by URL. Route matching ignores case.
 */
const RESERVED_AGENT_NAMES: readonly string[] = ["new", "marketplace", "jobs"];

/** Why `name` cannot be used for a new agent type, or null when it is valid. Empty names return null (nothing typed yet). */
export function agentNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return null;
  if (!AGENT_NAME_PATTERN.test(trimmed)) return "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.";
  if (RESERVED_AGENT_NAMES.includes(trimmed.toLowerCase())) return `"${trimmed}" is reserved by the Agents dashboard; pick another name.`;
  return null;
}

/** True when `name` is non-empty and passes {@link agentNameError}. */
export function isValidAgentName(name: string): boolean {
  return name.trim() !== "" && agentNameError(name) === null;
}

export const DEFAULT_AGENT_CATEGORY = "User-Created Agents";

/** Top-level keys owned by the form; anything else falls through to `rest`. */
const MANAGED_KEYS = new Set(["displayName", "category", "description", "initialCommands", "idleTimeout", "maxRunTime", "minimumRunning", "chat"]);

/**
 * Settings agent types no longer have, dropped when an agent file is saved. (Whether an agent's
 * questions can be answered is now chosen by whoever starts it, not by its type.)
 */
const RETIRED_KEYS = new Set(["headless"]);

/** Keys of the `chat` slice owned by the form. */
const MANAGED_CHAT_KEYS = new Set(["systemPrompt", "enabledTools"]);

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pickRest(source: AgentRecord, managed: Set<string>): AgentRecord {
  const rest: AgentRecord = {};
  for (const [key, value] of Object.entries(source)) {
    if (!managed.has(key)) rest[key] = value;
  }
  return rest;
}

export function emptyDraft(): AgentDraft {
  return {
    displayName: "",
    category: "",
    description: "",
    systemPrompt: "",
    enabledTools: [],
    initialCommands: [],
    idleTimeout: 0,
    maxRunTime: 0,
    minimumRunning: 0,
    rest: {},
    restChat: {},
  };
}

export function toDraft(agent: AgentRecord): AgentDraft {
  const chat = (typeof agent.chat === "object" && agent.chat !== null ? agent.chat : {}) as AgentRecord;
  return {
    displayName: asString(agent.displayName),
    category: asString(agent.category),
    description: asString(agent.description),
    systemPrompt: asString(chat.systemPrompt),
    enabledTools: asStringArray(chat.enabledTools),
    initialCommands: asStringArray(agent.initialCommands),
    idleTimeout: asNumber(agent.idleTimeout),
    maxRunTime: asNumber(agent.maxRunTime),
    minimumRunning: asNumber(agent.minimumRunning),
    rest: pickRest(agent, new Set([...MANAGED_KEYS, ...RETIRED_KEYS])),
    restChat: pickRest(chat, MANAGED_CHAT_KEYS),
  };
}

/** Reassembles a draft into an agent file body, dropping blank list entries. */
export function fromDraft(draft: AgentDraft): AgentBody {
  const chat: AgentRecord = { ...draft.restChat };
  if (draft.systemPrompt.trim() !== "" || "systemPrompt" in draft.restChat) chat.systemPrompt = draft.systemPrompt;
  const enabledTools = draft.enabledTools.map(tool => tool.trim()).filter(Boolean);
  if (enabledTools.length > 0 || "enabledTools" in draft.restChat) chat.enabledTools = enabledTools;

  const agent: AgentBody = {
    ...draft.rest,
    displayName: draft.displayName.trim(),
    category: draft.category.trim() || DEFAULT_AGENT_CATEGORY,
    description: draft.description.trim(),
    initialCommands: draft.initialCommands.map(command => command.trim()).filter(Boolean),
    idleTimeout: draft.idleTimeout,
    maxRunTime: draft.maxRunTime,
    minimumRunning: draft.minimumRunning,
  };
  if (Object.keys(chat).length > 0) agent.chat = chat;
  return agent;
}

export function isSameDraft(a: AgentDraft, b: AgentDraft): boolean {
  return JSON.stringify(fromDraft(a)) === JSON.stringify(fromDraft(b));
}

/** A draft is only saveable once it has the fields the backend schema requires. */
export function isDraftComplete(draft: AgentDraft): boolean {
  return draft.displayName.trim() !== "" && draft.description.trim() !== "";
}

/** Picks a free agent type for a copy of `baseName` (e.g. code-reviewer → code-reviewer-copy). */
export function uniqueCloneName(baseName: string, existingNames: Iterable<string>): string {
  const taken = new Set(existingNames);
  const candidate = `${baseName}-copy`;
  if (!taken.has(candidate)) return candidate;
  let n = 2;
  while (taken.has(`${baseName}-copy${n}`)) n += 1;
  return `${baseName}-copy${n}`;
}
