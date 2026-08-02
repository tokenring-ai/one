import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

const setTheme = mock((_next: string) => undefined);
const toggleSidebar = mock(() => undefined);
const resetToDefaults = mock(() => undefined);
const successToast = mock((_msg: string) => "toast-id");

let preference = "light";
let resolved = "light";
let isSidebarExpanded = true;
let localStorageAvailable = true;

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => [resolved, setTheme, preference] as const,
}));

void mock.module("../../components/SidebarContext.tsx", () => ({
  useSidebar: () => ({
    isSidebarExpanded,
    toggleSidebar,
    resetToDefaults,
    localStorageAvailable,
    setSidebarExpanded: mock(),
    isMobileOpen: false,
    setMobileOpen: mock(),
    toggleMobileSidebar: mock(),
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
    toggleSidebar.mockClear();
    resetToDefaults.mockClear();
    successToast.mockClear();
    preference = "light";
    resolved = "light";
    isSidebarExpanded = true;
    localStorageAvailable = true;
    localStorage.clear();
  });

  it("renders core preference sections", () => {
    renderSettings();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Data")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
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

  it("toggles the sidebar", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole("switch", { name: /Toggle expanded sidebar/i }));
    expect(toggleSidebar).toHaveBeenCalled();
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

  it("clears local preference keys after confirmation without resetting in-memory first", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme", "dark");
    localStorage.setItem("tokenring-sidebar-expanded", "false");
    localStorage.setItem("tokenring-mobile-open", "true");
    localStorage.setItem("tokenring-chat-inputs", JSON.stringify({ a: "draft" }));
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
      await user.click(screen.getByRole("button", { name: /Clear preferences/i }));

      expect(localStorage.getItem("theme")).toBeNull();
      expect(localStorage.getItem("tokenring-sidebar-expanded")).toBeNull();
      expect(localStorage.getItem("tokenring-mobile-open")).toBeNull();
      expect(localStorage.getItem("tokenring-chat-inputs")).toBeNull();
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
