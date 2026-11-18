import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RedeemOutcome } from "../lib/accessLink.ts";
import { notificationManager, type ToastItem } from "./ui/toast.tsx";

const { default: AccessLinkGate } = await import("./AccessLinkGate.tsx");

const TOKEN = "3q2-7wG4n0x8Yk1b9hZpA5uR6tVdLmCsQe_JfXoIhNa";

/** Everything a Storage holds, as one string. */
function dump(storage: Storage): string {
  return Object.keys(storage)
    .map(key => `${key}=${storage.getItem(key)}`)
    .join("\n");
}

function App() {
  return <p>The app</p>;
}

describe("AccessLinkGate", () => {
  let toasts: ToastItem[] = [];
  let unsubscribe: (() => void) | undefined;
  beforeEach(() => {
    toasts = [];
    sessionStorage.clear();
    localStorage.clear();
    unsubscribe = notificationManager.subscribeToasts(items => {
      toasts = items;
    }) as () => void;
  });
  afterEach(() => unsubscribe?.());

  it("renders the app untouched when the page was not opened from an access link", () => {
    const reload = mock(() => undefined);
    render(
      <AccessLinkGate redeem={null} reload={reload}>
        <App />
      </AccessLinkGate>,
    );
    expect(screen.getByText("The app")).toBeInTheDocument();
    expect(screen.queryByText(/Signing you in/)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("shows Signing you in, then reloads once on success without rendering the app first", async () => {
    const reload = mock(() => undefined);
    let finish: (outcome: RedeemOutcome) => void = () => undefined;
    const redeem = new Promise<RedeemOutcome>(resolve => {
      finish = resolve;
    });
    render(
      <AccessLinkGate redeem={redeem} reload={reload}>
        <App />
      </AccessLinkGate>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Signing you in…");
    expect(screen.queryByText("The app")).toBeNull();
    finish({ status: "signedIn", username: "maria", role: "member" });
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("The app")).toBeNull();
  });

  it("forgets a previously remembered sign-in so the new person is not confused with the old one", async () => {
    sessionStorage.setItem("tokenring.rpc.username", "someone-else");
    const reload = mock(() => undefined);
    render(
      <AccessLinkGate redeem={Promise.resolve({ status: "signedIn", username: "maria", role: "member" })} reload={reload}>
        <App />
      </AccessLinkGate>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sessionStorage.getItem("tokenring.rpc.username")).toBeNull();
  });

  it("explains an expired or used link and opens the app (with its sign-in form) as the fallback", async () => {
    const reload = mock(() => undefined);
    render(
      <AccessLinkGate redeem={Promise.resolve({ status: "invalid" })} reload={reload}>
        <App />
      </AccessLinkGate>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This link has expired or has already been used. Ask the person who gave it to you for a new one.",
    );
    expect(screen.getByText("The app")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tells people to wait a few minutes when rate limited", async () => {
    render(
      <AccessLinkGate redeem={Promise.resolve({ status: "rateLimited" })} reload={() => undefined}>
        <App />
      </AccessLinkGate>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a few minutes/i);
  });

  it("leaves no trace of the token in the console, toasts, storage or the page", async () => {
    // The gate never receives the token: only the outcome. Prove it by exercising every outcome while spying everywhere.
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(name => spyOn(console, name));
    try {
      for (const status of ["invalid", "rateLimited", "unreachable"] as const) {
        const { container, unmount } = render(
          <AccessLinkGate redeem={Promise.resolve({ status })} reload={() => undefined}>
            <App />
          </AccessLinkGate>,
        );
        await screen.findByRole("alert");
        expect(container.innerHTML).not.toContain(TOKEN);
        unmount();
      }
      for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
      expect(JSON.stringify(toasts)).not.toContain(TOKEN);
      expect(dump(localStorage)).not.toContain(TOKEN);
      expect(dump(sessionStorage)).not.toContain(TOKEN);
      expect(document.body.innerHTML).not.toContain(TOKEN);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
