import { beforeEach, describe, expect, it } from "bun:test";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { getConfigurationState, resetConfigurationStore, setConfigDraft, setDraftPersistenceContext } from "./configurationStore.ts";

const providerPlugin = {
  pluginName: "@tokenring-ai/ai-client",
  displayName: "AI Client",
  description: "",
  version: "1",
  slices: {
    ai: {
      kind: "group",
      key: "ai",
      path: ["ai"],
      label: "AI",
      children: [
        { kind: "field", key: "model", path: ["model"], label: "Model", field: { type: "string" }, required: false },
        { kind: "field", key: "password", path: ["password"], label: "Password", field: { type: "string" }, required: false, sensitive: true },
        { kind: "secret", key: "apiKey", path: ["apiKey"], label: "API key", required: false, sensitive: true },
      ],
    },
  },
} as unknown as ConfigUIPluginSchema;

const storedDrafts = () => JSON.parse(localStorage.getItem("tokenring-configuration-drafts")!);

describe("configurationStore draft persistence", () => {
  beforeEach(() => {
    localStorage.removeItem("tokenring-configuration-drafts");
    setDraftPersistenceContext(null);
    resetConfigurationStore();
  });

  it("keeps typed secrets out of storage but in memory", () => {
    const redacted = { __sensitive: true, isSet: true };
    setDraftPersistenceContext({ plugins: [providerPlugin], serverOverrides: { global: { ai: { password: redacted } } } });

    const draft = { ai: { model: "gpt", password: "hunter2", apiKey: "sk-typed" } };
    setConfigDraft("global", draft);

    expect(getConfigurationState().drafts.global).toEqual(draft);
    const raw = localStorage.getItem("tokenring-configuration-drafts")!;
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("sk-typed");
    // The secret falls back to what the server already had; a never-set one is dropped.
    expect(storedDrafts().global).toEqual({ ai: { model: "gpt", password: redacted } });

    // Env references are pointers, not secrets.
    setConfigDraft("global", { ai: { apiKey: { source: "env", env: "OPENAI_KEY" } } });
    expect(storedDrafts().global).toEqual({ ai: { apiKey: { source: "env", env: "OPENAI_KEY" } } });
  });

  it("writes nothing until it knows which fields are secret", () => {
    setConfigDraft("global", { ai: { password: "hunter2" } });
    expect(localStorage.getItem("tokenring-configuration-drafts")).toBeNull();

    setDraftPersistenceContext({ plugins: [providerPlugin], serverOverrides: {} });
    expect(storedDrafts().global).toEqual({ ai: {} });
  });

  it("persists drafts to localStorage and drops the key when empty", () => {
    setDraftPersistenceContext({ plugins: [], serverOverrides: {} });
    setConfigDraft("global", { aiClient: { defaultModel: "x" } });
    expect(JSON.parse(localStorage.getItem("tokenring-configuration-drafts")!)).toEqual({
      global: { aiClient: { defaultModel: "x" } },
      workspace: null,
    });

    // Saving (draft dropped) clears storage once both scopes are clean.
    setConfigDraft("global", null);
    expect(localStorage.getItem("tokenring-configuration-drafts")).toBeNull();
  });

  it("rehydrates drafts from localStorage on module load", () => {
    // Seed storage the way a previous session would have left it.
    localStorage.setItem("tokenring-configuration-drafts", JSON.stringify({ global: { filesystem: { maxRows: 5 } }, workspace: null }));

    // The store reads storage at module import; a reset re-initializes from it
    // because INITIAL drafts are computed by loadPersistedDrafts().
    resetConfigurationStore();
    expect(getConfigurationState().drafts.global).toEqual({ filesystem: { maxRows: 5 } });
  });

  it("ignores corrupted or malformed persisted drafts", () => {
    localStorage.setItem("tokenring-configuration-drafts", "not json{");
    resetConfigurationStore();
    expect(getConfigurationState().drafts.global).toBeNull();

    localStorage.setItem("tokenring-configuration-drafts", JSON.stringify({ global: "scalar-not-object", workspace: [1, 2] }));
    resetConfigurationStore();
    expect(getConfigurationState().drafts.global).toBeNull();
    expect(getConfigurationState().drafts.workspace).toBeNull();
  });
});

describe("Clear local preferences coverage", () => {
  it("lists the drafts key and the other reported keys (exact keys vs prefixes)", async () => {
    const { CLIENT_PREFERENCE_KEY_PREFIXES, CLIENT_PREFERENCE_KEYS } = await import("../../lib/uiPreferences.ts");
    const covered = (key: string) =>
      (CLIENT_PREFERENCE_KEYS as readonly string[]).includes(key) || CLIENT_PREFERENCE_KEY_PREFIXES.some(prefix => key.startsWith(prefix));

    expect(covered("tokenring-configuration-drafts")).toBe(true);
    expect(covered("stocks:watchlist")).toBe(true);
    expect(covered("tasks.boardMode.board-1")).toBe(true);
  });
});
