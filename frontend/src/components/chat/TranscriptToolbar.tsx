import { ChevronDown, EyeOff, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";

interface TranscriptToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hideToolCalls: boolean;
  onToggleHideToolCalls: () => void;
  /** The host's controls for this chat (status, model, tools), on the same row; hidden while searching. */
  leading?: ReactNode;
}

/** The chat's one header row: the host's agent controls, then search and tool visibility. Copy and export live in the chat's ⋯ menu. */
export default function TranscriptToolbar({ searchQuery, onSearchChange, hideToolCalls, onToggleHideToolCalls, leading }: TranscriptToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  return (
    <div className="shrink-0 flex items-center justify-end gap-1 border-b border-line bg-raised px-2 py-1 z-10">
      {leading && !searchOpen && <div className="mr-auto flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading}</div>}
      {searchOpen ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={event => onSearchChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") {
                onSearchChange("");
                setSearchOpen(false);
              }
            }}
            placeholder="Search in conversation…"
            aria-label="Search in conversation"
            className="flex-1 min-w-0 bg-transparent text-xs font-mono text-primary placeholder-muted outline-none py-1"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} className="p-1 rounded text-muted hover:text-primary focus-ring" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              setSearchOpen(false);
            }}
            className="p-1 rounded text-muted hover:text-primary focus-ring"
            aria-label="Close search"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
            title="Search in conversation"
            aria-label="Search in conversation"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggleHideToolCalls}
            aria-pressed={hideToolCalls}
            className={cn(
              "p-1.5 rounded-md transition-colors focus-ring",
              hideToolCalls ? "text-accent bg-active" : "text-muted hover:text-primary hover:bg-hover",
            )}
            title={hideToolCalls ? "Show tool calls" : "Hide tool calls"}
            aria-label={hideToolCalls ? "Show tool calls" : "Hide tool calls"}
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
