import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

const setTheme = mock((_next: string) => undefined);
const setAccent = mock((_next: string) => undefined);
const setDensity = mock((_next: string) => undefined);
const toggleSwitcher = mock(() => undefined);
const resetToDefaults = mock(() => undefined);
const successToast = mock((_msg: string) => "toast-id");
const restore = mock((_id: string) => undefined);
const restoreAll = mock(() => undefined);

let preference = "light";
let resolved = "light";
let accent = "indigo";
let density = "default";
let localStorageAvailable = true;
let skippedIds: string[] = [];

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => [resolved, setTheme, preference] as const,
  useThemeSettings: () => ({ preference, resolved, accent, density, setPreference: setTheme, setAccent, setDensity }),
}));

void mock.module("../../components/layout/AppShellContext.tsx", () => ({
  MAX_PINNED_DASHBOARDS: 7,
  useAppShell: () => ({
    pinnedDashboardIds: ["agents", "workflows", "research", "files", "terminal"],
    toggleSwitcher,
    resetToDefaults,
    localStorageAvailable,
  }),
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  notificationManager: { success: successToast, error: mock(), info: mock(), warning: mock() },
  toastManager: { success: mock(), error: mock(), info: mock(), warning: mock() },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

function NoDialog() {
  return null;
}
let confirmResult = true;
let lastConfirm: Record<string, unknown> | null = null;
void mock.module("../../hooks/useConfirmDialog.tsx", () => ({
  useConfirmDialog: () => ({
    openConfirm: async (options: Record<string, unknown>) => {
      lastConfirm = options;
      return confirmResult;
    },
    Dialog: NoDialog,
  }),
  useConfirmSkipPreferences: () => ({ skippedIds, restore, restoreAll }),
}));

let resetCalls = 0;
void mock.module("@tokenring-ai/web-host/createWsRPCClient", () => ({
  isRpcConnectionClosed: () => false,
  resetWsRPCConnections: () => {
    resetCalls += 1;
  },
  setWsRPCAuthHandler: () => {},
}));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { defineView } = await import("../../layout/define.ts");
const { clearRpcAuth, setRpcAuthUsername } = await import("../../rpcAuth.ts");
const { confirmSkipLabel } = await import("./SettingsConfirmationsView.tsx");
const { isApplePlatform } = await import("./SettingsShortcuts.tsx");
const { SETTINGS_VIEWS } = await import("./views.ts");
const { SETTINGS_APP } = await import("./manifest.ts");
const asView = (id: string, component: () => React.ReactNode) => defineView({ id, kind: "page", title: id, icon: SETTINGS_APP.icon, route: "", component });
const settingsAboutView = asView("about", (await import("./SettingsAboutView.tsx")).default);
const settingsAppearanceView = asView("appearance", (await import("./SettingsAppearanceView.tsx")).default);
const settingsConfirmationsView = asView("confirmations", (await import("./SettingsConfirmationsView.tsx")).default);
const settingsDataView = asView("data", (await import("./SettingsDataView.tsx")).default);
const settingsLayoutView = asView("layout", (await import("./SettingsLayoutView.tsx")).default);
const settingsSettingsView = SETTINGS_VIEWS[0]!;

describe("Settings views", () => {
  beforeEach(() => {
    setTheme.mockClear();
    setAccent.mockClear();
    setDensity.mockClear();
    accent = "indigo";
    density = "default";
    toggleSwitcher.mockClear();
    resetToDefaults.mockClear();
    successToast.mockClear();
    restore.mockClear();
    restoreAll.mockClear();
    preference = "light";
    resolved = "light";
    localStorageAvailable = true;
    skippedIds = [];
    confirmResult = true;
    lastConfirm = null;
  });

  describe("appearance", () => {
    it("switches theme preference", async () => {
      renderLayoutView(settingsAppearanceView);
      await userEvent.click(await screen.findByRole("button", { name: /dark/i }));
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("marks the active theme option", async () => {
      preference = "dark";
      renderLayoutView(settingsAppearanceView);
      expect(await screen.findByRole("button", { name: /dark/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: /light/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("explains what system means, naming the resolved theme", async () => {
      preference = "system";
      resolved = "dark";
      renderLayoutView(settingsAppearanceView);
      expect(await screen.findByText(/Follows system appearance \(currently dark\)/)).toBeInTheDocument();
    });

    it("marks the active accent swatch and switches accent", async () => {
      accent = "teal";
      renderLayoutView(settingsAppearanceView);
      expect(await screen.findByRole("button", { name: "Teal" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Indigo" })).toHaveAttribute("aria-pressed", "false");
      await userEvent.click(screen.getByRole("button", { name: "Rose" }));
      expect(setAccent).toHaveBeenCalledWith("rose");
    });

    it("switches density", async () => {
      renderLayoutView(settingsAppearanceView);
      expect(await screen.findByRole("button", { name: "Default" })).toHaveAttribute("aria-pressed", "true");
      await userEvent.click(screen.getByRole("button", { name: "Compact" }));
      expect(setDensity).toHaveBeenCalledWith("compact");
    });
  });

  describe("layout", () => {
    it("opens pinned dashboard management", async () => {
      renderLayoutView(settingsLayoutView);
      await userEvent.click(await screen.findByRole("button", { name: "Manage" }));
      expect(toggleSwitcher).toHaveBeenCalled();
    });

    it("shows accurate pinned-dashboard copy", async () => {
      renderLayoutView(settingsLayoutView);
      expect(await screen.findByText("5 of 7 shortcuts shown in the rail")).toBeInTheDocument();
    });

    it("resets the rail after confirmation, and describes it accurately", async () => {
      renderLayoutView(settingsLayoutView);
      await userEvent.click(await screen.findByRole("button", { name: /reset/i }));
      await waitFor(() => expect(resetToDefaults).toHaveBeenCalled());
      expect(lastConfirm?.message).toBe("Pinned and recent dashboards will return to defaults on this device.");
      expect(successToast).toHaveBeenCalledWith("Rail reset to defaults");
    });

    it("keeps every copy of the reopen-last-dashboard switch in sync with storage", async () => {
      localStorage.removeItem("tokenring-restore-last-dashboard");
      const { readRestoreLastDashboard } = await import("../../hooks/useRestoreLastSession.ts");
      renderLayoutView(settingsLayoutView);
      renderLayoutView(settingsLayoutView);
      const switches = () => screen.getAllByRole("switch", { name: "Reopen last dashboard on launch" });
      expect(switches().map(el => el.getAttribute("aria-checked"))).toEqual(["false", "false"]);
      await userEvent.click(switches()[0]!);
      await waitFor(() => expect(switches().map(el => el.getAttribute("aria-checked"))).toEqual(["true", "true"]));
      expect(localStorage.getItem("tokenring-restore-last-dashboard")).toBe("true");
      expect(readRestoreLastDashboard()).toBe(true);
      await userEvent.click(switches()[1]!);
      await waitFor(() => expect(switches().map(el => el.getAttribute("aria-checked"))).toEqual(["false", "false"]));
      expect(readRestoreLastDashboard()).toBe(false);
    });

    it("does not reset when the confirmation is declined", async () => {
      confirmResult = false;
      renderLayoutView(settingsLayoutView);
      await userEvent.click(await screen.findByRole("button", { name: /reset/i }));
      await waitFor(() => expect(lastConfirm).not.toBeNull());
      expect(resetToDefaults).not.toHaveBeenCalled();
    });
  });

  describe("confirmations", () => {
    it("shows all prompts enabled when nothing is skipped", async () => {
      renderLayoutView(settingsConfirmationsView);
      expect(await screen.findByText("All prompts enabled")).toBeInTheDocument();
    });

    it("lists skipped prompts and restores them individually or all at once", async () => {
      skippedIds = ["delete-memory", "reset-layout"];
      renderLayoutView(settingsConfirmationsView);
      expect(await screen.findByText("delete-memory")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Restore “reset-layout” confirmation prompt" }));
      expect(restore).toHaveBeenCalledWith("reset-layout");
      await userEvent.click(screen.getByRole("button", { name: "Restore all" }));
      expect(restoreAll).toHaveBeenCalled();
    });
  });

  describe("confirmation labels", () => {
    it("turns scope:action ids into readable labels", () => {
      expect(confirmSkipLabel("agents:delete-agent")).toBe("Delete agent (Agents)");
      expect(confirmSkipLabel("debug:snapshot-delete")).toBe("Snapshot delete (Debug)");
    });

    it("leaves title keys and odd ids as stored", () => {
      expect(confirmSkipLabel("Delete Agent")).toBe("Delete Agent");
      expect(confirmSkipLabel("delete-memory")).toBe("delete-memory");
      expect(confirmSkipLabel("weird:")).toBe("weird:");
    });

    it("shows the readable label in the list and restores by the raw id", async () => {
      skippedIds = ["agents:delete-agent"];
      renderLayoutView(settingsConfirmationsView);
      expect(await screen.findByText("Delete agent (Agents)")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Restore “Delete agent (Agents)” confirmation prompt" }));
      expect(restore).toHaveBeenCalledWith("agents:delete-agent");
    });
  });

  describe("shortcuts", () => {
    it("detects Apple platforms", () => {
      expect(isApplePlatform({ platform: "MacIntel", userAgent: "" })).toBe(true);
      expect(isApplePlatform({ platform: "Win32", userAgent: "" })).toBe(false);
      expect(isApplePlatform({ platform: "Linux x86_64", userAgent: "" })).toBe(false);
    });

    it("shows only the platform's modifier", async () => {
      renderLayoutView(settingsSettingsView);
      const apple = isApplePlatform();
      expect(await screen.findByText(apple ? "⌘K" : "Ctrl+K")).toBeInTheDocument();
      expect(screen.queryByText(/⌘K \/ Ctrl\+K/)).toBeNull();
      expect(screen.queryByText(apple ? "Ctrl+K" : "⌘K")).toBeNull();
    });
  });

  describe("account", () => {
    const realFetch = globalThis.fetch;
    beforeEach(() => {
      resetCalls = 0;
      globalThis.fetch = (async () => new Response(null, { status: 204 })) as unknown as typeof fetch;
    });
    afterEach(() => {
      globalThis.fetch = realFetch;
      clearRpcAuth();
      sessionStorage.clear();
    });

    it("is hidden when not signed in", async () => {
      renderLayoutView(settingsSettingsView);
      await screen.findByText("Appearance");
      expect(screen.queryByText("Account")).toBeNull();
      expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    });

    it("shows the signed-in user and signs out", async () => {
      act(() => setRpcAuthUsername("mark"));
      renderLayoutView(settingsSettingsView);
      expect(await screen.findByText("Account")).toBeInTheDocument();
      expect(screen.getByText("mark")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
      await waitFor(() => expect(resetCalls).toBe(1));
      await waitFor(() => expect(screen.queryByText("Account")).toBeNull());
    });
  });

  describe("data", () => {
    it("lists every category cleared in the confirmation", async () => {
      confirmResult = false;
      renderLayoutView(settingsDataView);
      await userEvent.click(await screen.findByRole("button", { name: /clear/i }));
      const message = String(lastConfirm?.message);
      for (const phrase of ["pinned and recent dashboards", "agent session names", "per-app view state", "stocks watchlist", "calendar events"]) {
        expect(message).toContain(phrase);
      }
    });

    it("warns when localStorage is unavailable and disables clearing", async () => {
      localStorageAvailable = false;
      renderLayoutView(settingsDataView);
      expect(await screen.findByText(/Browser storage is unavailable/)).toBeInTheDocument();
      expect(screen.getByText("Unavailable")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
    });

    it("clears only known client preference keys, without rewriting them first", async () => {
      localStorage.setItem("theme", "dark");
      localStorage.setItem("tokenring-chat-inputs", JSON.stringify({ a: "draft" }));
      localStorage.setItem("tokenring-confirm-skips", JSON.stringify({ "Delete Agent": true }));
      localStorage.setItem("tokenring-dashboard-layout:home", "{}");
      // Not ours: user content must survive.
      localStorage.setItem("tokenring:calendar:events", "[]");

      const reload = mock(() => undefined);
      const reloadTimers: Array<() => void> = [];
      const originalSetTimeout = globalThis.setTimeout;
      // Intercept only the post-clear reload delay; leave other timers alone for userEvent.
      globalThis.setTimeout = ((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (delay === 400 && typeof fn === "function") {
          reloadTimers.push(fn as () => void);
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }
        return originalSetTimeout(fn as Parameters<typeof setTimeout>[0], delay as number, ...args);
      }) as unknown as typeof setTimeout;
      try {
        Object.defineProperty(window.location, "reload", { configurable: true, value: reload });
      } catch {
        // jsdom may freeze Location#reload; the storage assertions still cover the behaviour
      }

      try {
        renderLayoutView(settingsDataView);
        await userEvent.click(await screen.findByRole("button", { name: /^clear$/i }));
        await waitFor(() => expect(successToast).toHaveBeenCalledWith("Local preferences cleared"));

        expect(localStorage.getItem("theme")).toBeNull();
        expect(localStorage.getItem("tokenring-chat-inputs")).toBeNull();
        expect(localStorage.getItem("tokenring-confirm-skips")).toBeNull();
        // Covered by CLIENT_PREFERENCE_KEY_PREFIXES, so the dashboard-layout family goes too.
        expect(localStorage.getItem("tokenring-dashboard-layout:home")).toBeNull();
        // User content keys are intentionally preserved.
        expect(localStorage.getItem("tokenring:calendar:events")).toBe("[]");
        // setTheme/resetToDefaults must not run: they would write the values back before the reload.
        expect(setTheme).not.toHaveBeenCalled();
        expect(resetToDefaults).not.toHaveBeenCalled();

        expect(reloadTimers).toHaveLength(1);
      } finally {
        globalThis.setTimeout = originalSetTimeout;
        localStorage.clear();
      }
    });
  });

  describe("about", () => {
    it("shows the package version", async () => {
      const { default: packageJSON } = await import("../../../package.json", { with: { type: "json" } });
      renderLayoutView(settingsAboutView);
      expect(await screen.findByText(`v${packageJSON.version}`)).toBeInTheDocument();
    });

    it("links to server configuration and plugins", async () => {
      renderLayoutView(settingsAboutView);
      expect(await screen.findByRole("link", { name: /Server configuration/ })).toHaveAttribute("href", "/configuration");
      expect(screen.getByRole("link", { name: /Plugins/ })).toHaveAttribute("href", "/plugins");
    });

    it("exposes external resource links", async () => {
      renderLayoutView(settingsAboutView);
      const github = await screen.findByRole("link", { name: "GitHub" });
      expect(github).toHaveAttribute("href", "https://github.com/tokenring-ai");
      expect(github).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("combined settings page", () => {
    it("renders every section in one view", async () => {
      renderLayoutView(settingsSettingsView);
      expect(await screen.findByRole("button", { name: /dark/i })).toBeInTheDocument(); // appearance
      expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument(); // layout
      expect(screen.getByText("All prompts enabled")).toBeInTheDocument(); // confirmations
      expect(screen.getByText("Local storage")).toBeInTheDocument(); // data
      expect(screen.getByRole("link", { name: /Server configuration/ })).toBeInTheDocument(); // about
      expect(screen.getByRole("link", { name: "GitHub" })).toBeInTheDocument(); // resources
    });

    it("switches the theme from the combined page", async () => {
      renderLayoutView(settingsSettingsView);
      await userEvent.click(await screen.findByRole("button", { name: /dark/i }));
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("groups the sections under labelled headings", async () => {
      renderLayoutView(settingsSettingsView);
      for (const heading of ["Appearance", "Layout", "Confirmations", "Data", "Configuration", "About", "Resources"]) {
        expect(await screen.findByText(heading)).toBeInTheDocument();
      }
    });
  });

  describe("app", () => {
    it("serves the whole settings page as one view at /settings", () => {
      expect(SETTINGS_APP.path).toBe("/settings");
      expect(SETTINGS_APP.layout).toEqual({ presenter: "single", accepts: ["page"], items: ["settings"], primary: true });
      expect(settingsSettingsView.route).toBe("");
    });
  });
});
