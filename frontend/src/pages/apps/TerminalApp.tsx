import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Plus, Terminal, Trash2, Unplug } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useTerminalOutput } from "../../hooks/useTerminalOutput.ts";
import { terminalRPCClient, useTerminalList } from "../../rpc.ts";

type TerminalSession = {
  name: string;
  output: string;
  position: number;
  complete: boolean;
};

export default function TerminalApp() {
  const terminals = useTerminalList();
  const [activeTerminalName, setActiveTerminalName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, TerminalSession>>({});
  const [inputValue, setInputValue] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeResume = activeTerminalName ? sessions[activeTerminalName] : undefined;
  const outputStream = useTerminalOutput(activeTerminalName, activeResume);

  useEffect(() => {
    if (!activeTerminalName || !outputStream.data) {
      return;
    }

    setSessions(prev => ({
      ...prev,
      [activeTerminalName]: {
        name: activeTerminalName,
        output: outputStream.data!.output,
        position: outputStream.data!.position,
        complete: outputStream.data!.complete,
      },
    }));
  }, [activeTerminalName, outputStream.data]);

  const activeOutput = activeTerminalName ? (outputStream.data?.output ?? sessions[activeTerminalName]?.output) : undefined;
  const streamError = outputStream.error ? formatError(outputStream.error) : null;

  // Auto-scroll to bottom when output changes (rAF ensures layout is updated first)
  useEffect(() => {
    const el = outputRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeOutput, activeTerminalName]);

  // Focus input when switching terminals
  useEffect(() => {
    if (activeTerminalName) inputRef.current?.focus();
  }, [activeTerminalName]);

  const connectToTerminal = useCallback((terminalName: string) => {
    setActiveTerminalName(terminalName);
  }, []);

  const spawnTerminal = async () => {
    setSpawning(true);
    try {
      const result = await terminalRPCClient.spawnTerminal({});
      switch (result.status) {
        case "success": {
          const { terminalName } = result;
          await terminals.mutate();
          connectToTerminal(terminalName);
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
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSpawning(false);
    }
  };

  const handleTerminate = async () => {
    if (!confirmDelete) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    try {
      await terminalRPCClient.terminateTerminal({ terminalName: name });
      if (activeTerminalName === name) setActiveTerminalName(null);
      setSessions(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      await terminals.mutate();
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const sendInput = async () => {
    if (!activeTerminalName || !inputValue) return;
    try {
      await terminalRPCClient.sendInput({
        terminalName: activeTerminalName,
        input: inputValue + "\n",
      });
      setInputValue("");
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const activeSession = activeTerminalName
    ? {
        output: outputStream.data?.output ?? sessions[activeTerminalName]?.output ?? "",
        complete: outputStream.data?.complete ?? sessions[activeTerminalName]?.complete ?? false,
      }
    : null;

  const terminalList = terminals.data?.status === "success" ? terminals.data.terminals : [];
  const activeTerminal = terminalList.find(t => t.name === activeTerminalName);

  if (terminals.isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

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

      <div className="flex-1 flex min-h-0">
        {/* Sidebar — terminal list */}
        <div className="shrink-0 w-56 border-r border-primary bg-secondary overflow-y-auto">
          <div className="px-3 pt-3 pb-1">
            <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-500/90 uppercase tracking-widest">Terminals</span>
            <span className="text-2xs text-muted ml-2">{terminalList.length}</span>
          </div>
          <div className="p-2 space-y-1">
            {terminalList[0] ? (
              terminalList.map(t => (
                <div
                  key={t.name}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                    activeTerminalName === t.name ? "bg-hover border border-emerald-500/50" : "hover:bg-hover border border-transparent"
                  }`}
                >
                  <button type="button" onClick={() => connectToTerminal(t.name)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.running ? "bg-emerald-500" : "bg-muted/50"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-primary truncate">{t.lastInput}</div>
                      <div className="text-2xs text-muted truncate">{t.name}</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(t.name)}
                    className="p-1 text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus-ring cursor-pointer rounded-md shrink-0"
                    aria-label={`Terminate terminal ${t.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-3 py-6 text-center">
                <Terminal className="w-6 h-6 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-2xs text-muted">No terminals</p>
              </div>
            )}
          </div>
        </div>

        {/* Main terminal area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeTerminalName ? (
            <>
              {/* Terminal toolbar */}
              <div className="shrink-0 border-b border-primary bg-secondary/50 px-4 py-2 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${activeTerminal?.running ? "bg-emerald-500" : "bg-muted/50"}`} />
                <span className="text-xs font-mono text-primary truncate">{activeTerminal?.lastInput ?? activeTerminalName}</span>
                <span className="text-2xs text-muted truncate">{activeTerminal?.workingDirectory}</span>
                {activeTerminal && !activeTerminal.running && activeTerminal.exitCode !== null && (
                  <span className={`text-2xs font-mono ${activeTerminal.exitCode === 0 ? "text-emerald-500" : "text-red-500"}`}>
                    exit: {activeTerminal.exitCode}
                  </span>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setActiveTerminalName(null)}
                  className="p-1 text-muted hover:text-primary transition-colors focus-ring cursor-pointer rounded-md"
                  aria-label="Disconnect from terminal"
                >
                  <Unplug className="w-3.5 h-3.5" />
                </button>
              </div>

              {streamError && (
                <div role="alert" className="shrink-0 px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-xs text-red-400 font-mono">
                  Terminal output unavailable: {streamError}
                </div>
              )}

              {/* Terminal output */}
              <div
                ref={outputRef}
                className="flex-1 overflow-y-auto bg-[#1a1a2e] p-4 font-mono text-xs text-green-400 whitespace-pre-wrap break-all select-text"
                onClick={() => inputRef.current?.focus()}
              >
                {activeSession?.output ||
                  (outputStream.isLoading ? <span className="text-muted">Connecting...</span> : <span className="text-muted">Waiting for output...</span>)}
                {activeSession?.complete && <div className="text-muted mt-2">[Process exited]</div>}
              </div>

              {/* Input line */}
              <div className="shrink-0 border-t border-primary bg-[#1a1a2e] px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-mono text-emerald-500 shrink-0">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendInput();
                    }
                  }}
                  disabled={activeSession?.complete}
                  className="flex-1 bg-transparent text-xs font-mono text-green-400 outline-none placeholder:text-muted/50 disabled:opacity-50"
                  placeholder={activeSession?.complete ? "Process has exited" : "Type a command..."}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Terminal className="w-12 h-12 text-muted mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium text-primary mb-1">No terminal selected</p>
                <p className="text-2xs text-muted max-w-xs mx-auto mb-4">Select an existing terminal from the sidebar or create a new one</p>
                <button
                  type="button"
                  onClick={spawnTerminal}
                  disabled={spawning}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors focus-ring cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {spawning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} New Terminal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Terminate Terminal"
          message="Are you sure you want to terminate this terminal? This will end the running process."
          confirmText="Terminate"
          onConfirm={handleTerminate}
          onCancel={() => setConfirmDelete(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
