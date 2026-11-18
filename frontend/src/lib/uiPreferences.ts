/**
 * Client-side UI preference keys (browser localStorage).
 * Every localStorage key the frontend writes must appear here (or match a prefix) so
 * Settings → Clear local preferences can remove it.
 */

import { readLocalStorageState, writeLocalStorageState } from "../hooks/useLocalStorageState.ts";

/** Map of confirmation ids the user chose not to see again. */
export const CONFIRM_SKIPS_KEY = "tokenring-confirm-skips";
export type ConfirmSkips = Record<string, true>;

/** Fired in the same tab after confirm-skip storage changes. */
export const CONFIRM_SKIPS_CHANGED_EVENT = "tokenring-confirm-skips-changed";

/** Legacy key still cleared by Settings → Clear local preferences. */
export const CONFIRM_AGENT_DELETE_KEY = "tokenring-confirm-agent-delete";

/**
 * Key prefixes for per-dashboard / per-view preferences; Settings → Clear local
 * preferences removes every key that starts with one of these.
 */
export const CLIENT_PREFERENCE_KEY_PREFIXES = [
  "tokenring-dashboard-layout:", // persisted dock layouts (localStorage fallback / cache)
  "tokenring-workspace-navigation-", // stale keys from the pre-dock workspace shell
  "agentSessionList:", // AgentSessionList expanded state per dashboard
  "agentSession:", // useAppAgentSession: the agent a dashboard is attached to
  "terminal:", // input modes, font size, command history
  "workflows:", // unsaved workflow drafts
  "blog:", // selected blog provider, unsaved post drafts
  "github:", // selected repository and account, recent repositories, list filters
  "webdesign:", // device preview selection
  "chatDock:", // stale keys from the pre-dock chat dock
  "tasks.boardMode.", // tasks plugin: kanban/list mode per board (boardModeKey)
  "database:", // database plugin: SQL query history and per-datasource query drafts
] as const;

/** All known frontend UI preference keys cleared by Settings → Clear local preferences. */
export const CLIENT_PREFERENCE_KEYS = [
  "theme",
  "theme-accent",
  "theme-density",
  "theme-boot",
  "tokenring-pinned-dashboards",
  "tokenring-recent-dashboards",
  "tokenring-pinned-apps", // legacy, migrated by AppShellProvider
  "tokenring-recent-apps", // legacy, migrated by AppShellProvider
  "tokenring-chat-inputs",
  CONFIRM_SKIPS_KEY,
  CONFIRM_AGENT_DELETE_KEY,
  "tokenring-configuration-drafts", // Configuration dashboard: unsaved override drafts per scope
  "stocks:watchlist", // cloudquote stocks watchlist symbols
  "chat.hideToolCalls", // ChatPanel: hide tool-call rows in the transcript
  "tokenring-restore-last-dashboard", // useRestoreLastSession: reopen the last dashboard on launch
  "tokenring.agentSessionMeta", // agentSessionMetaStore: custom session titles and pins
  "tokenring-welcome-dismissed", // Home welcome view: dismissed in this browser
  "tokenring.documents.draft", // Documents: the unsaved working document
] as const;

/**
 * localStorage keys deliberately NOT cleared by Clear local preferences: they
 * hold user data with no other copy, not preferences.
 */
export const CLIENT_DATA_KEYS_NOT_CLEARED = [
  "tokenring:calendar:events", // calendar plugin: locally stored calendar events
] as const;

function notifyConfirmSkipsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONFIRM_SKIPS_CHANGED_EVENT));
}

function isConfirmSkips(value: unknown): value is ConfirmSkips {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(entry => entry === true);
}

/** Read the persisted skip map. Invalid or missing storage yields `{}`. */
export function readConfirmSkips(): ConfirmSkips {
  const value = readLocalStorageState<unknown>(CONFIRM_SKIPS_KEY, {});
  return isConfirmSkips(value) ? value : {};
}

export function isConfirmSkipped(id: string): boolean {
  return readConfirmSkips()[id] === true;
}

export function setConfirmSkipped(id: string, skipped: boolean): void {
  const current = readConfirmSkips();
  if (skipped) {
    if (current[id] === true) return;
    writeLocalStorageState(CONFIRM_SKIPS_KEY, { ...current, [id]: true as const });
  } else {
    if (current[id] !== true) return;
    const next = { ...current };
    delete next[id];
    writeLocalStorageState(CONFIRM_SKIPS_KEY, next);
  }
  notifyConfirmSkipsChanged();
}

export function clearConfirmSkips(): void {
  const current = readConfirmSkips();
  if (Object.keys(current).length === 0) {
    writeLocalStorageState(CONFIRM_SKIPS_KEY, {});
    return;
  }
  writeLocalStorageState(CONFIRM_SKIPS_KEY, {});
  notifyConfirmSkipsChanged();
}

/**
 * Show a confirmation UI, or run the action immediately when this prompt is skipped.
 */
export function runOrConfirm(id: string, show: () => void, run: () => void): void {
  if (isConfirmSkipped(id)) run();
  else show();
}
