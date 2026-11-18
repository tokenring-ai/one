import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: DashboardRail } = await import("./DashboardRail.tsx");
const { AppShellProvider } = await import("./AppShellContext.tsx");

function renderNavigation(path = "/tasks") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShellProvider>
        <DashboardRail />
      </AppShellProvider>
    </MemoryRouter>,
  );
}

describe("DashboardRail", () => {
  beforeEach(() => localStorage.clear());

  it("renders pinned dashboards first and the active unpinned dashboard under recents", async () => {
    renderNavigation();

    const rail = screen.getByRole("navigation", { name: "Dashboards" });
    const pinned = within(rail).getByRole("group", { name: "Pinned dashboards" });
    const recent = within(rail).getByRole("group", { name: "Recently used dashboards" });
    expect(within(pinned).queryByRole("button", { name: "Tasks" })).not.toBeInTheDocument();
    expect(within(recent).getByRole("button", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
    expect(within(rail).getAllByRole("button")).toHaveLength(8);
    await waitFor(() => {
      const entries = JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["tasks"]);
    });
  });

  it("restores, sanitizes, and orders recently used dashboards below pins", async () => {
    localStorage.setItem(
      "tokenring-recent-dashboards",
      JSON.stringify([
        { id: "vault", lastVisitedAt: 100 },
        { id: "tasks", lastVisitedAt: 200 },
        { id: "vault", lastVisitedAt: 300 },
        { id: "unknown", lastVisitedAt: 400 },
        { id: "settings", lastVisitedAt: 500 },
      ]),
    );
    renderNavigation("/metrics");

    const rail = screen.getByRole("navigation", { name: "Dashboards" });
    const recent = await within(rail).findByRole("group", { name: "Recently used dashboards" });
    await waitFor(() =>
      expect(
        within(recent)
          .getAllByRole("button")
          .map(button => button.getAttribute("aria-label")),
      ).toEqual(["Vault", "Tasks", "Metrics"]),
    );
    await waitFor(() => {
      const entries = JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["vault", "tasks", "metrics"]);
    });
  });

  it("updates a clicked recent dashboard in place", async () => {
    localStorage.setItem(
      "tokenring-recent-dashboards",
      JSON.stringify([
        { id: "vault", lastVisitedAt: 100 },
        { id: "tasks", lastVisitedAt: 200 },
      ]),
    );
    const originalNow = Date.now;
    Date.now = () => 500;
    const user = userEvent.setup();
    try {
      renderNavigation("/metrics");
      const recent = await screen.findByRole("group", { name: "Recently used dashboards" });
      await user.click(within(recent).getByRole("button", { name: "Vault" }));

      await waitFor(() => {
        const entries = JSON.parse(localStorage.getItem("tokenring-recent-dashboards") ?? "[]") as Array<{ id: string; lastVisitedAt: number }>;
        expect(entries.map(entry => entry.id)).toEqual(["vault", "tasks", "metrics"]);
        expect(entries[0]?.lastVisitedAt).toBe(500);
      });
    } finally {
      Date.now = originalNow;
    }
  });

  it("opens, searches, and pins from the shared dashboard switcher", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(screen.getByRole("button", { name: "More apps" }));
    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    await user.type(within(dialog).getByRole("combobox"), "Vault");
    // The query matches the Vault dashboard row and the Vault panel view row.
    expect(within(dialog).getAllByRole("button", { name: /^Vault/ }).length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("button", { name: /^Tasks/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Pin Vault" }));
    expect(JSON.parse(localStorage.getItem("tokenring-pinned-dashboards") ?? "[]")).toContain("vault");
  });

  it("opens the switcher with the command shortcut", async () => {
    renderNavigation("/");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    });
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("renders icon labels outside the clipping rail container", async () => {
    const user = userEvent.setup();
    renderNavigation("/");
    const home = screen.getByRole("button", { name: "Home" });

    await user.hover(home);
    const tooltip = screen.getByText("Home");
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip).toHaveClass("fixed", "z-[100]");

    await user.unhover(home);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });
});

describe("DashboardRail legacy shell storage", () => {
  beforeEach(() => localStorage.clear());

  it("migrates pre-dashboard pin and recent keys once", async () => {
    localStorage.setItem("tokenring-pinned-apps", JSON.stringify(["vault", "tasks"]));
    localStorage.setItem("tokenring-recent-apps", JSON.stringify([{ id: "metrics", lastVisitedAt: 100 }]));
    renderNavigation("/");

    const rail = screen.getByRole("navigation", { name: "Dashboards" });
    const pinned = within(rail).getByRole("group", { name: "Pinned dashboards" });
    expect(
      within(pinned)
        .getAllByRole("button")
        .map(button => button.getAttribute("aria-label")),
    ).toEqual(["Vault", "Tasks"]);
    await waitFor(() => expect(within(rail).getByRole("group", { name: "Recently used dashboards" })).toBeInTheDocument());
    expect(localStorage.getItem("tokenring-pinned-apps")).toBeNull();
    expect(localStorage.getItem("tokenring-recent-apps")).toBeNull();
    expect(JSON.parse(localStorage.getItem("tokenring-pinned-dashboards") ?? "[]")).toEqual(["vault", "tasks"]);
  });

  it("does not overwrite current keys with legacy values", () => {
    localStorage.setItem("tokenring-pinned-apps", JSON.stringify(["vault"]));
    localStorage.setItem("tokenring-pinned-dashboards", JSON.stringify(["tasks"]));
    renderNavigation("/");

    const pinned = screen.getByRole("group", { name: "Pinned dashboards" });
    expect(
      within(pinned)
        .getAllByRole("button")
        .map(button => button.getAttribute("aria-label")),
    ).toEqual(["Tasks"]);
    expect(localStorage.getItem("tokenring-pinned-apps")).toBeNull();
  });

  it("labels the dashboards landmark once", () => {
    renderNavigation();
    const labelled = document.querySelectorAll('[aria-label="Dashboards"]');
    expect(labelled).toHaveLength(1);
    expect(labelled[0]?.tagName).toBe("NAV");
  });
});
