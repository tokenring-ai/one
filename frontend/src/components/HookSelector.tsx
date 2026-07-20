import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Search, X, XCircle, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { lifecycleRPCClient, useAvailableHooks, useEnabledHooks } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface HookSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

export default function HookSelector({ agentId, triggerVariant = "default" }: HookSelectorProps) {
  const availableHooks = useAvailableHooks();
  const enabledHooks = useEnabledHooks(agentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const isIconTrigger = triggerVariant === "icon";

  const enabledHooksData = enabledHooks.data?.status === "success" ? enabledHooks.data : null;
  const enabledSet = useMemo(() => new Set(enabledHooksData?.hooks || []), [enabledHooksData?.hooks]);

  const hooks = availableHooks.data?.hooks;
  const hookCount = Object.keys(hooks ?? {}).length;
  const enabledCount = enabledHooksData?.hooks.length ?? 0;
  const allEnabled = hookCount > 0 && enabledCount === hookCount;

  const handleToggleHook = useCallback(
    async (hookName: string) => {
      try {
        const isEnabled = enabledSet.has(hookName);
        if (isEnabled) {
          await lifecycleRPCClient.disableHooks({ agentId, hooks: [hookName] });
        } else {
          await lifecycleRPCClient.enableHooks({ agentId, hooks: [hookName] });
        }
        void enabledHooks.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [agentId, enabledHooks, enabledSet],
  );

  const filteredHooks = useMemo(() => {
    if (!searchQuery.trim()) return hooks;
    const query = searchQuery.toLowerCase();
    return Object.fromEntries(
      Object.entries(hooks ?? {}).filter(([hookName, hook]) => hook.displayName.toLowerCase().includes(query) || hookName.toLowerCase().includes(query)),
    );
  }, [hooks, searchQuery]);

  const filteredHookNames = useMemo(() => Object.keys(filteredHooks ?? []), [filteredHooks]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, hookName: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        void handleToggleHook(hookName);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev + 1;
          return next < filteredHookNames.length ? next : 0;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev - 1;
          return next >= 0 ? next : filteredHookNames.length - 1;
        });
      }
    },
    [handleToggleHook, filteredHookNames.length],
  );

  const handleItemFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleToggleAll = useCallback(async () => {
    const allHookNames = Object.keys(hooks ?? {});
    try {
      if (allEnabled) {
        await lifecycleRPCClient.disableHooks({ agentId, hooks: allHookNames });
      } else {
        await lifecycleRPCClient.enableHooks({ agentId, hooks: allHookNames });
      }
      void enabledHooks.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  }, [agentId, allEnabled, enabledHooks, hooks]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={`Select hooks. ${enabledCount} of ${hookCount} enabled`}
          title={`${enabledCount} of ${hookCount} hooks enabled`}
        >
          <Zap className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
          {!isIconTrigger && (
            <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">
              {enabledCount}/{hookCount} enabled
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-150 w-100 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        aria-label="Select lifecycle hooks"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <span className="text-sm flex-1 font-mono text-muted shrink-0">Hooks</span>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Filter hooks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  if (searchQuery) {
                    setSearchQuery("");
                  } else {
                    // Let the dropdown handle closing when search is empty
                  }
                }
              }}
              className="w-full bg-input border border-primary rounded-md py-1.5 pl-9 pr-8 text-xs text-primary placeholder-muted focus-ring transition-all"
              onClick={e => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                className="absolute inset-y-0 right-2 flex items-center p-0.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
                aria-label="Clear search"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Toggle all hooks button */}
        {hookCount > 1 && (
          <div className="border-b border-primary px-3">
            <button
              type="button"
              onClick={() => void handleToggleAll()}
              className="w-full flex items-center justify-between p-2 rounded-md hover:bg-hover transition-colors text-xs font-mono focus-ring"
            >
              <span className="text-muted">{allEnabled ? "Disable all hooks" : "Enable all hooks"}</span>
              <span className="text-muted">
                {enabledCount}/{hookCount}
              </span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-0.5" role="listbox" aria-label="Available hooks">
          {Object.entries(filteredHooks ?? {}).map(([hookName, hook], index) => {
            const isEnabled = enabledSet.has(hookName);
            const isFocused = focusedIndex === index;
            return (
              <div
                key={hookName}
                role="option"
                aria-selected={isEnabled}
                tabIndex={0}
                onClick={e => {
                  e.stopPropagation();
                  void handleToggleHook(hookName);
                }}
                onKeyDown={e => {
                  e.stopPropagation();
                  handleKeyDown(e, hookName);
                }}
                onFocus={() => handleItemFocus(index)}
                className={`flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group focus-ring ${
                  isFocused ? "bg-hover" : "hover:bg-hover"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${isEnabled ? "bg-amber-500" : "bg-muted/50"}`} />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-xs font-mono leading-tight truncate ${
                      isEnabled ? "text-amber-500 dark:text-amber-400 font-medium" : "text-muted group-hover:text-primary"
                    }`}
                  >
                    {hook.displayName}
                  </div>
                  {hook.description && <div className="text-2xs text-dim font-mono leading-tight truncate mt-0.5">{hook.description}</div>}
                </div>
                {isEnabled ? (
                  <Check className="w-3 h-3 text-amber-500 dark:text-amber-400 ml-2 shrink-0" aria-label="Enabled" />
                ) : (
                  <X className="w-3 h-3 text-muted group-hover:text-primary ml-2 shrink-0" aria-label="Disabled" />
                )}
              </div>
            );
          })}

          {Object.keys(filteredHooks ?? {}).length === 0 && searchQuery && (
            <div className="px-3 py-4 text-center text-xs text-muted" role="status">
              No hooks found matching "{searchQuery}"
            </div>
          )}

          {hookCount === 0 && <div className="px-3 py-4 text-center text-xs text-muted">No hooks available</div>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
