import { ChevronDown, Loader2, Plus, Square } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.ts";
import type { RunningAgent } from "../lib/agentSessions.ts";
import { useAgentTypes } from "../rpc.ts";

export interface AgentSessionBarProps {
  /** Agent types this app can launch. The first entry is the default. */
  agentTypes: readonly string[];
  /** The agent the app is currently attached to, if any. */
  currentAgent: RunningAgent | null;
  /** Create and attach to a new agent of the given type. */
  onCreate: (agentType: string) => void;
  /** Stop the attached agent (the caller confirms). */
  onTerminate: () => void;
  /** Tailwind classes applied to the launch button (per-app accent). */
  buttonClassName: string;
  /** Disables the launch controls while a creation is in flight. */
  busy?: boolean;
}

/**
 * Header control for an app's agent session: a split "New Agent" button whose arrow
 * offers the other allowed agent types, plus a stop button for the attached agent.
 */
export default function AgentSessionBar({ agentTypes, currentAgent, onCreate, onTerminate, buttonClassName, busy = false }: AgentSessionBarProps) {
  const catalog = useAgentTypes();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setMenuOpen(false), { enabled: menuOpen });

  // Keep the configured order (first = default); fall back to the raw id for types
  // that are configured for this app but missing from the installed catalog.
  const options = useMemo(
    () =>
      agentTypes.map(type => {
        const entry = catalog.data?.find(t => t.type === type);
        return { type, displayName: entry?.displayName ?? type, description: entry?.description ?? "" };
      }),
    [agentTypes, catalog.data],
  );

  const defaultType = agentTypes[0];

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {currentAgent && (
        <button
          type="button"
          onClick={onTerminate}
          title={`Stop ${currentAgent.displayName}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-primary text-muted hover:text-red-500 hover:border-red-500/50 transition-colors focus-ring cursor-pointer"
        >
          <Square className="w-3 h-3" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      )}

      <div className="relative flex items-stretch" ref={menuRef}>
        <button
          type="button"
          onClick={() => defaultType && onCreate(defaultType)}
          disabled={busy || !defaultType}
          className={`flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-xs font-medium rounded-l-lg transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${options.length > 1 ? "" : "rounded-r-lg"}`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          New Agent
        </button>

        {options.length > 1 && (
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            disabled={busy}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Choose agent type"
            title="Choose agent type"
            className={`flex items-center px-1.5 rounded-r-lg border-l border-black/15 transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}

        {menuOpen && (
          <div
            className="absolute top-full right-0 mt-1 w-64 bg-secondary border border-primary rounded-card shadow-card z-50 overflow-hidden py-1"
            role="menu"
          >
            {options.map((option, index) => (
              <button
                type="button"
                key={option.type}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onCreate(option.type);
                }}
                className="w-full px-3 py-2 text-left hover:bg-hover transition-colors cursor-pointer focus-ring"
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary">{option.displayName}</span>
                  {index === 0 && <span className="shrink-0 text-xs text-muted uppercase tracking-wide">Default</span>}
                </span>
                {option.description && <span className="block mt-0.5 text-xs text-muted line-clamp-2">{option.description}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
