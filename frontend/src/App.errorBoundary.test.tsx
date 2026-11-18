import { describe, expect, it, mock } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { RouteErrorBoundary } from "./App.tsx";

let shouldThrow: Error | null = null;
function Page({ name }: { name: string }) {
  if (shouldThrow) throw shouldThrow;
  return <div>page {name}</div>;
}

function Harness({ path, reload }: { path: string; reload?: () => void }) {
  return (
    <RouteErrorBoundary resetKey={path} reload={reload}>
      <Page name={path} />
    </RouteErrorBoundary>
  );
}

describe("RouteErrorBoundary", () => {
  it("clears a caught error when the route changes", () => {
    const consoleError = console.error;
    console.error = () => {};
    try {
      shouldThrow = new Error("boom");
      const { rerender } = render(<Harness path="/a" />);
      expect(screen.getByRole("alert")).toHaveTextContent("boom");
      shouldThrow = null;
      // Previously the boundary stayed in its error state for every later route.
      rerender(<Harness path="/b" />);
      expect(screen.getByText("page /b")).toBeInTheDocument();
    } finally {
      shouldThrow = null;
      console.error = consoleError;
    }
  });

  it("does not remount healthy children on navigation", () => {
    let mounts = 0;
    function Counter() {
      useEffect(() => {
        mounts += 1;
      }, []);
      return null;
    }
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/a">
        <Counter />
      </RouteErrorBoundary>,
    );
    rerender(
      <RouteErrorBoundary resetKey="/a/1">
        <Counter />
      </RouteErrorBoundary>,
    );
    // Mounted once: app state survives navigation within an app.
    expect(mounts).toBe(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries in place with Try Again, and reloads after a chunk-load failure", async () => {
    const consoleError = console.error;
    console.error = () => {};
    const user = userEvent.setup();
    const reload = mock(() => {});
    try {
      shouldThrow = new Error("transient");
      render(<Harness path="/a" reload={reload} />);
      shouldThrow = null;
      await user.click(screen.getByRole("button", { name: "Try Again" }));
      expect(screen.getByText("page /a")).toBeInTheDocument();
    } finally {
      shouldThrow = null;
    }
    try {
      shouldThrow = new TypeError("Failed to fetch dynamically imported module: /assets/DockviewSurface.js");
      render(<Harness path="/c" reload={reload} />);
      await act(async () => {
        await user.click(screen.getByRole("button", { name: "Reload" }));
      });
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      shouldThrow = null;
      console.error = consoleError;
    }
  });
});
