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
});
