import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

const setTheme = mock((_next: string) => undefined);
const toggleAppSwitcher = mock(() => undefined);
const resetToDefaults = mock(() => undefined);
const successToast = mock((_msg: string) => "toast-id");

let preference = "light";
let resolved = "light";
let localStorageAvailable = true;

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => [resolved, setTheme, preference] as const,
}));

void mock.module("../../components/layout/AppShellContext.tsx", () => ({
  MAX_PINNED_APPS: 7,
  useAppShell: () => ({
    pinnedAppIds: ["agents", "workflows", "research", "files", "terminal"],
    toggleAppSwitcher,
    resetToDefaults,
    localStorageAvailable,
  }),
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  notificationManager: {
    success: successToast,
    error: mock(),
    info: mock(),
    warning: mock(),
  },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: SettingsApp } = await import("./SettingsApp.tsx");

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsApp />
    </MemoryRouter>,
  );
}

describe("SettingsApp", () => {
  beforeEach(() => {
    setTheme.mockClear();
    toggleAppSwitcher.mockClear();
    resetToDefaults.mockClear();
    successToast.mockClear();
    preference = "light";
    resolved = "light";
    localStorageAvailable = true;
    localStorage.clear();
  });

  it("renders core preference sections", () => {
    renderSettings();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByText("Confirmations")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
  });

  it("toggles agent deletion confirmation preference", async () => {
    const user = userEvent.setup();
    renderSettings();

    const toggle = screen.getByRole("button", { name: /Disable agent deletion confirmation/i });
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(localStorage.getItem("tokenring-confirm-agent-delete")).toBe("false");
    expect(screen.getByRole("button", { name: /Enable agent deletion confirmation/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Agents delete immediately/i)).toBeInTheDocument();
  });

  it("shows package version in About", async () => {
    renderSettings();
    const version = await import("../../../package.json", { with: { type: "json" } });
    expect(screen.getByText(`v${version.default.version}`)).toBeInTheDocument();
  });

  it("switches theme preference", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /Dark/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");

    await user.click(screen.getByRole("button", { name: /System/i }));
    expect(setTheme).toHaveBeenCalledWith("system");
  });

  it("opens pinned app management", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /Manage/i }));
    expect(toggleAppSwitcher).toHaveBeenCalled();
  });

  it("resets layout after confirmation", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /^Reset$/i }));
    expect(screen.getByText("Reset layout?")).toBeInTheDocument();

    // Dialog confirm button shares the label "Reset" with the row action
    const resetButtons = screen.getAllByRole("button", { name: /^Reset$/i });
    await user.click(resetButtons[resetButtons.length - 1]!);
    await waitFor(() => {
      expect(resetToDefaults).toHaveBeenCalled();
      expect(successToast).toHaveBeenCalled();
    });
  });

  it("links to server configuration and plugins", () => {
    renderSettings();
    expect(screen.getByRole("link", { name: /Server configuration/i })).toHaveAttribute("href", "/configuration");
    expect(screen.getByRole("link", { name: /Plugins/i })).toHaveAttribute("href", "/plugins");
  });

  it("warns when localStorage is unavailable", () => {
    localStorageAvailable = false;
    renderSettings();
    expect(screen.getByText(/Browser storage is unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clear/i })).toBeDisabled();
  });

  it("marks the active theme option", () => {
    preference = "system";
    resolved = "dark";
    renderSettings();
    expect(screen.getByRole("button", { name: /System/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/currently dark/i)).toBeInTheDocument();
  });

  it("shows accurate reset-layout and pinned-apps copy", () => {
    renderSettings();
    expect(screen.getByText("5 of 7 shortcuts shown in the compact app rail")).toBeInTheDocument();
    expect(screen.getByText("Restore pinned apps and recent apps to defaults")).toBeInTheDocument();
  });

  it("describes reset layout accurately in the confirmation dialog", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("button", { name: /^Reset$/i }));
    expect(screen.getByText("Pinned apps and recent apps will return to defaults on this device.")).toBeInTheDocument();
  });

  it("clears local preference keys after confirmation without resetting in-memory first", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme", "dark");
    localStorage.setItem("tokenring-pinned-apps", '["agents"]');
    localStorage.setItem("tokenring-recent-apps", '["email"]');
    localStorage.setItem("tokenring-workspace-navigation-open:research", "false");
    localStorage.setItem("tokenring-chat-inputs", JSON.stringify({ a: "draft" }));
    localStorage.setItem("tokenring-confirm-agent-delete", "false");
    localStorage.setItem("tokenring:calendar:events", "[]");

    const reload = mock(() => undefined);
    const reloadTimers: Array<() => void> = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalReload = window.location.reload;

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
      // jsdom may freeze Location#reload; storage assertions still cover clear behavior
    }

    try {
      renderSettings();

      await user.click(screen.getByRole("button", { name: /^Clear$/i }));
      expect(screen.getByText("Clear local preferences?")).toBeInTheDocument();
      expect(screen.getByText(/This removes theme, layout, confirmation prompts, and chat draft data stored in this browser/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Clear preferences/i }));

      expect(localStorage.getItem("theme")).toBeNull();
      expect(localStorage.getItem("tokenring-pinned-apps")).toBeNull();
      expect(localStorage.getItem("tokenring-recent-apps")).toBeNull();
      expect(localStorage.getItem("tokenring-workspace-navigation-open:research")).toBeNull();
      expect(localStorage.getItem("tokenring-chat-inputs")).toBeNull();
      expect(localStorage.getItem("tokenring-confirm-agent-delete")).toBeNull();
      // User content keys are intentionally preserved
      expect(localStorage.getItem("tokenring:calendar:events")).toBe("[]");
      // Avoid re-writing defaults before reload
      expect(setTheme).not.toHaveBeenCalled();
      expect(resetToDefaults).not.toHaveBeenCalled();
      expect(successToast).toHaveBeenCalledWith("Local preferences cleared");

      expect(reloadTimers).toHaveLength(1);
      reloadTimers[0]!();
      if (window.location.reload === reload) {
        expect(reload).toHaveBeenCalled();
      }
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      try {
        Object.defineProperty(window.location, "reload", { configurable: true, value: originalReload });
      } catch {
        // ignore restore failures in jsdom
      }
    }
  });

  it("exposes external resource links", () => {
    renderSettings();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/tokenring-ai");
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://tokenring.ai");
    expect(screen.getByRole("link", { name: "X / Twitter" })).toHaveAttribute("href", "https://x.com/TokenRingAI");
  });
});
