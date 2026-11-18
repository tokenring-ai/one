import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { RPCError } from "@tokenring-ai/web-host/createWsRPCClient";
import ErrorState from "./ErrorState.tsx";

describe("ErrorState", () => {
  it("shows an ordinary error as it is, with retry", () => {
    render(<ErrorState title="Failed to load things" error={new Error("boom")} onRetry={() => undefined} />);
    expect(screen.getByText("Failed to load things")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("turns the administrators-only refusal (-32003) into one plain sentence without a pointless retry", () => {
    render(<ErrorState title="Failed to load things" error={new RPCError("Administrator access required.", -32003)} onRetry={() => undefined} />);
    expect(screen.getByText("This needs an administrator.")).toBeInTheDocument();
    expect(screen.getByText("Administrators only")).toBeInTheDocument();
    expect(screen.queryByText("Administrator access required.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("toast wording", () => {
  it("shows the administrators-only refusal as a plain sentence in every error toast", async () => {
    const { notificationManager } = await import("./toast.tsx");
    let seen: Array<{ message: string }> = [];
    const stop = notificationManager.subscribeToasts(items => {
      seen = items;
    }) as () => void;
    notificationManager.error("RPCError: Administrator access required.");
    notificationManager.error("Could not save: disk full");
    expect(seen.map(toast => toast.message)).toEqual(["This needs an administrator.", "Could not save: disk full"]);
    stop();
  });
});
