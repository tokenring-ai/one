import { beforeEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShellProvider, useAppShell } from "./AppShellContext.tsx";

function Harness() {
  const { pinnedDashboardIds, togglePinnedDashboard, recentDashboards, recordRecentDashboard, isSwitcherOpen, toggleSwitcher, resetToDefaults } = useAppShell();
  return (
    <div>
      <output aria-label="pins">{pinnedDashboardIds.join(",")}</output>
      <output aria-label="recent dashboards">{JSON.stringify(recentDashboards)}</output>
      <output aria-label="switcher">{String(isSwitcherOpen)}</output>
      <button type="button" onClick={() => togglePinnedDashboard("tasks")}>
        Tasks
      </button>
      <button type="button" onClick={() => togglePinnedDashboard("metrics")}>
        Metrics
      </button>
      <button type="button" onClick={() => togglePinnedDashboard("database")}>
        Database
      </button>
      <button type="button" onClick={() => recordRecentDashboard("tasks")}>
        Visit Tasks
      </button>
      <button type="button" onClick={() => recordRecentDashboard("metrics")}>
        Visit Metrics
      </button>
      <button type="button" onClick={() => recordRecentDashboard("vault")}>
        Visit Vault
      </button>
      <button type="button" onClick={toggleSwitcher}>
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

  it("persists pin changes and enforces the seven-dashboard rail budget", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Metrics" }));
    await user.click(screen.getByRole("button", { name: "Database" }));

    const pins = screen.getByLabelText("pins").textContent?.split(",") ?? [];
    expect(pins).toHaveLength(7);
    expect(pins).not.toContain("database");
    expect(JSON.parse(localStorage.getItem("tokenring-pinned-dashboards") ?? "[]")).toEqual(pins);
  });

  it("opens the switcher and resets durable rail state", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Switcher" }));
    expect(screen.getByLabelText("switcher")).toHaveTextContent("true");
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("switcher")).toHaveTextContent("false");
    expect(screen.getByLabelText("pins")).not.toHaveTextContent("tasks");
    expect(screen.getByLabelText("recent dashboards")).toHaveTextContent("[]");
    expect(JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "null")).toEqual([]);
  });

  it("updates an existing dashboard timestamp without changing its position", async () => {
    localStorage.setItem(
      "tokenring-recent-dashboards",
      JSON.stringify([
        { id: "tasks", lastVisitedAt: 100 },
        { id: "metrics", lastVisitedAt: 200 },
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
      await user.click(screen.getByRole("button", { name: "Visit Tasks" }));

      const entries = JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]");
      expect(entries).toEqual([
        { id: "tasks", lastVisitedAt: 300 },
        { id: "metrics", lastVisitedAt: 200 },
      ]);
      expect(JSON.parse(screen.getByLabelText("recent dashboards").textContent ?? "[]")).toEqual(entries);
    } finally {
      Date.now = originalNow;
    }
  });

  it("appends new dashboards and prunes the least recently visited entry when full", async () => {
    localStorage.setItem(
      "tokenring-recent-dashboards",
      JSON.stringify([
        { id: "tasks", lastVisitedAt: 500 },
        { id: "metrics", lastVisitedAt: 100 },
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
      await user.click(screen.getByRole("button", { name: "Visit Tasks" }));
      await user.click(screen.getByRole("button", { name: "Visit Vault" }));

      const entries = JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["tasks", "database", "media", "blog", "vault"]);
    } finally {
      Date.now = originalNow;
    }
  });

  it("removes newly pinned dashboards from recents and does not track pinned visits", async () => {
    const user = userEvent.setup();
    render(
      <AppShellProvider>
        <Harness />
      </AppShellProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Visit Tasks" }));
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Visit Tasks" }));

    expect(JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]")).toEqual([]);
  });
});
