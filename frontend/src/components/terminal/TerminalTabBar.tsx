import type { ParsedTerminalSessionSummary } from "@tokenring-ai/terminal/schema";
import { ChevronLeft, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type TerminalTabBarProps = {
  terminals: ParsedTerminalSessionSummary[];
  activeName: string | null;
  onSelect: (terminalName: string) => void;
  onClose: (terminalName: string) => void;
  onNew: () => void;
  spawning?: boolean;
};

/** How far the chevron buttons nudge the strip per click. */
const SCROLL_STEP = 240;

/** The label shown on a tab: the last command run, falling back to the session id. */
function tabLabel(terminal: ParsedTerminalSessionSummary): string {
  const lastInput = terminal.lastInput?.trim();
  return lastInput ? lastInput : terminal.name;
}

/**
 * Horizontal strip of terminal tabs with a new-tab button.
 *
 * The strip scrolls horizontally once the tabs outgrow the width available, with chevron
 * buttons appearing on whichever side still has content off-screen.
 */
export default function TerminalTabBar({ terminals, activeName, onSelect, onClose, onNew, spawning }: TerminalTabBarProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollAffordances = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    setCanScrollLeft(strip.scrollLeft > 1);
    // Sub-pixel widths mean scrollLeft never quite reaches maxScroll; a 1px slack avoids a stuck arrow.
    setCanScrollRight(strip.scrollLeft < maxScroll - 1);
  }, []);

  // Re-check whenever the strip itself resizes, not just when the window does.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    syncScrollAffordances();
    const observer = new ResizeObserver(syncScrollAffordances);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [syncScrollAffordances]);

  // Adding or removing a tab changes the scrollable width — re-measure chevrons.
  // Depend on count (and names via join) rather than the array identity so list stream
  // snapshots that only change lastInput don't thrash the scroll state.
  const terminalKey = terminals.map(t => t.name).join("\0");
  useEffect(syncScrollAffordances, [syncScrollAffordances, terminalKey]);

  // Keep the selected tab visible when navigation comes from outside the strip (URL, close).
  useEffect(() => {
    if (!activeName) return;
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-terminal-tab="${CSS.escape(activeName)}"]`);
    // scrollIntoView is missing in some test environments (jsdom); skip rather than throw.
    tab?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [activeName]);

  const scrollBy = (delta: number) => {
    stripRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="shrink-0 flex items-stretch border-b border-primary bg-secondary/50">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-SCROLL_STEP)}
          className="shrink-0 px-1.5 text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div ref={stripRef} onScroll={syncScrollAffordances} className="flex-1 flex items-stretch min-w-0 overflow-x-auto" role="tablist" aria-label="Terminals">
        {terminals.map(terminal => {
          const isActive = terminal.name === activeName;
          return (
            <div
              key={terminal.name}
              data-terminal-tab={terminal.name}
              className={`group flex items-center gap-2 pl-3 pr-1.5 py-2 border-r border-primary shrink-0 max-w-52 transition-colors ${
                isActive ? "bg-[#1a1a2e] border-b-2 border-b-emerald-500" : "hover:bg-hover border-b-2 border-b-transparent"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(terminal.name)}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer focus-ring rounded-sm"
                title={`${tabLabel(terminal)} — ${terminal.workingDirectory}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${terminal.running ? "bg-emerald-500" : "bg-muted/50"}`} />
                <span className={`text-xs font-mono truncate ${isActive ? "text-primary" : "text-secondary"}`}>{tabLabel(terminal)}</span>
              </button>
              <button
                type="button"
                onClick={() => onClose(terminal.name)}
                className={`p-0.5 rounded-md text-muted hover:text-red-500 hover:bg-hover transition-all cursor-pointer focus-ring shrink-0 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                }`}
                aria-label={`Close terminal ${tabLabel(terminal)}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(SCROLL_STEP)}
          className="shrink-0 px-1.5 text-muted hover:text-primary hover:bg-hover transition-colors focus-ring cursor-pointer"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onNew}
        disabled={spawning}
        className="shrink-0 flex items-center gap-1.5 px-3 border-l border-primary text-muted hover:text-emerald-500 hover:bg-hover transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="New terminal"
      >
        {spawning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
    </div>
  );
}
