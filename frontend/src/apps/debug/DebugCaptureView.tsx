import formatError from "@tokenring-ai/utility/error/formatError";
import { Camera, CircleDot, Cpu, RefreshCw, Server, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { cn } from "../../lib/utils.ts";
import { appRPCClient, useDebugRecording, useDebugSnapshots, useDebugTargets } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import Select from "../../ui/select.tsx";
import { retainTargets, setIntervalSeconds, setRetainLast, targetKey, toggleTarget, useDebugCaptureState } from "./debugStore.ts";
import { RETENTION_OPTIONS } from "./retention.ts";
import { groupTargetsBySource, useDebugNavigation } from "./shared.tsx";

/** Recording intervals offered by the record controls. */
const INTERVAL_OPTIONS = [
  { seconds: 1, label: "1s" },
  { seconds: 5, label: "5s" },
  { seconds: 15, label: "15s" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
];

/**
 * Capture controls: which app / agent state to snapshot, a one-shot capture
 * and the interval recorder. Usable as a home-dashboard widget, so it never
 * assumes it is rendered next to the snapshot list.
 */
export default function DebugCaptureView() {
  const targets = useDebugTargets();
  const snapshots = useDebugSnapshots();
  const recording = useDebugRecording();
  const { selectedKeys, intervalSeconds, retainLast } = useDebugCaptureState();
  const { openSnapshot, hasOpenSnapshot } = useDebugNavigation();
  const [capturing, setCapturing] = useState(false);
  const serverRetainLast = recording.data?.retainLast;

  const targetList = useMemo(() => targets.data ?? [], [targets.data]);
  const isRecording = recording.data?.recording ?? false;
  const captureCount = recording.data?.captureCount ?? 0;
  // While recording, the recorder uses the targets and interval captured when it
  // started, so show those (read-only) rather than the local selection.
  const recordingKeys = useMemo(() => (recording.data?.recording ? recording.data.targets.map(targetKey) : null), [recording.data]);
  const recordingSeconds = isRecording ? Math.round((recording.data?.intervalMs ?? intervalSeconds * 1000) / 1000) : null;
  const snapshotsMutate = snapshots.mutate;
  const recordingMutate = recording.mutate;

  // Drop targets that have gone away (agents get cleaned up while the dashboard is open).
  useEffect(() => {
    if (targetList.length === 0) return;
    retainTargets(new Set(targetList.map(targetKey)));
  }, [targetList]);

  const selectedTargets = useMemo(() => targetList.filter(target => selectedKeys.includes(targetKey(target))), [targetList, selectedKeys]);

  const targetGroups = useMemo(() => groupTargetsBySource(targetList), [targetList]);

  // The server is the source of truth, including after a reload. Changing the control writes it immediately.
  useEffect(() => {
    if (serverRetainLast === undefined) return;
    setRetainLast(serverRetainLast);
  }, [serverRetainLast]);

  // While recording, refresh the snapshot list once per capture. The server prunes; this only refetches.
  useEffect(() => {
    if (captureCount === 0) return;
    void snapshotsMutate();
  }, [captureCount, snapshotsMutate]);

  const handleCapture = useCallback(async () => {
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

      await snapshotsMutate();
      const [firstName] = names;
      if (firstName) {
        toastManager.success(names.length === 1 ? `Captured ${firstName}` : `Captured ${names.length} snapshots`, { duration: 3000 });
        // Only auto-open when no panel shows a snapshot, so an in-progress inspection is preserved.
        if (!hasOpenSnapshot()) openSnapshot(firstName);
      }
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCapturing(false);
    }
  }, [hasOpenSnapshot, openSnapshot, selectedTargets, snapshotsMutate]);

  const handleRetainLast = useCallback(
    (value: string) => {
      const next = value === "all" ? null : Number(value);
      const previous = retainLast;
      setRetainLast(next);
      void appRPCClient.setDebugRetention({ retainLast: next }).catch((error: unknown) => {
        setRetainLast(serverRetainLast ?? previous);
        toastManager.error(`Could not save snapshot retention: ${formatError(error)}`, { duration: 5000 });
      });
    },
    [retainLast, serverRetainLast],
  );

  const handleToggleRecording = useCallback(async () => {
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
      await recordingMutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  }, [intervalSeconds, isRecording, recordingMutate, selectedTargets]);

  return (
    <ViewShell
      tone="sidebar"
      scroll={false}
      header={
        <NavigationSidebarHeader
          meta={
            isRecording ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-xs font-medium">
                <CircleDot className="w-3 h-3 animate-pulse" />
                {captureCount} captured
              </span>
            ) : undefined
          }
          actions={[
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", targets.isValidating && "animate-spin")} />,
              label: "Refresh targets",
              onClick: () => void targets.mutate(),
            },
          ]}
        />
      }
    >
      <div className="h-full overflow-y-auto">
        {targets.isLoading && targetList.length === 0 ? (
          <LoadingState message="Loading targets…" size="sm" />
        ) : targets.error ? (
          <ErrorState title="Could not load targets" error={targets.error} onRetry={() => void targets.mutate()} />
        ) : (
          <div className="p-2 space-y-2">
            {targetGroups.map(group => (
              <section key={group.kind} aria-label={group.label}>
                <h3 className="px-2 pb-1 text-xs font-semibold text-muted uppercase tracking-wider">{group.label}</h3>
                <ul className="space-y-1">
                  {group.targets.map(target => {
                    const key = targetKey(target);
                    const checked = recordingKeys ? recordingKeys.includes(key) : selectedKeys.includes(key);
                    return (
                      <li key={key}>
                        <label
                          className={cn(
                            "flex items-start gap-2 px-2 py-1.5 rounded-md transition-colors",
                            isRecording ? "cursor-not-allowed" : "cursor-pointer",
                            checked ? "bg-active" : !isRecording && "hover:bg-hover",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isRecording}
                            onChange={() => toggleTarget(key)}
                            className="mt-0.5 accent-accent cursor-pointer focus-ring disabled:cursor-not-allowed"
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
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-primary p-3 space-y-2">
        <p className="text-xs text-muted">
          Snapshots save app or agent state as JSON in the workspace's <span className="font-mono">debug/</span> folder, for troubleshooting.
        </p>
        <p className="text-xs text-warning">Credentials are redacted, but snapshots can still hold prompts and file contents — review before sharing.</p>
        {isRecording ? (
          <p className="text-xs text-muted" data-testid="debug-recording-summary">
            Recording {recordingKeys?.length ?? 0} target{recordingKeys?.length === 1 ? "" : "s"} every {recordingSeconds}s. Stop to change them.
          </p>
        ) : (
          selectedTargets.length === 0 && <p className="text-xs text-muted">Tick at least one target above to capture or record.</p>
        )}
        <Button size="md" fullWidth icon={Camera} busy={capturing} onClick={() => void handleCapture()} disabled={selectedTargets.length === 0}>
          Capture now
        </Button>

        <div className="flex items-center gap-2">
          <label htmlFor="debug-interval" className="text-xs font-bold text-muted uppercase tracking-widest">
            Every
          </label>
          <Select
            id="debug-interval"
            value={String(recordingSeconds ?? intervalSeconds)}
            onChange={value => setIntervalSeconds(Number(value))}
            disabled={isRecording}
            className="flex-1"
          >
            {recordingSeconds !== null && !INTERVAL_OPTIONS.some(option => option.seconds === recordingSeconds) && (
              <option value={recordingSeconds}>{recordingSeconds}s</option>
            )}
            {INTERVAL_OPTIONS.map(option => (
              <option key={option.seconds} value={option.seconds}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="debug-retention" className="text-xs font-bold text-muted uppercase tracking-widest">
            Keep
          </label>
          <Select
            id="debug-retention"
            value={retainLast === null ? "all" : String(retainLast)}
            onChange={handleRetainLast}
            className="flex-1"
            title="After each capture, the server deletes all but the newest snapshots"
          >
            {RETENTION_OPTIONS.map(option => (
              <option key={option.label} value={option.value === null ? "all" : String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
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
    </ViewShell>
  );
}
