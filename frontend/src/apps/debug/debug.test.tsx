import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DebugTarget } from "@tokenring-ai/app/rpc/schema";
import type React from "react";
import { useSyncExternalStore } from "react";

const appTarget = { kind: "app", id: "state", label: "App state", description: "Services, plugins and config" };
const agentTarget = { kind: "agent", id: "agent-1", label: "Coding Agent", description: "Running agent" };

const snapshotA = { name: "app-state-2026-09-13T10-00-00.json", kind: "app", sizeBytes: 2048, capturedAt: 1_700_000_000_000 };
const snapshotB = { name: "agent-1-2026-09-13T10-05-00.json", kind: "agent", sizeBytes: 512, capturedAt: 1_700_000_100_000 };

const captureDebugSnapshot = mock(
  async (args: { kind: string; id: string }) => ({ status: "success" as const, name: `${args.id}-new.json` }) as Record<string, unknown>,
);
const readDebugSnapshot = mock(async (_args: { name: string }) => ({ status: "success" as const, name: "x", content: '{"a":1}' }) as Record<string, unknown>);
const deleteDebugSnapshot = mock(async (_args: { name: string }) => ({ status: "success" as const }));
const startDebugRecording = mock(async (_args: Record<string, unknown>) => ({ status: "success" as const }));
const stopDebugRecording = mock(async (_args: Record<string, unknown>) => ({ status: "success" as const }));
const setDebugRetention = mock(async (args: { retainLast: number | null }) => ({ ...state.recording, retainLast: args.retainLast }));
const listDebugSnapshots = mock(async (_args: Record<string, never>) => ({ snapshots: state.snapshots }));
const snapshotsMutate = mock(async () => undefined);
const targetsMutate = mock(async () => undefined);
const recordingMutate = mock(async () => undefined);

// Hooks re-read `state` when `bump()` runs, standing in for a data refresh.
const listeners = new Set<() => void>();
let version = 0;
const useVersion = () =>
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
const bump = () =>
  act(() => {
    version += 1;
    for (const listener of listeners) listener();
  });

const state = {
  targets: [appTarget, agentTarget] as Array<DebugTarget>,
  snapshots: [snapshotA, snapshotB] as Array<typeof snapshotA>,
  snapshotsLoading: false,
  recording: {
    recording: false,
    intervalMs: 5000,
    targets: [],
    startedAt: null,
    lastCaptureAt: null,
    captureCount: 0,
    lastSnapshot: null,
    lastError: null,
    retainLast: null as number | null,
  },
};

void mock.module("../../rpc.ts", () => ({
  useDebugTargets: () => {
    useVersion();
    return { data: state.targets, isLoading: false, isValidating: false, error: undefined, mutate: targetsMutate };
  },
  useDebugSnapshots: () => ({
    data: state.snapshotsLoading ? undefined : state.snapshots,
    isLoading: state.snapshotsLoading,
    isValidating: false,
    error: undefined,
    mutate: snapshotsMutate,
  }),
  useDebugRecording: () => {
    useVersion();
    return { data: state.recording, isLoading: false, isValidating: false, error: undefined, mutate: recordingMutate };
  },
  appRPCClient: {
    captureDebugSnapshot,
    readDebugSnapshot,
    deleteDebugSnapshot,
    startDebugRecording,
    stopDebugRecording,
    setDebugRetention,
    listDebugSnapshots,
  },
}));

void mock.module("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => <pre data-testid="snapshot-json">{value}</pre>,
}));

const toastMocks = { success: mock(), error: mock(), info: mock(), warning: mock(), remove: mock() };
void mock.module("../../components/ui/toast.tsx", () => ({ toastManager: toastMocks }));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutApp, renderLayoutView } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { DEBUG_APP } = await import("./manifest.ts");
const { DEBUG_KINDS } = await import("./kinds.ts");
const { DEBUG_VIEWS } = await import("./views.tsx");
const { resetDebugStore } = await import("./debugStore.ts");

const registry = createLayoutRegistry({ apps: [DEBUG_APP], views: DEBUG_VIEWS, kinds: [...CORE_KINDS, ...DEBUG_KINDS] });
const viewById = (id: string) => DEBUG_VIEWS.find(view => view.id === id)!;
const snapshotUrl = (name: string) => `/debug/${encodeURIComponent(name)}`;

const renderApp = (url = "/debug") => renderLayoutApp({ registry, url });
/** One view alone in a throwaway app. */
const renderDebugView = (viewId: string, params: Record<string, string> = {}) => renderLayoutView(viewById(viewId), { params, kinds: [...DEBUG_KINDS] });

describe("Debug app", () => {
  beforeEach(() => {
    for (const fn of [
      captureDebugSnapshot,
      readDebugSnapshot,
      deleteDebugSnapshot,
      startDebugRecording,
      stopDebugRecording,
      setDebugRetention,
      listDebugSnapshots,
      snapshotsMutate,
      targetsMutate,
      recordingMutate,
    ]) {
      fn.mockClear();
    }
    captureDebugSnapshot.mockImplementation(async args => ({ status: "success" as const, name: `${args.id}-new.json` }));
    readDebugSnapshot.mockImplementation(async () => ({ status: "success" as const, name: "x", content: '{"a":1}' }));
    for (const toast of Object.values(toastMocks)) toast.mockClear();
    resetDebugStore();
    state.targets = [appTarget, agentTarget];
    state.snapshots = [snapshotA, snapshotB];
    state.snapshotsLoading = false;
    state.recording = {
      recording: false,
      intervalMs: 5000,
      targets: [],
      startedAt: null,
      lastCaptureAt: null,
      captureCount: 0,
      lastSnapshot: null,
      lastError: null,
      retainLast: null,
    };
  });

  describe("debug-capture", () => {
    it("captures the ticked targets and opens the first snapshot", async () => {
      const user = userEvent.setup();
      const app = renderApp();

      // The app state target is ticked by default; add the agent.
      await user.click(screen.getByRole("checkbox", { name: /Coding Agent/ }));
      await user.click(screen.getByRole("button", { name: "Capture now" }));

      await waitFor(() => expect(captureDebugSnapshot).toHaveBeenCalledTimes(2));
      expect(captureDebugSnapshot.mock.calls.map(call => call[0])).toEqual([
        { kind: "app", id: "state" },
        { kind: "agent", id: "agent-1" },
      ]);
      await waitFor(() => expect(app.location().pathname).toBe("/debug/state-new.json"));
      expect(screen.getByRole("tab", { name: /state-new\.json/ })).toBeInTheDocument();
      // The "select a snapshot" start tab has done its job.
      expect(screen.queryByText("Select a snapshot")).not.toBeInTheDocument();
    });

    it("leaves an inspection in progress alone", async () => {
      const user = userEvent.setup();
      const app = renderApp(snapshotUrl(snapshotB.name));

      await user.click(screen.getByRole("button", { name: "Capture now" }));

      await waitFor(() => expect(captureDebugSnapshot).toHaveBeenCalledTimes(1));
      expect(app.location().pathname).toBe(snapshotUrl(snapshotB.name));
      expect(screen.queryByRole("tab", { name: /state-new\.json/ })).not.toBeInTheDocument();
    });

    it("refuses to capture with nothing ticked", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-capture");

      await user.click(screen.getByRole("checkbox", { name: /App state/ }));
      expect(screen.getByRole("button", { name: "Capture now" })).toBeDisabled();
      expect(screen.getByText("Tick at least one target above to capture or record.")).toBeInTheDocument();
      expect(captureDebugSnapshot).not.toHaveBeenCalled();
    });

    it("starts a recording at the chosen interval and stops it again", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-capture");

      await user.selectOptions(screen.getByLabelText("Every"), "15");
      await user.click(screen.getByRole("button", { name: "Record" }));

      await waitFor(() => expect(startDebugRecording).toHaveBeenCalledWith({ targets: [{ kind: "app", id: "state" }], intervalMs: 15_000 }));

      state.recording = { ...state.recording, recording: true, captureCount: 3 };
      bump();
      expect(screen.getByText("3 captured")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Stop recording" }));
      await waitFor(() => expect(stopDebugRecording).toHaveBeenCalled());
    });

    it("locks the targets while recording and shows the ones being recorded", () => {
      state.recording = { ...state.recording, recording: true, intervalMs: 30_000, targets: [{ kind: "agent", id: "agent-1" }] as never[] };
      renderDebugView("debug-capture");

      const agentBox = screen.getByRole("checkbox", { name: /Coding Agent/ });
      const appBox = screen.getByRole("checkbox", { name: /App state/ });
      expect(agentBox).toBeChecked();
      expect(agentBox).toBeDisabled();
      expect(appBox).not.toBeChecked();
      expect(appBox).toBeDisabled();
      expect(screen.getByTestId("debug-recording-summary")).toHaveTextContent("Recording 1 target every 30s");
      expect(screen.getByLabelText("Every")).toHaveValue("30");
    });

    it("explains where snapshots go and warns about their contents", () => {
      renderDebugView("debug-capture");
      expect(screen.getByText(/debug\//)).toBeInTheDocument();
      expect(screen.getByText(/Credentials are redacted/)).toBeInTheDocument();
    });

    it("drops a ticked target that has gone away", async () => {
      renderDebugView("debug-capture");

      expect(screen.getByRole("button", { name: "Capture now" })).toBeEnabled();
      // The agent outlives the app target only in this fixture; the default tick must not survive it.
      state.targets = [agentTarget];
      bump();
      await waitFor(() => expect(screen.getByRole("button", { name: "Capture now" })).toBeDisabled());
    });
  });

  describe("debug-capture grouping and retention", () => {
    it("groups targets under their source's display name", () => {
      state.targets = [{ ...appTarget, displayName: "Application State" }, agentTarget];
      renderDebugView("debug-capture");
      const appGroup = screen.getByRole("region", { name: "Application State" });
      expect(within(appGroup).getByRole("checkbox", { name: /App state/ })).toBeInTheDocument();
      // No displayName from the server: the kind's fallback label is used.
      const agentGroup = screen.getByRole("region", { name: "Agents" });
      expect(within(agentGroup).getByRole("checkbox", { name: /Coding Agent/ })).toBeInTheDocument();
    });

    it("keeps only the newest N snapshots after a capture", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-capture");

      // The server is told immediately, and it is the one that deletes. The client must not walk the list.
      await user.selectOptions(screen.getByLabelText("Keep"), "10");
      await waitFor(() => expect(setDebugRetention).toHaveBeenCalledWith({ retainLast: 10 }));
      expect(deleteDebugSnapshot).not.toHaveBeenCalled();
      expect(listDebugSnapshots).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Capture now" }));
      await waitFor(() => expect(captureDebugSnapshot).toHaveBeenCalled());
      expect(deleteDebugSnapshot).not.toHaveBeenCalled();
      expect(listDebugSnapshots).not.toHaveBeenCalled();

      await user.selectOptions(screen.getByLabelText("Keep"), "all");
      await waitFor(() => expect(setDebugRetention).toHaveBeenCalledWith({ retainLast: null }));
      expect(deleteDebugSnapshot).not.toHaveBeenCalled();
    });

    it("does not prune with the default keep-all setting", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-capture");
      await user.click(screen.getByRole("button", { name: "Capture now" }));
      await waitFor(() => expect(captureDebugSnapshot).toHaveBeenCalled());
      expect(setDebugRetention).not.toHaveBeenCalled();
      expect(listDebugSnapshots).not.toHaveBeenCalled();
      expect(deleteDebugSnapshot).not.toHaveBeenCalled();
    });
  });

  describe("debug-snapshots filtering and bulk delete", () => {
    it("shows each snapshot's kind and filters by it", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-snapshots");
      expect(screen.getAllByTestId("snapshot-kind").map(node => node.textContent)).toEqual(["Application", "Agents"]);

      await user.selectOptions(screen.getByLabelText("Filter snapshots by kind"), "agent");
      expect(screen.queryByText(snapshotA.name)).not.toBeInTheDocument();
      expect(screen.getByText(snapshotB.name)).toBeInTheDocument();
    });

    it("deletes every snapshot after a confirmation and closes their panels", async () => {
      const user = userEvent.setup();
      const app = renderApp(snapshotUrl(snapshotA.name));
      expect(screen.getByRole("tab", { name: new RegExp(snapshotA.name.replace(".", "\\.")) })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Delete all snapshots" }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/Delete 2 snapshots/)).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Delete 2" }));

      await waitFor(() => expect(deleteDebugSnapshot).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(app.location().pathname).toBe("/debug"));
      expect(screen.queryByRole("tab", { name: new RegExp(snapshotA.name.replace(".", "\\.")) })).not.toBeInTheDocument();
      expect(snapshotsMutate).toHaveBeenCalled();
    });

    it("cancelling the bulk delete deletes nothing", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-snapshots");
      await user.click(screen.getByRole("button", { name: "Delete all snapshots" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
      expect(deleteDebugSnapshot).not.toHaveBeenCalled();
    });

    it("bulk delete under a filter only touches that kind", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-snapshots");
      await user.selectOptions(screen.getByLabelText("Filter snapshots by kind"), "agent");
      await user.click(screen.getByRole("button", { name: "Delete all Agents snapshots" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete 1" }));
      await waitFor(() => expect(deleteDebugSnapshot).toHaveBeenCalledTimes(1));
      expect(deleteDebugSnapshot).toHaveBeenCalledWith({ name: snapshotB.name });
    });
  });

  describe("debug-snapshots navigator", () => {
    it("lists snapshots and opens one in the main area", async () => {
      const user = userEvent.setup();
      const app = renderApp();

      expect(screen.getByText(snapshotA.name)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: `Open ${snapshotB.name}` }));

      expect(app.location().pathname).toBe(snapshotUrl(snapshotB.name));
      expect(screen.getByRole("tab", { name: new RegExp(snapshotB.name.replace(".", "\\.")) })).toBeInTheDocument();
      expect(screen.queryByText("Select a snapshot")).not.toBeInTheDocument();
    });

    it("highlights the snapshot named by the URL", () => {
      renderApp(snapshotUrl(snapshotA.name));
      expect(screen.getByRole("button", { name: `Open ${snapshotA.name}` }).closest("[data-item-id]")).toHaveAttribute("aria-current", "true");
    });

    it("deletes a snapshot after confirmation and closes its panel", async () => {
      const user = userEvent.setup();
      const app = renderApp(snapshotUrl(snapshotA.name));

      await user.click(screen.getByRole("button", { name: `Delete ${snapshotA.name}` }));
      await user.click(await screen.findByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteDebugSnapshot).toHaveBeenCalledWith({ name: snapshotA.name }));
      await waitFor(() => expect(app.location().pathname).toBe("/debug"));
      expect(screen.queryByRole("tab", { name: new RegExp(snapshotA.name.replace(".", "\\.")) })).not.toBeInTheDocument();
    });

    it("shows an empty state when nothing has been captured", () => {
      state.snapshots = [];
      renderDebugView("debug-snapshots");
      expect(screen.getByText(/No snapshots yet/)).toBeInTheDocument();
    });
  });

  describe("debug-snapshot viewer", () => {
    it("shows the start tab at /debug, with nothing to read", () => {
      renderApp();
      expect(screen.getByText("Select a snapshot")).toBeInTheDocument();
      expect(readDebugSnapshot).not.toHaveBeenCalled();
    });

    it("loads and pretty-prints the snapshot named by its params", async () => {
      renderDebugView("debug-snapshot", { snapshotId: snapshotA.name });

      await waitFor(() => expect(screen.getByTestId("snapshot-json")).toHaveTextContent('"a": 1'));
      expect(readDebugSnapshot).toHaveBeenCalledWith({ name: snapshotA.name });
      expect(screen.getByRole("tab", { name: new RegExp(snapshotA.name.replace(".", "\\.")) })).toBeInTheDocument();
    });

    it("copies the snapshot JSON", async () => {
      const user = userEvent.setup();
      renderDebugView("debug-snapshot", { snapshotId: snapshotA.name });

      await waitFor(() => expect(screen.getByRole("button", { name: "Copy JSON" })).toBeEnabled());
      await user.click(screen.getByRole("button", { name: "Copy JSON" }));
      expect(await navigator.clipboard.readText()).toBe(JSON.stringify({ a: 1 }, null, 2));
    });

    it("downloads the snapshot as a .json file", async () => {
      const user = userEvent.setup();
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      const blobs: Blob[] = [];
      URL.createObjectURL = (blob: Blob) => {
        blobs.push(blob);
        return "blob:snapshot";
      };
      URL.revokeObjectURL = () => {};
      const downloads: string[] = [];
      const click = spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
      try {
        renderDebugView("debug-snapshot", { snapshotId: snapshotA.name });
        await waitFor(() => expect(screen.getByRole("button", { name: "Download JSON" })).toBeEnabled());
        await user.click(screen.getByRole("button", { name: "Download JSON" }));
        expect(downloads).toEqual([snapshotA.name]);
        expect(blobs[0]!.type).toBe("application/json");
        expect(JSON.parse(await blobs[0]!.text())).toEqual({ a: 1 });
      } finally {
        click.mockRestore();
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      }
    });

    it("deletes the open snapshot after confirmation", async () => {
      const user = userEvent.setup();
      const app = renderApp(snapshotUrl(snapshotA.name));

      await user.click(await screen.findByRole("button", { name: "Delete snapshot" }));
      await user.click(await screen.findByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteDebugSnapshot).toHaveBeenCalledWith({ name: snapshotA.name }));
      await waitFor(() => expect(app.location().pathname).toBe("/debug"));
    });

    it("offers to close the panel when the snapshot is gone", async () => {
      readDebugSnapshot.mockImplementation(async () => ({ status: "notFound" as const }));
      const user = userEvent.setup();
      renderApp(snapshotUrl(snapshotA.name));

      expect(await screen.findByText("Snapshot no longer exists")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Close panel" }));
      expect(screen.queryByText("Snapshot no longer exists")).not.toBeInTheDocument();
    });

    it("surfaces a read failure with a retry", async () => {
      readDebugSnapshot.mockImplementation(async () => {
        throw new Error("disk on fire");
      });
      const user = userEvent.setup();
      renderDebugView("debug-snapshot", { snapshotId: snapshotA.name });

      expect(await screen.findByText(/disk on fire/)).toBeInTheDocument();
      readDebugSnapshot.mockImplementation(async () => ({ status: "success" as const, name: "x", content: '{"a":1}' }));
      await user.click(screen.getByRole("button", { name: /Retry|Try again/i }));
      await waitFor(() => expect(screen.getByTestId("snapshot-json")).toBeInTheDocument());
    });
  });
});
