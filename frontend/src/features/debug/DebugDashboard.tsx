import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Bug, Camera, CircleDot, Cpu, FileJson, Loader2, RefreshCw, Server, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useTheme } from "../../hooks/useTheme.ts";
import { cn } from "../../lib/utils.ts";
import { appRPCClient, useDebugRecording, useDebugSnapshots, useDebugTargets } from "../../rpc.ts";
import { formatBytes, formatCaptureTime, prettyPrintSnapshot } from "./formatters.ts";

/** Recording intervals offered by the record controls. */
const INTERVAL_OPTIONS = [
  { seconds: 1, label: "1s" },
  { seconds: 5, label: "5s" },
  { seconds: 15, label: "15s" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
];

const DEFAULT_INTERVAL_SECONDS = 5;

/** `kind:id`, the key used to track which targets are selected. */
function targetKey(target: { kind: string; id: string }): string {
  return `${target.kind}:${target.id}`;
}

export default function DebugDashboard() {
  const [theme] = useTheme();
  const targets = useDebugTargets();
  const snapshots = useDebugSnapshots();
  const recording = useDebugRecording();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([targetKey({ kind: "app", id: "app" })]);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [snapshotContent, setSnapshotContent] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [navigationTab, setNavigationTab] = useState<"capture" | "snapshots">("snapshots");

  const targetList = useMemo(() => targets.data ?? [], [targets.data]);
  const snapshotList = useMemo(() => snapshots.data ?? [], [snapshots.data]);
  const isRecording = recording.data?.recording ?? false;

  // Drop targets that have gone away (agents get cleaned up while the app is open).
  useEffect(() => {
    if (targetList.length === 0) return;
    const available = new Set(targetList.map(targetKey));
    setSelectedKeys(previous => {
      const kept = previous.filter(key => available.has(key));
      return kept.length === previous.length ? previous : kept;
    });
  }, [targetList]);

  const selectedTargets = useMemo(() => targetList.filter(target => selectedKeys.includes(targetKey(target))), [targetList, selectedKeys]);

  const toggleTarget = (key: string) => {
    setSelectedKeys(previous => (previous.includes(key) ? previous.filter(existing => existing !== key) : [...previous, key]));
  };

  const openSnapshot = useCallback(async (name: string) => {
    setSelectedSnapshot(name);
    setLoadingSnapshot(true);
    setSnapshotError(null);
    try {
      const result = await appRPCClient.readDebugSnapshot({ name });
      if (result.status === "notFound") {
        setSnapshotContent(null);
        setSnapshotError(`Snapshot ${name} no longer exists`);
        return;
      }
      setSnapshotContent(prettyPrintSnapshot(result.content));
    } catch (error: unknown) {
      setSnapshotContent(null);
      setSnapshotError(formatError(error));
    } finally {
      setLoadingSnapshot(false);
    }
  }, []);

  const handleCapture = async () => {
    if (selectedTargets.length === 0) {
      toastManager.warning("Select at least one target to capture", { duration: 3000 });
      return;
    }
    setCapturing(true);
    try {
      const names: string[] = [];
      for (const target of selectedTargets) {
        const result = await appRPCClient.captureDebugSnapshot({ kind: target.kind, id: target.id });
        if (result.status === "targetNotFound") {
          toastManager.warning(`${target.label} is no longer available`, { duration: 4000 });
          continue;
        }
        names.push(result.name);
      }

      await snapshots.mutate();
      const [firstName] = names;
      if (firstName) {
        toastManager.success(names.length === 1 ? `Captured ${firstName}` : `Captured ${names.length} snapshots`, { duration: 3000 });
        await openSnapshot(firstName);
      }
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCapturing(false);
    }
  };

  const handleToggleRecording = async () => {
    try {
      if (isRecording) {
        await appRPCClient.stopDebugRecording({});
        toastManager.success("Recording stopped", { duration: 3000 });
      } else {
        if (selectedTargets.length === 0) {
          toastManager.warning("Select at least one target to record", { duration: 3000 });
          return;
        }
        await appRPCClient.startDebugRecording({
          targets: selectedTargets.map(target => ({ kind: target.kind, id: target.id })),
          intervalMs: intervalSeconds * 1000,
        });
        toastManager.success(`Recording every ${intervalSeconds}s`, { duration: 3000 });
      }
      await recording.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const handleDelete = async (name: string) => {
    setConfirmDelete(null);
    try {
      await appRPCClient.deleteDebugSnapshot({ name });
      if (selectedSnapshot === name) {
        setSelectedSnapshot(null);
        setSnapshotContent(null);
        setSnapshotError(null);
      }
      await snapshots.mutate();
      toastManager.success(`Deleted ${name}`, { duration: 3000 });
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  // While recording, keep the snapshot list in step with the captures landing on disk.
  const snapshotsMutate = snapshots.mutate;
  const captureCount = recording.data?.captureCount ?? 0;
  useEffect(() => {
    if (captureCount > 0) void snapshotsMutate();
  }, [captureCount, snapshotsMutate]);

  return (
    <div className="flex flex-col h-full bg-primary">
      <AppPageHeader title="Debugging" subtitle="Capture and inspect app and agent state" icon={<Bug />} iconGradient="from-rose-500 to-red-600" size="compact">
        {isRecording && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium">
            <CircleDot className="w-3 h-3 animate-pulse" />
            Recording · {captureCount} captured
          </span>
        )}
        <button
          type="button"
          onClick={() => void Promise.all([targets.mutate(), snapshots.mutate()])}
          className="p-1.5 text-muted hover:text-primary rounded-md hover:bg-hover transition-colors focus-ring cursor-pointer"
          aria-label="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </AppPageHeader>

      <WorkspaceShell
        appId="debug"
        title="Debugging"
        navigationLabel="Capture and snapshots"
        hasSelection={selectedSnapshot !== null}
        className="flex-1"
        navigation={
          <div className="h-full flex flex-col min-h-0 bg-secondary">
            <NavigationSidebarHeader title="Debug" meta={navigationTab === "snapshots" ? snapshotList.length : undefined} />
            <div className="shrink-0 grid grid-cols-2 gap-1 p-1.5 border-b border-primary" role="tablist" aria-label="Debug navigation">
              <button
                type="button"
                role="tab"
                aria-selected={navigationTab === "capture"}
                onClick={() => setNavigationTab("capture")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium focus-ring ${navigationTab === "capture" ? "bg-active text-primary" : "text-muted hover:text-primary hover:bg-hover"}`}
              >
                Capture
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={navigationTab === "snapshots"}
                onClick={() => setNavigationTab("snapshots")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium focus-ring ${navigationTab === "snapshots" ? "bg-active text-primary" : "text-muted hover:text-primary hover:bg-hover"}`}
              >
                Snapshots <span className="ml-1 text-xs text-muted">{snapshotList.length}</span>
              </button>
            </div>
            {navigationTab === "capture" && (
              <div className="flex-1 bg-secondary flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-primary">
                  <h2 className="text-xs font-bold text-muted uppercase tracking-widest">Capture targets</h2>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {targets.isLoading && targetList.length === 0 ? (
                    <LoadingState message="Loading targets…" size="sm" />
                  ) : targets.error ? (
                    <ErrorState title="Could not load targets" error={targets.error} onRetry={() => void targets.mutate()} />
                  ) : (
                    <ul className="p-2 space-y-1">
                      {targetList.map(target => {
                        const key = targetKey(target);
                        const checked = selectedKeys.includes(key);
                        return (
                          <li key={key}>
                            <label
                              className={cn(
                                "flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                                checked ? "bg-active" : "hover:bg-hover",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTarget(key)}
                                className="mt-0.5 accent-accent cursor-pointer focus-ring"
                              />
                              {target.kind === "app" ? (
                                <Server className="w-3.5 h-3.5 mt-0.5 shrink-0 text-sky-400" />
                              ) : (
                                <Cpu className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs text-primary truncate">{target.label}</span>
                                <span className="block text-xs text-muted truncate">{target.description}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="shrink-0 border-t border-primary p-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => void handleCapture()}
                    disabled={capturing || selectedTargets.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors active:scale-[0.98] focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capture now
                  </button>

                  <div className="flex items-center gap-2">
                    <label htmlFor="debug-interval" className="text-xs font-bold text-muted uppercase tracking-widest">
                      Every
                    </label>
                    <select
                      id="debug-interval"
                      value={intervalSeconds}
                      onChange={event => setIntervalSeconds(Number(event.target.value))}
                      disabled={isRecording}
                      className="flex-1 bg-input border border-primary rounded-md py-1 px-2 text-xs text-primary focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {INTERVAL_OPTIONS.map(option => (
                        <option key={option.seconds} value={option.seconds}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleToggleRecording()}
                    disabled={!isRecording && selectedTargets.length === 0}
                    className={cn(
                      "w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors active:scale-[0.98] focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                      isRecording ? "bg-tertiary hover:bg-hover text-primary border border-primary" : "bg-red-600 hover:bg-red-500 text-white",
                    )}
                  >
                    {isRecording ? <Square className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />}
                    {isRecording ? "Stop recording" : "Record"}
                  </button>

                  {recording.data?.lastError && <p className="text-xs text-warning">{recording.data.lastError}</p>}
                </div>
              </div>
            )}

            {navigationTab === "snapshots" && (
              <div className="flex-1 bg-secondary flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-primary flex items-center justify-between">
                  <h2 className="text-xs font-bold text-muted uppercase tracking-widest">Snapshots</h2>
                  <span className="text-xs text-muted">{snapshotList.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                  {snapshots.isLoading && snapshotList.length === 0 ? (
                    <LoadingState message="Loading snapshots…" size="sm" />
                  ) : snapshots.error ? (
                    <ErrorState title="Could not load snapshots" error={snapshots.error} onRetry={() => void snapshots.mutate()} />
                  ) : snapshotList.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted">No snapshots yet. Capture one to get started.</p>
                  ) : (
                    <ul className="p-2 space-y-1">
                      {snapshotList.map(snapshot => (
                        <li key={snapshot.name}>
                          <div
                            className={cn(
                              "group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors",
                              selectedSnapshot === snapshot.name ? "bg-active" : "hover:bg-hover",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => void openSnapshot(snapshot.name)}
                              className="flex-1 min-w-0 text-left cursor-pointer focus-ring rounded-md"
                            >
                              <span className="block text-xs text-primary truncate font-mono">{snapshot.name}</span>
                              <span className="block text-xs text-muted">
                                {formatCaptureTime(snapshot.capturedAt)} · {formatBytes(snapshot.sizeBytes)}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(snapshot.name)}
                              className="shrink-0 p-1 text-muted hover:text-red-500 rounded-md transition-colors focus-ring cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                              aria-label={`Delete ${snapshot.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        }
      >
        {/* Snapshot viewer */}
        <div className="flex-1 min-w-0 flex flex-col">
          {selectedSnapshot === null ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
              <FileJson className="w-10 h-10 text-muted" />
              <p className="text-sm text-muted">Select a snapshot to inspect it</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 py-2 border-b border-primary bg-secondary">
                <span className="text-xs font-mono text-primary">{selectedSnapshot}</span>
              </div>
              <div className="flex-1 min-h-0">
                {loadingSnapshot ? (
                  <LoadingState message="Loading snapshot…" />
                ) : snapshotError ? (
                  <ErrorState title="Could not load snapshot" error={snapshotError} variant="page" />
                ) : (
                  <Editor
                    height="100%"
                    language="json"
                    value={snapshotContent ?? ""}
                    theme={theme === "light" ? "vs-light" : "vs-dark"}
                    options={{
                      readOnly: true,
                      minimap: { enabled: true },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      wordWrap: "on",
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </WorkspaceShell>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete snapshot"
          message={`Delete ${confirmDelete}? This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => void handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
