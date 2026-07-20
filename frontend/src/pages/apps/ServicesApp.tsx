import { Cpu, Loader2, Plug, ScrollText, Wrench, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { useAppLogs, useAvailableHooks, useAvailableTools, useChatModelsByProvider } from "../../rpc.ts";

type Tab = "tools" | "models" | "hooks" | "logs";

export default function ServicesApp() {
  const [activeTab, setActiveTab] = useState<Tab>("tools");
  const availableTools = useAvailableTools();
  const modelsByProvider = useChatModelsByProvider();
  const availableHooks = useAvailableHooks();
  const appLogs = useAppLogs({ enabled: activeTab === "logs" });

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "tools", label: "Tools", icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: "models", label: "Models", icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: "hooks", label: "Hooks", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "logs", label: "Logs", icon: <ScrollText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Services"
        subtitle="Tools, AI models, and lifecycle hooks"
        icon={<Plug className="w-4 h-4" />}
        iconGradient="from-violet-500 to-purple-600"
      />

      {/* Tabs */}
      <div className="shrink-0 border-b border-primary bg-secondary flex">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors focus-ring cursor-pointer -mb-px ${
              activeTab === tab.id ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {activeTab === "tools" && <ToolsTab tools={availableTools} />}
          {activeTab === "models" && <ModelsTab models={modelsByProvider} />}
          {activeTab === "hooks" && <HooksTab hooks={availableHooks} />}
          {activeTab === "logs" && <LogsTab logs={appLogs} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Tools tab — groups available tools by package category.
 *
 * Extracted into its own component so the narrowed `tools` record
 * is a plain prop instead of being accessed through SWR's optional `data`,
 * which avoids the TS7022 circular-inference issue that occurs when
 * indexing `availableTools.data.tools[key]` inside an IIFE / ternary.
 */
function ToolsTab({ tools }: { tools: ReturnType<typeof useAvailableTools> }) {
  if (tools.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  const toolRecord = tools.data?.tools;
  if (!toolRecord) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted text-center py-12">No tools available</p>
      </div>
    );
  }

  // Group by package/category using Object.entries for proper tuple typing
  const grouped: Record<string, string[]> = {};
  for (const [toolName, tool] of Object.entries(toolRecord)) {
    const match = tool.displayName.match(/^(.*)\//);
    const category = match?.[1] ?? "Other";
    (grouped[category] ??= []).push(toolName);
  }

  const total = Object.keys(toolRecord).length;

  return (
    <div className="space-y-4">
      <p className="text-2xs text-muted px-1">
        {total} tools available across {Object.keys(grouped).length} packages
      </p>
      <div className="space-y-3">
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, toolNames]) => (
            <div key={category} className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-tertiary/50 border-b border-primary flex items-center justify-between">
                <span className="text-xs font-semibold text-primary font-mono">{category}</span>
                <span className="text-2xs text-muted">{toolNames.length} tools</span>
              </div>
              <div className="p-3 flex flex-wrap gap-1.5">
                {toolNames.sort().map(toolName => {
                  const tool = toolRecord[toolName];
                  const displayName = tool?.displayName.replace(/^.*\//, "");
                  return (
                    <span
                      key={toolName}
                      className="px-2 py-1 bg-tertiary border border-primary rounded-md text-2xs font-mono text-muted hover:text-primary transition-colors"
                      title={toolName}
                    >
                      {displayName ?? "Tool not found"}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/**
 * Models tab — displays models grouped by provider.
 *
 * Extracted into its own component so `modelsByProvider` is narrowed
 * from SWR's optional `data` into a concrete local variable, giving
 * TypeScript a definite type for the nested record entries.
 */
function ModelsTab({ models }: { models: ReturnType<typeof useChatModelsByProvider> }) {
  if (models.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  const providerMap = models.data?.modelsByProvider;
  if (!providerMap) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted text-center py-12">No models available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(providerMap).map(([provider, modelRecord]) => (
        <div key={provider} className="bg-secondary border border-primary rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-tertiary/50 border-b border-primary flex items-center justify-between">
            <span className="text-xs font-semibold text-primary capitalize">{provider}</span>
            <span className="text-2xs text-muted">{Object.keys(modelRecord).length} models</span>
          </div>
          <div className="p-3 space-y-1">
            {Object.entries(modelRecord).map(([modelId, modelInfo]) => (
              <div key={modelId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${modelInfo.available ? "bg-emerald-500/60" : "bg-muted/50"}`} />
                <span className="text-xs font-mono text-primary">{modelId.split("/").pop()}</span>
                <span className="text-2xs text-muted ml-auto">{modelInfo.status}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Hooks tab — displays available lifecycle hooks.
 *
 * Extracted into its own component so `hooks` is narrowed from SWR's
 * optional `data` into a concrete local variable, giving TypeScript
 * a definite type for the record entries.
 */
function LogsTab({ logs }: { logs: ReturnType<typeof useAppLogs> }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.data?.logs.length]);

  if (logs.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  const entries = logs.data?.logs ?? [];

  return (
    <div className="space-y-2">
      <p className="text-2xs text-muted px-1">{entries.length} log entries</p>
      <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
        <div className="font-mono text-2xs divide-y divide-primary">
          {entries.length === 0 ? (
            <p className="text-muted text-center py-8">No log entries</p>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className={`flex gap-3 px-3 py-1.5 ${entry.level === "error" ? "bg-red-500/5 text-red-400" : "text-muted hover:text-primary"}`}>
                <span className="shrink-0 text-muted/60">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className={`shrink-0 uppercase font-semibold ${entry.level === "error" ? "text-red-400" : "text-emerald-500/70"}`}>{entry.level}</span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function HooksTab({ hooks }: { hooks: ReturnType<typeof useAvailableHooks> }) {
  if (hooks.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
        </div>
      </div>
    );
  }

  const hookRecord = hooks.data?.hooks;
  if (!hookRecord || Object.keys(hookRecord).length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted text-center py-12">No lifecycle hooks available</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-2xs text-muted px-1">{Object.keys(hookRecord).length} lifecycle hooks available</p>
      {Object.entries(hookRecord).map(([hookName, hookInfo]) => (
        <div
          key={hookName}
          className="flex items-start gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl hover:border-violet-500/30 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-violet-500/60 shrink-0 mt-1.5" />
          <div className="min-w-0">
            <div className="text-sm font-mono font-medium text-primary">{hookInfo.displayName || hookName}</div>
            {hookInfo.description && <div className="text-2xs text-muted mt-0.5">{hookInfo.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
