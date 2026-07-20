import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";
import formatError from "@tokenring-ai/utility/error/formatError";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkpointRPCClient, type useAgentList, useCheckpointList } from "../rpc.ts";
import { toastManager } from "./ui/toast.tsx";

type CheckpointItem = { id: number; name: string; agentId: string; createdAt: number };

interface CheckpointBrowserProps {
  agents: ReturnType<typeof useAgentList>;
}

export default function CheckpointBrowser({ agents }: CheckpointBrowserProps) {
  const navigate = useNavigate();
  const checkpoints = useCheckpointList();
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const sorted: CheckpointItem[] = useMemo(() => [...(checkpoints.data || [])].sort((a, b) => b.createdAt - a.createdAt), [checkpoints.data]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(cp => cp.name.toLowerCase().includes(q));
  }, [sorted, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, CheckpointItem[]> = {};
    for (const cp of filtered) {
      const key = formatDate(cp.createdAt);
      (groups[key] ??= []).push(cp);
    }
    return groups;
  }, [filtered]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const allCheckpoints = Object.values(grouped).flat();

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex(prev => (prev < allCheckpoints.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && allCheckpoints[highlightedIndex]) {
            const cp = allCheckpoints[highlightedIndex];
            setSelectedId(cp.id);
            setIsOpen(false);
            setSearchQuery("");
            setHighlightedIndex(-1);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, grouped, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && isOpen) {
      const highlightedItem = containerRef.current?.querySelectorAll("[data-checkpoint-item]")[highlightedIndex] as HTMLElement | null;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const launchFromCheckpoint = async (checkpointId: number) => {
    setLaunchingId(checkpointId);
    try {
      const result = await checkpointRPCClient.launchAgentFromCheckpoint({ checkpointId, headless: false });
      switch (result.status) {
        case "success":
          await agents.mutate();
          void navigate(`/agent/${result.agentId}`);
          break;
        case "checkpointNotFound":
          toastManager.error("Checkpoint not found", { duration: 3000 });
          break;
        default: {
          const exhaustive: any = result satisfies never;
          toastManager.error(`Failed to launch agent from checkpoint, unknown result: ${exhaustive.status}`, { duration: 3000 });
          break;
        }
      }
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setLaunchingId(null);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selected = selectedId ? (sorted.find(cp => cp.id === selectedId) ?? null) : null;

  if (!checkpoints.data?.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-500/90 uppercase tracking-widest flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Resume from Checkpoint
        </span>
        <span className="text-2xs text-muted">{checkpoints.data.length} saved</span>
      </div>

      <div className="bg-secondary border border-primary rounded-lg shadow-md overflow-hidden">
        {/* Selector trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={e => {
            if (e.key === "ArrowDown" || e.key === "Enter") {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
          aria-expanded={isOpen}
          aria-label="Select a checkpoint"
          aria-haspopup="listbox"
        >
          <History className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
          <div className="flex-1 min-w-0">
            {selected ? (
              <>
                <div className="text-sm font-medium text-primary truncate">{selected.name}</div>
                <div className="text-2xs text-muted mt-0.5">{formatTimeAgo(selected.createdAt)}</div>
              </>
            ) : (
              <span className="text-sm text-muted">Select a checkpoint...</span>
            )}
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Expandable dropdown list */}
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="border-t border-primary">
                {/* Search */}
                <div className="px-3 py-2 border-b border-primary">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                    <input
                      ref={searchRef}
                      type="text"
                      placeholder="Filter checkpoints..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-input border border-primary rounded-md py-1.5 pl-8 pr-8 text-xs text-primary placeholder-muted focus-accent transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted hover:bg-hover hover:text-primary cursor-pointer focus-ring"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Keyboard hint */}
                  <div className="flex items-center gap-2 px-1 pt-1.5">
                    <span className="text-2xs text-muted">Use</span>
                    <kbd className="px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-2xs text-muted font-mono">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-2xs text-muted font-mono">↓</kbd>
                    <span className="text-2xs text-muted">to navigate, </span>
                    <kbd className="px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-2xs text-muted font-mono">↵</kbd>
                    <span className="text-2xs text-muted">to select</span>
                  </div>
                </div>

                {/* Checkpoint list */}
                <div className="max-h-64 overflow-y-auto custom-scrollbar" role="listbox" aria-label="Available checkpoints">
                  {Object.keys(grouped).length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted">No checkpoints matching "{searchQuery}"</div>
                  ) : (
                    Object.entries(grouped).map(([date, items]) => {
                      const isCollapsed = collapsedGroups.has(date);
                      return (
                        <div key={date}>
                          {/* Date group header */}
                          <button
                            type="button"
                            onClick={() => toggleGroup(date)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-2xs font-semibold text-muted uppercase tracking-wider hover:bg-hover transition-colors cursor-pointer"
                            aria-expanded={!isCollapsed}
                          >
                            {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            <span>{date}</span>
                            <span className="text-2xs font-mono text-muted ml-auto">{items.length}</span>
                          </button>

                          <AnimatePresence>
                            {!isCollapsed && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                className="overflow-hidden"
                              >
                                {items.map((cp, cpIndex) => {
                                  const flatIndex = Object.values(grouped).slice(0, Object.keys(grouped).indexOf(date)).flat().length + cpIndex;

                                  return (
                                    <button
                                      type="button"
                                      key={cp.id}
                                      onClick={() => {
                                        setSelectedId(cp.id === selectedId ? null : cp.id);
                                        setIsOpen(false);
                                        setSearchQuery("");
                                      }}
                                      onMouseEnter={() => setHighlightedIndex(flatIndex)}
                                      onFocus={() => setHighlightedIndex(flatIndex)}
                                      data-checkpoint-item
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                                        cp.id === selectedId
                                          ? "bg-accent-subtle border-l-4 border-accent"
                                          : highlightedIndex === flatIndex
                                            ? "bg-hover border-l-4 border-accent-strong"
                                            : "border-l-4 border-transparent"
                                      }`}
                                      role="option"
                                      aria-selected={cp.id === selectedId}
                                    >
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${cp.id === selectedId ? "bg-accent shadow-accent" : "bg-tertiary"}`}
                                      />
                                      <span className={`flex-1 text-sm truncate ${cp.id === selectedId ? "text-accent font-medium" : "text-primary"}`}>
                                        {cp.name}
                                      </span>
                                      <span className="text-2xs text-muted font-mono shrink-0">{formatTime(cp.createdAt)}</span>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Launch bar — visible when a checkpoint is selected */}
        {selected && !isOpen && (
          <div className="border-t border-primary px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xs min-w-0">
              <span className="truncate font-medium text-primary">{selected.name}</span>
              <span className="text-muted">•</span>
              <span className="truncate text-muted">
                {formatDate(selected.createdAt)} at {formatTime(selected.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-muted hover:text-primary text-xs font-medium transition-colors cursor-pointer focus-ring rounded-md hover:bg-hover"
                aria-label={`Clear selection`}
                title="Clear selection"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => launchFromCheckpoint(selected.id)}
                disabled={launchingId === selected.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary"
                aria-label={`Launch agent from checkpoint: ${selected.name}`}
              >
                {launchingId === selected.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Launch
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
