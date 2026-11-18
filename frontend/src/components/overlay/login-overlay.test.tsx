import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

type Handler = {
  onAuthRequired: (error: { message: string }) => Promise<void>;
  onAuthSuccess: (signedInAs: string) => void;
} | null;

let handler: Handler = null;

void mock.module("@tokenring-ai/web-host/createWsRPCClient", () => ({
  isRpcConnectionClosed: () => false,
  setWsRPCAuthHandler: (next: Handler) => {
    handler = next;
  },
  resetWsRPCConnections: () => {},
}));

// happy-dom/jsdom has no layout, so focus-trap finds no tabbable nodes; the trap is not under test.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap }));

const { default: LoginOverlay } = await import("./login-overlay.tsx");
const { clearRpcAuth, getSignedInUsername } = await import("../../rpcAuth.ts");

const FAILURE = "Sign-in could not be completed. Check your connection and try again.";

/** A refused RPC waiting for credentials; `settled` flips once the overlay releases it. */
function requireAuth() {
  const waiter = { settled: false };
  act(() => {
    void handler?.onAuthRequired({ message: "auth required" })?.then(() => {
      waiter.settled = true;
    });
  });
  return waiter;
}

function submit(username = "mark", password = "pw") {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form") as HTMLFormElement);
}

/** Lets the password check's fetch resolve and its follow-up state updates render. */
async function settle() {
  await act(async () => {
    for (let tick = 0; tick < 10; tick++) await Promise.resolve();
  });
}

function respondWith(status: number) {
  const fetchMock = mock(async () => new Response(null, { status }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  cleanup();
  clearRpcAuth();
});

describe("LoginOverlay password check", () => {
  it("signs in when nothing is waiting to retry, e.g. right after a sign-out", async () => {
    respondWith(200);
    render(<LoginOverlay />);
    // Show the form without any queued RPC.
    const waiter = requireAuth();
    waiter.settled = false;
    submit("mark", "pw");
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getSignedInUsername()).toBe("mark");
  });

  it("releases queued requests only once the server accepts the password", async () => {
    respondWith(200);
    render(<LoginOverlay />);
    const waiter = requireAuth();
    submit();
    expect(waiter.settled).toBe(false);
    await settle();
    expect(waiter.settled).toBe(true);
  });

  it("reports a wrong password and keeps queued requests waiting", async () => {
    respondWith(401);
    render(<LoginOverlay />);
    const waiter = requireAuth();
    submit("mark", "wrong");
    await settle();
    expect(screen.getByText("Invalid username or password.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
    expect(waiter.settled).toBe(false);
  });

  it("reports rate limiting", async () => {
    respondWith(429);
    render(<LoginOverlay />);
    requireAuth();
    submit();
    await settle();
    expect(screen.getByText("Too many failed sign-in attempts. Try again later.")).toBeTruthy();
  });

  it("ignores a refusal of an earlier request that lands while the password is being checked", async () => {
    let answer: (response: Response) => void = () => {};
    globalThis.fetch = mock(() => new Promise<Response>(resolve => (answer = resolve))) as unknown as typeof fetch;
    render(<LoginOverlay />);
    requireAuth();
    submit();
    const late = requireAuth();
    expect(screen.queryByText("auth required")).toBeNull();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeTruthy();
    answer(new Response(null, { status: 200 }));
    await settle();
    expect(late.settled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("LoginOverlay sign-in watchdog (server unreachable)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.fetch = mock(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("falls back to the queued retries and does not let an earlier timer fail a newer attempt", async () => {
    render(<LoginOverlay />);
    const first = requireAuth();

    submit();
    await settle();
    expect(first.settled).toBe(true);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    // First attempt is rejected; the user retries.
    requireAuth();
    submit();
    await settle();

    // 8s after the first submit, but only 3s into the second attempt.
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText(FAILURE)).toBeNull();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeTruthy();

    // The second attempt's own watchdog still fires.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText(FAILURE)).toBeTruthy();
  });

  it("clears the watchdog when sign-in succeeds", async () => {
    render(<LoginOverlay />);
    requireAuth();
    submit();
    await settle();
    act(() => {
      handler?.onAuthSuccess("mark");
    });
    // A re-shown form must not be failed by the finished attempt's timer.
    requireAuth();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText(FAILURE)).toBeNull();
  });

  it("clears the watchdog on unmount", async () => {
    const { unmount } = render(<LoginOverlay />);
    requireAuth();
    submit();
    await settle();
    const before = jest.getTimerCount();
    unmount();
    expect(jest.getTimerCount()).toBeLessThan(before);
  });
});
