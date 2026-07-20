import formatError from "@tokenring-ai/utility/error/formatError";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Bot, Check, Cloud, Code, Cpu, Database, GitFork, Search, Sparkles, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { chatRPCClient, useChatModelsByProvider, useModel } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface ModelSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

// Provider icon mapping
const providerIcons: Record<string, React.ReactNode> = {
  anthropic: <Sparkles className="w-3.5 h-3.5" />,
  azure: <Cloud className="w-3.5 h-3.5" />,
  cerebras: <Cpu className="w-3.5 h-3.5" />,
  deepseek: <Code className="w-3.5 h-3.5" />,
  google: <Sparkles className="w-3.5 h-3.5" />,
  groq: <Zap className="w-3.5 h-3.5" />,
  openai: <Bot className="w-3.5 h-3.5" />,
  openrouter: <GitFork className="w-3.5 h-3.5" />,
  qwen: <Cloud className="w-3.5 h-3.5" />,
  xai: <Cloud className="w-3.5 h-3.5" />,
  zai: <BookOpen className="w-3.5 h-3.5" />,
};

// Provider color mapping
const providerColors: Record<string, string> = {
  anthropic: "text-accent",
  azure: "text-blue-600 dark:text-blue-400",
  cerebras: "text-amber-600 dark:text-amber-500",
  deepseek: "text-cyan-600 dark:text-cyan-500",
  google: "text-blue-500 dark:text-blue-400",
  groq: "text-orange-600 dark:text-orange-500",
  openai: "text-zinc-900 dark:text-white",
  openrouter: "text-purple-600 dark:text-purple-400",
  qwen: "text-pink-600 dark:text-pink-500",
  xai: "text-zinc-800 dark:text-zinc-100",
  zai: "text-green-600 dark:text-green-500",
  default: "text-muted",
};

export default function ModelSelector({ agentId, triggerVariant = "default" }: ModelSelectorProps) {
  const currentModel = useModel(agentId);
  const modelsData = useChatModelsByProvider();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectingModelId, setSelectingModelId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);
  const [focusedModelIndex, setFocusedModelIndex] = useState<number>(-1);
  const isIconTrigger = triggerVariant === "icon";
  const currentModelData = currentModel.data?.status === "success" ? currentModel.data : null;

  const handleSelectModel = useCallback(
    async (modelId: string) => {
      if (isSelecting) return; // Prevent double-clicks
      setSelectingModelId(modelId);
      setIsSelecting(true);
      try {
        await chatRPCClient.setModel({ agentId, model: modelId });
        void currentModel.mutate(); //.mutate({ status: "success", model: modelId, modelSpec: currentModel.data.});
        setIsSelecting(false);
        setSelectingModelId(null);
        setIsOpen(false);
        toastManager.success(`Model changed to ${modelId.split("/").pop()}`, { duration: 3000 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        setIsSelecting(false);
        setSelectingModelId(null);
      }
    },
    [agentId, currentModel, isSelecting],
  );

  const modelsByProvider = modelsData.data?.modelsByProvider || {};
  const hasModels = Object.keys(modelsByProvider).length > 0;

  // Flatten models for search
  const allModels = useMemo(() => {
    return Object.entries(modelsByProvider).flatMap(([provider, models]) =>
      Object.entries(models)
        .map(([modelId, modelInfo]) => ({
          modelId,
          provider,
          modelName: modelId.split("/").pop() || modelId,
          available: modelInfo.available,
        }))
        .sort((a, b) => a.modelName.localeCompare(b.modelName)),
    );
  }, [modelsByProvider]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const query = searchQuery.toLowerCase();
    return allModels.filter(model => model.modelName.toLowerCase().includes(query) || model.provider.toLowerCase().includes(query));
  }, [allModels, searchQuery]);

  // Group filtered models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof allModels> = {};

    // Sort provider keys alphabetically
    const sortedProviders = Object.keys(modelsByProvider).sort();

    sortedProviders.forEach(provider => {
      const models = filteredModels.filter(m => m.provider === provider);
      if (models.length > 0) {
        groups[provider] = models;
      }
    });

    return groups;
  }, [filteredModels, modelsByProvider]);

  // Flatten all models for keyboard navigation
  const allFlatModels = useMemo(() => {
    return Object.entries(groupedModels).flatMap(([provider, models]) => models.map(model => ({ ...model, provider })));
  }, [groupedModels]);

  // Auto-expand provider with currently selected model
  useEffect(() => {
    if (currentModelData?.model) {
      const provider = allModels.find(m => m.modelId === currentModelData.model)?.provider;
      if (provider) {
        setExpandedProviders(new Set([provider]));
      }
    }
  }, [currentModelData?.model, allModels]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={currentModelData?.model ? `Select model. Current model ${currentModelData.model}` : "Select model"}
          title={currentModelData?.model ?? "Select model"}
        >
          {isSelecting || currentModel.isLoading ? (
            <>
              <Cpu className={`${isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted"} animate-spin`} />
              {!isIconTrigger && <span className="text-xs font-mono text-muted truncate max-w-64">Loading...</span>}
            </>
          ) : (
            <>
              <Cpu className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
              {!isIconTrigger && (
                <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-64">{currentModelData?.model ?? "Select model..."}</span>
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      {hasModels && (
        <DropdownMenuContent className="max-h-150 overflow-hidden flex flex-col shadow-card" style={{ width: "450px" }} aria-label="Select AI model">
          <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
            <span className="text-sm flex-1 font-mono text-muted shrink-0">Models</span>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-muted" />
              </div>
              <input
                type="text"
                placeholder="Filter models..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setFocusedModelIndex(-1); // Reset focus when filtering
                }}
                onKeyDown={e => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setFocusedModelIndex(
                      prev => (prev < allFlatModels.length - 1 ? prev + 1 : 0), // Wrap to first
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusedModelIndex(prev => (prev > 0 ? prev - 1 : allFlatModels.length - 1)); // Wrap to last
                  } else if (e.key === "Enter" && focusedModelIndex >= 0) {
                    e.preventDefault();
                    const model = allFlatModels[focusedModelIndex];
                    if (model) void handleSelectModel(model.modelId);
                  }
                }}
                className="w-full bg-input border border-primary rounded-md py-1.5 pl-9 pr-8 text-xs text-primary placeholder-muted focus-ring transition-all"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Tree List Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-0.5">
            {Object.entries(groupedModels).map(([provider, models]) => {
              const isProviderExpanded = expandedProviders.has(provider);
              const providerCode = models[0]?.modelName.replace(/:.*/, "") ?? "unknown";
              const providerIcon = providerIcons[providerCode] ?? <Database className="w-3.5 h-3.5" />;
              const providerColor = providerColors[providerCode] ?? providerColors.default;

              return (
                <div key={provider} className="flex flex-col">
                  {/* Provider Header */}
                  <div
                    className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-2 transition-colors group select-none focus-ring"
                    onClick={() => {
                      setExpandedProviders(prev => {
                        const next = new Set(prev);
                        if (next.has(provider)) {
                          next.delete(provider);
                        } else {
                          next.add(provider);
                        }
                        return next;
                      });
                    }}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isProviderExpanded}
                  >
                    <span className="w-5 flex items-center justify-center text-muted group-hover:text-primary">
                      <svg
                        className="w-3 h-3 transition-transform duration-200"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-label={isProviderExpanded ? "Collapse provider" : "Expand provider"}
                      >
                        {isProviderExpanded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        )}
                      </svg>
                    </span>
                    <div className="flex-1 flex items-center gap-2 text-primary text-xs font-medium">
                      <span className={providerColor}>{providerIcon}</span>
                      {provider}
                    </div>
                    <span className="text-2xs font-mono text-muted px-1.5">{models.length}</span>
                  </div>

                  {/* Model List */}
                  <AnimatePresence>
                    {isProviderExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col pl-5 mt-0.5 space-y-0.5 border-l border-primary ml-2 overflow-hidden"
                      >
                        {models.map(model => {
                          const globalIndex = allFlatModels.findIndex(m => m.modelId === model.modelId);
                          const isFocused = focusedModelIndex === globalIndex;

                          return (
                            <div
                              key={model.modelId}
                              ref={
                                isFocused
                                  ? el => {
                                      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                                    }
                                  : undefined
                              }
                              onClick={() => handleSelectModel(model.modelId)}
                              className={`flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group hover:bg-hover focus-ring ${
                                isSelecting && selectingModelId === model.modelId ? "opacity-75" : ""
                              } ${isFocused ? "bg-hover" : ""}`}
                              tabIndex={0}
                              role="button"
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  void handleSelectModel(model.modelId);
                                }
                              }}
                              onFocus={() => setFocusedModelIndex(globalIndex)}
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${
                                  currentModelData?.model === model.modelId
                                    ? "bg-accent shadow-[0_0_6px_rgba(99,102,241,0.5)]"
                                    : model.available
                                      ? "bg-emerald-500"
                                      : "bg-muted/50"
                                }`}
                              />
                              <span
                                className={`flex-1 text-xs font-mono leading-tight truncate ${
                                  currentModelData?.model === model.modelId
                                    ? "text-accent font-medium"
                                    : isFocused
                                      ? "text-primary font-medium"
                                      : "text-muted group-hover:text-primary"
                                }`}
                              >
                                {model.modelName}
                              </span>
                              {isSelecting && selectingModelId === model.modelId ? (
                                <Cpu className="w-3 h-3 text-accent-soft ml-2 shrink-0 animate-spin" aria-label="Selecting..." />
                              ) : currentModelData?.model === model.modelId ? (
                                <Check className="w-3 h-3 text-accent-soft ml-2 shrink-0" aria-label="Currently selected" />
                              ) : null}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {filteredModels.length === 0 && <div className="px-3 py-4 text-center text-xs text-muted">No models found matching "{searchQuery}"</div>}

            {/* Keyboard navigation hint */}
            {allFlatModels.length > 0 && <div className="px-3 py-2 text-xs text-muted border-t border-primary">Use ↑↓ to navigate, Enter to select</div>}
          </div>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
