import { afterEach, describe, expect, it } from "bun:test";
import {
  CONFIRM_SKIPS_CHANGED_EVENT,
  CONFIRM_SKIPS_KEY,
  clearConfirmSkips,
  isConfirmSkipped,
  readConfirmSkips,
  runOrConfirm,
  setConfirmSkipped,
} from "./uiPreferences.ts";

describe("uiPreferences confirm skips", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("treats missing or invalid storage as no skips", () => {
    expect(readConfirmSkips()).toEqual({});
    expect(isConfirmSkipped("Delete Agent")).toBe(false);

    localStorage.setItem(CONFIRM_SKIPS_KEY, "not-json");
    expect(readConfirmSkips()).toEqual({});

    localStorage.setItem(CONFIRM_SKIPS_KEY, JSON.stringify(["Delete Agent"]));
    expect(readConfirmSkips()).toEqual({});
  });

  it("persists and clears individual skips", () => {
    const events: string[] = [];
    const onChange = () => events.push("changed");
    window.addEventListener(CONFIRM_SKIPS_CHANGED_EVENT, onChange);
    try {
      setConfirmSkipped("Delete Agent", true);
      expect(isConfirmSkipped("Delete Agent")).toBe(true);
      expect(readConfirmSkips()).toEqual({ "Delete Agent": true });

      setConfirmSkipped("Delete Agent", true);
      setConfirmSkipped("Close Terminal", false);
      expect(events).toEqual(["changed"]);

      setConfirmSkipped("Delete Agent", false);
      expect(isConfirmSkipped("Delete Agent")).toBe(false);
      expect(readConfirmSkips()).toEqual({});
      expect(events).toEqual(["changed", "changed"]);
    } finally {
      window.removeEventListener(CONFIRM_SKIPS_CHANGED_EVENT, onChange);
    }
  });

  it("clearConfirmSkips empties the map", () => {
    setConfirmSkipped("Delete Agent", true);
    clearConfirmSkips();
    expect(readConfirmSkips()).toEqual({});
  });

  it("runOrConfirm shows or runs based on the skip list", () => {
    const shown: string[] = [];
    const ran: string[] = [];

    runOrConfirm(
      "Delete workflow",
      () => shown.push("first"),
      () => ran.push("first"),
    );
    expect(shown).toEqual(["first"]);
    expect(ran).toEqual([]);

    setConfirmSkipped("Delete workflow", true);
    runOrConfirm(
      "Delete workflow",
      () => shown.push("second"),
      () => ran.push("second"),
    );
    expect(shown).toEqual(["first"]);
    expect(ran).toEqual(["second"]);
  });
});

describe("uiPreferences key coverage", () => {
  /**
   * Every localStorage key the frontend and plugin frontends write (literal keys
   * and an example of each templated key). Add new keys here and to
   * CLIENT_PREFERENCE_KEYS / CLIENT_PREFERENCE_KEY_PREFIXES together.
   */
  const KNOWN_KEYS = [
    "theme",
    "tokenring-pinned-dashboards",
    "tokenring-recent-dashboards",
    "tokenring-chat-inputs",
    "tokenring-confirm-skips",
    "tokenring-configuration-drafts",
    "tokenring-restore-last-dashboard",
    "tokenring.agentSessionMeta",
    "tokenring-dashboard-layout:coding",
    "chat.hideToolCalls",
    "agentSessionList:coding:expanded",
    "agentSession:scheduler",
    "terminal:inputModes",
    "terminal:fontSize",
    "terminal:commandHistory",
    "workflows:drafts",
    "blog:provider",
    "blog:drafts",
    "blog:new-post",
    "github:repo",
    "github:recent-repos",
    "github:account",
    "github:list-kind",
    "github:list-state",
    "github:new-issue:owner/repo",
    "webdesign:device",
    "webdesign:auto-preview",
    "tasks.boardMode.board-1",
    "stocks:watchlist",
  ];

  it("clears every known preference key", async () => {
    const { CLIENT_PREFERENCE_KEYS, CLIENT_PREFERENCE_KEY_PREFIXES } = await import("./uiPreferences.ts");
    const uncovered = KNOWN_KEYS.filter(
      key => !(CLIENT_PREFERENCE_KEYS as readonly string[]).includes(key) && !CLIENT_PREFERENCE_KEY_PREFIXES.some(prefix => key.startsWith(prefix)),
    );
    expect(uncovered).toEqual([]);
  });

  it("does not clear user data that has no other copy", async () => {
    const { CLIENT_DATA_KEYS_NOT_CLEARED, CLIENT_PREFERENCE_KEYS, CLIENT_PREFERENCE_KEY_PREFIXES } = await import("./uiPreferences.ts");
    for (const key of CLIENT_DATA_KEYS_NOT_CLEARED) {
      expect((CLIENT_PREFERENCE_KEYS as readonly string[]).includes(key)).toBe(false);
      expect(CLIENT_PREFERENCE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))).toBe(false);
    }
  });
});
