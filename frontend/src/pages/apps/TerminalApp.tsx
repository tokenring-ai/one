import { pickNextItem } from "@tokenring-ai/utility/array/pickNextItem";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Plus, Terminal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TerminalTabBar from "../../components/terminal/TerminalTabBar.tsx";
import XTermView from "../../components/terminal/XTermView.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import CenteredLoadingSpinner from "../../components/ui/CenteredLoadingSpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import OverlayText from "../../components/ui/OverlayText.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { useTerminalOutput } from "../../hooks/useTerminalOutput.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { terminalRPCClient, useTerminalList } from "../../rpc.ts";

type TerminalSession = {
  name: string;
  output: string;
  position: number;
  complete: boolean;
};

/** Stable empty list so effects that depend on `terminalList` don't re-fire every render. */
const EMPTY_TERMINALS: never[] = [];

export default function TerminalApp() {
  const navigate = useNavigate();
  const { terminalId } = useParams<{ terminalId?: string }>();
  const terminals = useTerminalList();
  const [sessions, setSessions] = useState<Record<string, TerminalSession>>({});
  const [spawning, setSpawning] = useState(false);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  /**
   * Names we have closed client-side but the list stream may still include until the next
   * snapshot. Filtering them out avoids ghost tabs and auto-select re-opening a just-closed session.
   */
  const [hiddenNames, setHiddenNames] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * Terminal just spawned: navigate immediately, but the list stream may lag. Avoid flashing
   * "Terminal not found" for a session we know exists.
   */
  const [pendingOpenName, setPendingOpenName] = useState<string | null>(null);

  const serverList = terminals.data?.status === "success" ? terminals.data.terminals : EMPTY_TERMINALS;

  // Drop hidden entries once the server list no longer reports them.
  useEffect(() => {
    if (hiddenNames.size === 0) return;
    const serverNames = new Set(serverList.map(t => t.name));
    setHiddenNames(prev => {
      let changed = false;
      const next = new Set<string>();
      for (const name of prev) {
        if (serverNames.has(name)) {
          next.add(name);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [serverList, hiddenNames.size]);

  // Clear the spawn-pending flag once the new session appears in the live list.
  useEffect(() => {
    if (pendingOpenName && serverList.some(t => t.name === pendingOpenName)) {
      setPendingOpenName(null);
    }
  }, [pendingOpenName, serverList]);

  const terminalList = useMemo(() => {
    if (hiddenNames.size === 0) return serverList;
    return serverList.filter(t => !hiddenNames.has(t.name));
  }, [serverList, hiddenNames]);

  const listError = terminals.error ? formatError(terminals.error) : null;
  const firstTerminalName = terminalList[0]?.name;

  // The URL is the source of truth for which terminal is open.
  const activeTerminalName = terminalId ?? null;
  const activeTerminal = terminalList.find(t => t.name === activeTerminalName);

  // Keep latest values in refs so async close/spawn can read post-await state without stale closures.
  const activeTerminalNameRef = useRefSync(activeTerminalName);
  const terminalListRef = useRefSync(terminalList);
  const hiddenNamesRef = useRefSync(hiddenNames);

  const activeResume = activeTerminalName ? sessions[activeTerminalName] : undefined;
  const outputStream = useTerminalOutput(activeTerminalName, activeResume);

  useEffect(() => {
    if (!activeTerminalName || !outputStream.data) {
      return;
    }

    const next = outputStream.data;
    setSessions(prev => {
      const existing = prev[activeTerminalName];
      if (existing && existing.output === next.output && existing.position === next.position && existing.complete === next.complete) {
        return prev;
      }
      return {
        ...prev,
        [activeTerminalName]: {
          name: activeTerminalName,
          output: next.output,
          position: next.position,
          complete: next.complete,
        },
      };
    });
  }, [activeTerminalName, outputStream.data]);

  const streamError = outputStream.error ? formatError(outputStream.error) : null;

  const openTerminal = useCallback(
    (terminalName: string) => {
      void navigate(`/terminal/${encodeURIComponent(terminalName)}`);
    },
    [navigate],
  );

  // Sidebar and bookmarks land on bare `/terminal`; open the first live session so the
  // page is immediately usable without an extra click when sessions already exist.
  useEffect(() => {
    if (terminals.isLoading || activeTerminalName !== null || !firstTerminalName) return;
    void navigate(`/terminal/${encodeURIComponent(firstTerminalName)}`, { replace: true });
  }, [terminals.isLoading, activeTerminalName, firstTerminalName, navigate]);

  const removeTerminalLocally = useCallback((name: string) => {
    // Eager ref update so concurrent close handlers see this name as already hidden
    // before React re-renders from setState.
    if (!hiddenNamesRef.current.has(name)) {
      const nextHidden = new Set(hiddenNamesRef.current);
      nextHidden.add(name);
      hiddenNamesRef.current = nextHidden;
    }
    setHiddenNames(prev => {
      if (prev.has(name)) return prev;
      const nextHidden = new Set(prev);
      nextHidden.add(name);
      return nextHidden;
    });
    setPendingOpenName(prev => (prev === name ? null : prev));
    setSessions(prev => {
      if (!(name in prev)) return prev;
      const remaining = { ...prev };
      delete remaining[name];
      return remaining;
    });
  }, []);

  const navigateAfterClose = useCallback(
    (closedName: string) => {
      // Only leave the current route if the closed tab is still the one on screen — the user
      // may have switched tabs while terminate was in flight.
      if (activeTerminalNameRef.current !== closedName) return;

      // hiddenNamesRef already includes `closedName` when removeTerminalLocally ran first.
      // Prefer the neighbour to the right, then left, among tabs still visible client-side.
      const next = pickNextItem(
        terminalListRef.current,
        closedName,
        t => t.name,
        t => !hiddenNamesRef.current.has(t.name),
      );
      void navigate(next ? `/terminal/${encodeURIComponent(next.name)}` : "/terminal", { replace: true });
    },
    [navigate],
  );

  const spawnTerminal = async () => {
    setSpawning(true);
    try {
      const result = await terminalRPCClient.spawnTerminal({});
      switch (result.status) {
        case "success": {
          const { terminalName } = result;
          // Mark pending before navigation so a lagging list snapshot doesn't flash not-found.
          setPendingOpenName(terminalName);
          setHiddenNames(prev => {
            if (!prev.has(terminalName)) return prev;
            const next = new Set(prev);
            next.delete(terminalName);
            return next;
          });
          // Navigate first so the UI responds immediately; list refresh is best-effort.
          openTerminal(terminalName);
          void terminals.mutate();
          break;
        }
        case "agentNotFound":
          toastManager.error("Agent not found", { duration: 5000 });
          break;
        case "providerNotFound":
          toastManager.error("Provider not found", { duration: 5000 });
          break;
        default: {
          const exhaustive: any = result satisfies never;
          throw new Error(`Unexpected status: ${exhaustive.status}`);
        }
      }
    } catch (error) {
      setPendingOpenName(null);
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSpawning(false);
    }
  };

  const closeTerminal = useCallback(
    async (name: string) => {
      try {
        const result = await terminalRPCClient.terminateTerminal({ terminalName: name });
        switch (result.status) {
          case "success":
          case "terminalNotFound":
            // Already gone server-side — still clean up the tab locally.
            break;
          case "terminalNotInteractive":
            // Server cannot kill it, but leaving a stuck tab is worse than hiding it locally.
            toastManager.error("Terminal could not be closed. Removing it from the tab bar.", { duration: 5000 });
            removeTerminalLocally(name);
            navigateAfterClose(name);
            return;
          default: {
            const exhaustive: never = result;
            throw new Error(`Unexpected status: ${(exhaustive as { status: string }).status}`);
          }
        }

        removeTerminalLocally(name);
        navigateAfterClose(name);
        void terminals.mutate();
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [navigateAfterClose, removeTerminalLocally, terminals],
  );

  const requestClose = useCallback(
    async (name: string) => {
      // Closing an exited session throws nothing away; killing a live process needs a confirmation.
      const terminal = terminalList.find(t => t.name === name);
      if (terminal && !terminal.running) {
        void closeTerminal(name);
        return;
      }
      const confirmed = await openConfirm({
        title: "Close Terminal",
        message: "This terminal is still running. Closing the tab will terminate its process.",
        confirmText: "Close",
        variant: "danger",
      });
      if (!confirmed) return;
      void closeTerminal(name);
    },
    [closeTerminal, openConfirm, terminalList],
  );

  const sendInput = useCallback(
    (input: string) => {
      if (!activeTerminalName) return;
      void terminalRPCClient
        .sendInput({ terminalName: activeTerminalName, input })
        .then(result => {
          switch (result.status) {
            case "success":
              return;
            case "terminalNotFound":
              toastManager.error("Terminal not found", { duration: 5000 });
              return;
            case "terminalNotInteractive":
              toastManager.error("Terminal is not interactive", { duration: 5000 });
              return;
            default: {
              const exhaustive: never = result;
              throw new Error(`Unexpected status: ${(exhaustive as { status: string }).status}`);
            }
          }
        })
        .catch((error: unknown) => {
          toastManager.error(formatError(error), { duration: 5000 });
        });
    },
    [activeTerminalName],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (!activeTerminalName) return;
      // Best-effort: a session on plain pipes has no window, and a dead one is about to be cleaned up.
      toastOnReject(terminalRPCClient.resizeTerminal({ terminalName: activeTerminalName, cols, rows }), {
        type: "warning",
      });
    },
    [activeTerminalName],
  );

  const activeSession = activeTerminalName
    ? {
        output: outputStream.data?.output ?? sessions[activeTerminalName]?.output ?? "",
        complete: outputStream.data?.complete ?? sessions[activeTerminalName]?.complete ?? false,
      }
    : null;

  if (terminals.isLoading) {
    return <CenteredLoadingSpinner className="h-full" />;
  }

  // A bookmarked or stale URL can name a terminal that no longer exists.
  const awaitingPendingOpen = activeTerminalName !== null && !activeTerminal && activeTerminalName === pendingOpenName;
  const missingTerminal = activeTerminalName !== null && !activeTerminal && !awaitingPendingOpen;
  // While auto-select is navigating to the first tab, avoid flashing the empty state.
  const awaitingAutoSelect = activeTerminalName === null && terminalList.length > 0;
  // useTerminalOutput seeds initialData, so isLoading stays false; isValidating tracks the live connect.
  const connectingOutput = Boolean(outputStream.isValidating) && !activeSession?.output;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Terminal"
        subtitle="Create, manage, and interact with terminals"
        icon={<Terminal className="w-4 h-4" />}
        iconGradient="from-emerald-500 to-green-600"
      >
        <button
          type="button"
          onClick={spawnTerminal}
          disabled={spawning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {spawning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} New Terminal
        </button>
      </AppPageHeader>

      <TerminalTabBar
        terminals={terminalList}
        activeName={activeTerminalName}
        onSelect={openTerminal}
        onClose={requestClose}
        onNew={spawnTerminal}
        spawning={spawning}
      />

      <div className="flex-1 flex flex-col min-h-0">
        {listError && (
          <div role="alert" className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs text-red-400 font-mono">
            Terminal list unavailable: {listError}
          </div>
        )}

        {activeTerminal ? (
          <>
            {streamError && (
              <div role="alert" className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs text-red-400 font-mono">
                Terminal output unavailable: {streamError}
              </div>
            )}

            {/* Terminal output, with the prompt riding along on the cursor cell */}
            <div className="relative flex-1 min-h-0 bg-[#1a1a2e] p-2">
              <XTermView
                key={activeTerminal.name}
                output={activeSession?.output ?? ""}
                onResize={handleResize}
                onSubmit={sendInput}
                readOnly={activeSession?.complete || !activeTerminal.running}
                className="w-full h-full"
              />
              {!activeSession?.output && (
                <OverlayText message={connectingOutput ? "Connecting..." : "Waiting for output..."} font="mono" size="xs" position="top-left" />
              )}
            </div>

            {/* Status bar */}
            <div className="shrink-0 border-t border-primary bg-secondary/50 px-4 py-1.5 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${activeTerminal.running ? "bg-emerald-500" : "bg-muted/50"}`} />
              <span className="text-xs font-mono text-secondary truncate" title={activeTerminal.workingDirectory}>
                {activeTerminal.workingDirectory}
              </span>
              <span className="text-xs font-mono text-muted shrink-0" title={`Provider: ${activeTerminal.providerName}`}>
                {activeTerminal.providerName}
              </span>
              {activeTerminal.connectedAgentIds.length > 0 && (
                <span className="text-xs font-mono text-muted shrink-0" title={activeTerminal.connectedAgentIds.join(", ")}>
                  {activeTerminal.connectedAgentIds.length} agent{activeTerminal.connectedAgentIds.length === 1 ? "" : "s"}
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs font-mono text-muted">
                {activeTerminal.running ? (
                  "running"
                ) : activeTerminal.exitCode !== null ? (
                  <span className={activeTerminal.exitCode === 0 ? "text-emerald-500" : "text-red-500"}>exited ({activeTerminal.exitCode})</span>
                ) : (
                  "exited"
                )}
              </span>
            </div>
          </>
        ) : awaitingAutoSelect || awaitingPendingOpen ? (
          <CenteredLoadingSpinner fill />
        ) : (
          <EmptyState
            variant="page"
            className="flex-1"
            icon={Terminal}
            title={missingTerminal ? "Terminal not found" : "No terminals"}
            hint={missingTerminal ? `'${activeTerminalName}' is no longer available. Open another tab or start a new one.` : "Create a terminal to get started"}
            ctaLabel="New Terminal"
            ctaVariant="emerald"
            ctaLoading={spawning}
            onCta={spawnTerminal}
          />
        )}
      </div>

      <ConfirmDialog />
    </div>
  );
}
