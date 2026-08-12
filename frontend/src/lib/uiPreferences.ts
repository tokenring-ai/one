/**
 * Client-side UI preference keys (browser localStorage).
 * Keep in sync with SettingsApp clear-preferences allowlist.
 */

/** When true (default), deleting an agent asks for confirmation first. */
export const CONFIRM_AGENT_DELETE_KEY = "tokenring-confirm-agent-delete";
export const DEFAULT_CONFIRM_AGENT_DELETE = true;

/** All known frontend UI preference keys cleared by Settings → Clear local preferences. */
export const CLIENT_PREFERENCE_KEYS = ["theme", "tokenring-pinned-apps", "tokenring-recent-apps", "tokenring-chat-inputs", CONFIRM_AGENT_DELETE_KEY] as const;
