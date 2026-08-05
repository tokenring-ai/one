import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: AppRail } = await import("./AppRail.tsx");
const { AppShellProvider } = await import("./AppShellContext.tsx");

function renderNavigation(path = "/email") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShellProvider>
        <AppRail />
      </AppShellProvider>
    </MemoryRouter>,
  );
}

describe("global app navigation", () => {
  beforeEach(() => localStorage.clear());

  it("renders pinned apps first and the active unpinned app under recents", async () => {
    renderNavigation();

    const rail = screen.getByRole("navigation", { name: "Applications" });
    const pinned = within(rail).getByRole("group", { name: "Pinned apps" });
    const recent = within(rail).getByRole("group", { name: "Recently used apps" });
    expect(within(pinned).queryByRole("button", { name: "Email" })).not.toBeInTheDocument();
    expect(within(recent).getByRole("button", { name: "Email" })).toHaveAttribute("aria-current", "page");
    expect(within(rail).getAllByRole("button")).toHaveLength(8);
    await waitFor(() => {
      const entries = JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["email"]);
    });
  });

  it("restores, sanitizes, and orders recently used apps below pins", async () => {
    localStorage.setItem(
      "tokenring-recent-apps",
      JSON.stringify([
        { id: "vault", lastVisitedAt: 100 },
        { id: "email", lastVisitedAt: 200 },
        { id: "vault", lastVisitedAt: 300 },
        { id: "unknown", lastVisitedAt: 400 },
        { id: "settings", lastVisitedAt: 500 },
      ]),
    );
    renderNavigation("/calendar");

    const rail = screen.getByRole("navigation", { name: "Applications" });
    const recent = await within(rail).findByRole("group", { name: "Recently used apps" });
    await waitFor(() =>
      expect(
        within(recent)
          .getAllByRole("button")
          .map(button => button.getAttribute("aria-label")),
      ).toEqual(["Vault", "Email", "Calendar"]),
    );
    await waitFor(() => {
      const entries = JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]") as Array<{ id: string }>;
      expect(entries.map(entry => entry.id)).toEqual(["vault", "email", "calendar"]);
    });
  });

  it("updates a clicked recent app in place", async () => {
    localStorage.setItem(
      "tokenring-recent-apps",
      JSON.stringify([
        { id: "vault", lastVisitedAt: 100 },
        { id: "email", lastVisitedAt: 200 },
      ]),
    );
    const originalNow = Date.now;
    Date.now = () => 500;
    const user = userEvent.setup();
    try {
      renderNavigation("/calendar");
      const recent = await screen.findByRole("group", { name: "Recently used apps" });
      await user.click(within(recent).getByRole("button", { name: "Vault" }));

      await waitFor(() => {
        const entries = JSON.parse(localStorage.getItem("tokenring-recent-apps") ?? "[]") as Array<{ id: string; lastVisitedAt: number }>;
        expect(entries.map(entry => entry.id)).toEqual(["vault", "email", "calendar"]);
        expect(entries[0]?.lastVisitedAt).toBe(500);
      });
    } finally {
      Date.now = originalNow;
    }
  });

  it("opens, searches, and pins from the shared app switcher", async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(screen.getByRole("button", { name: "All apps" }));
    const dialog = screen.getByRole("dialog", { name: "All apps" });
    await user.type(within(dialog).getByRole("searchbox"), "Vault");
    expect(within(dialog).getByRole("button", { name: /^Vault/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Email/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Pin Vault" }));
    expect(JSON.parse(localStorage.getItem("tokenring-pinned-apps") ?? "[]")).toContain("vault");
  });

  it("opens the switcher with the command shortcut", async () => {
    renderNavigation("/");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })));
    expect(await screen.findByRole("dialog", { name: "All apps" })).toBeInTheDocument();
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
