import { beforeEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShellProvider, useAppShell } from "./AppShellContext.tsx";

function Harness() {
  const { pinnedAppIds, togglePinnedApp, recentApps, recordRecentApp, isAppSwitcherOpen, toggleAppSwitcher, resetToDefaults } = useAppShell();
  return (
    <div>
      <output aria-label="pins">{pinnedAppIds.join(",")}</output>
      <output aria-label="recent apps">{JSON.stringify(recentApps)}</output>
      <output aria-label="switcher">{String(isAppSwitcherOpen)}</output>
      <button type="button" onClick={() => togglePinnedApp("email")}>
        Email
      </button>
      <button type="button" onClick={() => togglePinnedApp("calendar")}>
        Calendar
      </button>
      <button type="button" onClick={() => togglePinnedApp("database")}>
        Database
      </button>
      <button type="button" onClick={() => recordRecentApp("email")}>
        Visit Email
      </button>
      <button type="button" onClick={() => recordRecentApp("calendar")}>
        Visit Calendar
      </button>
      <button type="button" onClick={() => recordRecentApp("vault")}>
        Visit Vault
      </button>
      <button type="button" onClick={toggleAppSwitcher}>
        Switcher
      </button>
      <button type="button" onClick={resetToDefaults}>
        Reset
      </button>
    </div>
  );
}

describe("AppShellProvider", () => {
  beforeEach(() => localStorage.clear());

  it("persists pin changes and enforces the seven-app rail budget", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: "Calendar" }));
    await user.click(screen.getByRole("button", { name: "Database" }));

    const pins = screen.getByLabelText("pins").textContent?.split(",") ?? [];
    expect(pins).toHaveLength(7);
    expect(pins).not.toContain("database");
    expect(JSON.parse(localStorage.getItem("tokenring-pinned-apps") ?? "[]")).toEqual(pins);
  });

  it("opens the app switcher and resets durable layout state", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Switcher" }));
    expect(screen.getByLabelText("switcher")).toHaveTextContent("true");
    await user.click(screen.getByRole("button", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("switcher")).toHaveTextContent("false");
    expect(screen.getByLabelText("pins")).not.toHaveTextContent("email");
    expect(screen.getByLabelText("recent apps")).toHaveTextContent("[]");
    expect(JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "null")).toEqual([]);
  });

  it("updates an existing app timestamp without changing its position", async () => {
    localStorage.setItem(
      "tokenring-recent-apps",
      JSON.stringify([
        { id: "email", lastVisitedAt: 100 },
        { id: "calendar", lastVisitedAt: 200 },
      ]),
    );
    const originalNow = Date.now;
    Date.now = () => 300;
    const user = userEvent.setup();
    try {
      render(
        <AppShellProvider>
          <Harness />
        </AppShellProvider>,
      );
      await user.click(screen.getByRole("button", { name: "Visit Email" }));

      const entries = JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]");
      expect(entries).toEqual([
        { id: "email", lastVisitedAt: 300 },
        { id: "calendar", lastVisitedAt: 200 },
      ]);
      expect(JSON.parse(screen.getByLabelText("recent apps").textContent ?? "[]")).toEqual(entries);
    } finally {
      Date.now = originalNow;
    }
  });

  it("appends new apps and prunes the least recently visited entry when full", async () => {
    localStorage.setItem(
      "tokenring-recent-apps",
      JSON.stringify([
        { id: "email", lastVisitedAt: 500 },
        { id: "calendar", lastVisitedAt: 100 },
        { id: "database", lastVisitedAt: 400 },
        { id: "media", lastVisitedAt: 300 },
        { id: "blog", lastVisitedAt: 200 },
      ]),
    );
    const originalNow = Date.now;
    Date.now = () => 600;
    const user = userEvent.setup();
    try {
      render(
        <AppShellProvider>
          <Harness />
        </AppShellProvider>,
      );
      await user.click(screen.getByRole("button", { name: "Visit Email" }));
      await user.click(screen.getByRole("button", { name: "Visit Vault" }));

      const entries = JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["email", "database", "media", "blog", "vault"]);
    } finally {
      Date.now = originalNow;
    }
  });

  it("removes newly pinned apps from recents and does not track pinned visits", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Visit Email" }));
    await user.click(screen.getByRole("button", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: "Visit Email" }));

    expect(JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]")).toEqual([]);
  });
});
