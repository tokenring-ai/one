import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Bot,
  Bug,
  Check,
  Circle,
  CircleCheck,
  Cloud,
  Code,
  Database,
  Eye,
  FileCode,
  FileSearch,
  GitBranch,
  Globe,
  Layers,
  MessageSquare,
  Mic,
  Newspaper,
  Repeat,
  Search,
  Server,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { chatRPCClient, useAvailableTools, useEnabledTools } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface ToolSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

// Package icon mapping
const iconSm = "w-3.5 h-3.5";

const packageIcons: Record<string, React.ReactNode> = {
  "@tokenring-ai/agent": <Bot className={iconSm} />,
  "@tokenring-ai/ai-client": <Database className={iconSm} />,
  "@tokenring-ai/websearch": <Globe className={iconSm} />,
  "@tokenring-ai/filesystem": <Code className={iconSm} />,
  "@tokenring-ai/memory": <Cloud className={iconSm} />,
  "@tokenring-ai/git": <GitBranch className={iconSm} />,
  "@tokenring-ai/testing": <Bug className={iconSm} />,
  "@tokenring-ai/codebase": <FileCode className={iconSm} />,
  "@tokenring-ai/code-watch": <Eye className={iconSm} />,
  "@tokenring-ai/file-index": <FileSearch className={iconSm} />,
  "@tokenring-ai/iterables": <Repeat className={iconSm} />,
  "@tokenring-ai/scripting": <Code className={iconSm} />,
  "@tokenring-ai/tasks": <Layers className={iconSm} />,
  "@tokenring-ai/slack": <MessageSquare className={iconSm} />,
  "@tokenring-ai/telegram": <MessageSquare className={iconSm} />,
  "@tokenring-ai/feedback": <MessageSquare className={iconSm} />,
  "@tokenring-ai/blog": <Newspaper className={iconSm} />,
  "@tokenring-ai/ghost-io": <Newspaper className={iconSm} />,
  "@tokenring-ai/wordpress": <Newspaper className={iconSm} />,
  "@tokenring-ai/newsrpm": <Newspaper className={iconSm} />,
  "@tokenring-ai/reddit": <MessageSquare className={iconSm} />,
  "@tokenring-ai/audio": <Mic className={iconSm} />,
  "@tokenring-ai/linux-audio": <Mic className={iconSm} />,
  "@tokenring-ai/sandbox": <Code className={iconSm} />,
  "@tokenring-ai/docker": <Server className={iconSm} />,
  "@tokenring-ai/kubernetes": <Server className={iconSm} />,
  "@tokenring-ai/aws": <Cloud className={iconSm} />,
  "@tokenring-ai/mcp": <Database className={iconSm} />,
  "@tokenring-ai/research": <Sparkles className={iconSm} />,
  "@tokenring-ai/cli": <Terminal className={iconSm} />,
  "@tokenring-ai/web-host": <Server className={iconSm} />,
};

// Package color mapping
const packageColors: Record<string, string> = {
  "@tokenring-ai/agent": "text-accent",
  "@tokenring-ai/ai-client": "text-blue-600 dark:text-blue-400",
  "@tokenring-ai/websearch": "text-cyan-600 dark:text-cyan-400",
  "@tokenring-ai/filesystem": "text-emerald-600 dark:text-emerald-400",
  "@tokenring-ai/memory": "text-purple-600 dark:text-purple-400",
  "@tokenring-ai/git": "text-orange-600 dark:text-orange-500",
  "@tokenring-ai/testing": "text-pink-600 dark:text-pink-500",
  "@tokenring-ai/codebase": "text-amber-600 dark:text-amber-500",
  "@tokenring-ai/code-watch": "text-yellow-600 dark:text-yellow-500",
  "@tokenring-ai/file-index": "text-red-600 dark:text-red-500",
  "@tokenring-ai/iterables": "text-teal-600 dark:text-teal-500",
  "@tokenring-ai/scripting": "text-lime-600 dark:text-lime-500",
  "@tokenring-ai/tasks": "text-green-600 dark:text-green-500",
  "@tokenring-ai/slack": "text-accent",
  "@tokenring-ai/telegram": "text-blue-600 dark:text-blue-500",
  "@tokenring-ai/feedback": "text-purple-600 dark:text-purple-500",
  "@tokenring-ai/blog": "text-cyan-600 dark:text-cyan-500",
  "@tokenring-ai/ghost-io": "text-rose-600 dark:text-rose-500",
  "@tokenring-ai/wordpress": "text-blue-500 dark:text-blue-400",
  "@tokenring-ai/newsrpm": "text-orange-600 dark:text-orange-500",
  "@tokenring-ai/reddit": "text-red-600 dark:text-red-500",
  "@tokenring-ai/audio": "text-violet-600 dark:text-violet-500",
  "@tokenring-ai/linux-audio": "text-violet-600 dark:text-violet-500",
  "@tokenring-ai/sandbox": "text-blue-600 dark:text-blue-500",
  "@tokenring-ai/docker": "text-blue-600 dark:text-blue-500",
  "@tokenring-ai/kubernetes": "text-cyan-600 dark:text-cyan-500",
  "@tokenring-ai/aws": "text-orange-600 dark:text-orange-500",
  "@tokenring-ai/mcp": "text-pink-600 dark:text-pink-500",
  "@tokenring-ai/research": "text-purple-600 dark:text-purple-500",
  "@tokenring-ai/cli": "text-emerald-600 dark:text-emerald-500",
  "@tokenring-ai/web-host": "text-orange-600 dark:text-orange-500",
  default: "text-muted",
};

export default function ToolSelector({ agentId, triggerVariant = "default" }: ToolSelectorProps) {
  const availableTools = useAvailableTools();
  const enabledTools = useEnabledTools(agentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const isIconTrigger = triggerVariant === "icon";

  const tools = availableTools.data?.tools;

  const enabledToolsData = enabledTools.data?.status === "success" ? enabledTools.data : null;

  const handleToggleTool = useCallback(
    async (toolName: string) => {
      try {
        const isEnabled = enabledToolsData?.tools.includes(toolName);
        if (isEnabled) {
          await chatRPCClient.disableTools({ agentId, tools: [toolName] });
        } else {
          await chatRPCClient.enableTools({ agentId, tools: [toolName] });
        }
        void enabledTools.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [agentId, enabledTools, enabledToolsData?.tools],
  );

  const handleToggleCategory = useCallback(
    async (_category: string, categoryTools: Record<string, string>) => {
      try {
        const allToolNames = Object.values(categoryTools);
        const enabledSet = new Set(enabledToolsData?.tools || []);

        const allEnabled = allToolNames.every(toolName => enabledSet.has(toolName));

        if (allEnabled) {
          await chatRPCClient.disableTools({ agentId, tools: allToolNames });
        } else {
          await chatRPCClient.enableTools({ agentId, tools: allToolNames });
        }
        void enabledTools.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      }
    },
    [agentId, enabledTools, enabledToolsData?.tools],
  );

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return Object.fromEntries(
      Object.entries(tools ?? {}).filter(([toolName, tool]) => tool.displayName.toLowerCase().includes(query) || toolName.toLowerCase().includes(query)),
    );
  }, [tools, searchQuery]);

  const filteredToolsByCategory = useMemo(() => {
    const grouped: Record<string, Record<string, string>> = {};
    const categories = new Set<string>();

    for (const [toolName, tool] of Object.entries(filteredTools ?? {})) {
      const [, category = "Unknown", displayName = tool.displayName] = tool.displayName.match(/^(.*)\/(.*)$/) ?? [];
      (grouped[category] ??= {})[displayName] = toolName;
      categories.add(category);
    }

    return { grouped, categories };
  }, [filteredTools]);

  // Auto-expand categories that contain search results
  useEffect(() => {
    if (searchQuery.trim() && filteredToolsByCategory.categories.size > 0) {
      setExpandedCategories(new Set(filteredToolsByCategory.categories));
    }
  }, [searchQuery, filteredToolsByCategory.categories]);

  const enabledSet = useMemo(() => new Set(enabledToolsData?.tools || []), [enabledToolsData?.tools]);

  useEffect(() => {
    const categoriesWithEnabledTools = new Set<string>();
    enabledToolsData?.tools.forEach(tool => {
      const [, toolName] = tool.match(/^(.*)\//) ?? [];
      if (toolName) {
        categoriesWithEnabledTools.add(toolName);
      }
    });
    setExpandedCategories(categoriesWithEnabledTools);
  }, [enabledToolsData?.tools]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={`Select tools. ${enabledToolsData?.tools.length ?? 0} enabled`}
          title={`${enabledToolsData?.tools.length ?? 0} tools enabled`}
        >
          <Layers className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
          {!isIconTrigger && (
            <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">{enabledToolsData?.tools.length ?? 0} enabled</span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        style={{ width: "450px" }}
        aria-label="Select AI tools"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <span className="text-sm flex-1 font-mono text-muted shrink-0">Tools</span>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Filter tools..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
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
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-0.5">
          {Object.entries(filteredToolsByCategory.grouped)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([category, categoryTools]) => {
              const isPackageExpanded = expandedCategories.has(category);
              const packageIcon = packageIcons[category] || <Database className={iconSm} />;
              const packageColor = packageColors[category] || packageColors.default;

              const toolCount = Object.keys(categoryTools).length;
              let enabledToolCount = 0;
              for (const [, toolName] of Object.entries(categoryTools)) {
                if (enabledSet.has(toolName)) enabledToolCount++;
              }

              const allEnabled = enabledToolCount === toolCount && toolCount > 0;
              const allDisabled = enabledToolCount === 0;

              return (
                <div key={category} className="flex flex-col">
                  <div className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-2 transition-colors group select-none">
                    <div
                      className="w-5 flex items-center justify-center text-muted group-hover:text-primary"
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(category)) {
                            next.delete(category);
                          } else {
                            next.add(category);
                          }
                          return next;
                        });
                      }}
                    >
                      <svg className="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <title>Expand/collapse category</title>
                        {isPackageExpanded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        )}
                      </svg>
                    </div>

                    <div
                      className="flex-1 flex items-center gap-2 text-primary text-xs font-medium"
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(category)) {
                            next.delete(category);
                          } else {
                            next.add(category);
                          }
                          return next;
                        });
                      }}
                    >
                      <span className={packageColor}>{packageIcon}</span>
                      {category}
                    </div>

                    <div
                      className="flex items-center gap-1.5 cursor-pointer hover:bg-hover rounded-md px-2 py-1 transition-colors border border-transparent hover:border-primary focus-ring"
                      onClick={e => {
                        e.stopPropagation();
                        void handleToggleCategory(category, categoryTools);
                      }}
                      title={allEnabled ? "Disable all tools" : allDisabled ? "Enable all tools" : "Toggle all tools"}
                    >
                      <span className="text-2xs font-mono text-muted">
                        {enabledToolCount}/{toolCount}
                      </span>
                      <div className="flex items-center gap-1">
                        {allEnabled ? (
                          <>
                            <X className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] text-emerald-500 font-mono">Disable</span>
                          </>
                        ) : allDisabled ? (
                          <>
                            <Circle className="w-3 h-3 text-muted hover:text-emerald-500" />
                            <span className="text-[10px] text-muted hover:text-emerald-500 font-mono">Enable</span>
                          </>
                        ) : (
                          <>
                            <CircleCheck className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] text-amber-500 font-mono">Mixed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isPackageExpanded && (
                    <div className="flex flex-col pl-5 mt-0.5 space-y-0.5 border-l border-primary ml-2">
                      {Object.entries(categoryTools).map(([displayName, toolName]) => {
                        const isEnabled = enabledSet.has(toolName);
                        return (
                          <div
                            key={toolName}
                            onClick={e => {
                              e.stopPropagation();
                              void handleToggleTool(toolName);
                            }}
                            className="flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group hover:bg-hover"
                          >
                            <div className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${isEnabled ? "bg-emerald-500" : "bg-muted/50"}`} />
                            <span
                              className={`flex-1 text-xs font-mono leading-tight truncate ${
                                isEnabled ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted group-hover:text-primary"
                              }`}
                            >
                              {displayName}
                            </span>
                            {isEnabled ? (
                              <Check className="w-3 h-3 text-emerald-500 ml-2 shrink-0" aria-label="Enabled" />
                            ) : (
                              <X className="w-3 h-3 text-muted group-hover:text-primary ml-2 shrink-0" aria-label="Disabled" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          {filteredToolsByCategory.categories.size === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted">No tools found matching "{searchQuery}"</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
