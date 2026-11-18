import { Cpu, Search } from "lucide-react";
import { useMemo } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { type FilterTabDefinition, useFilterTabs } from "../../hooks/useFilterTabs.ts";
import { resolveProviderBrand } from "../../lib/providerBrand.ts";
import { cn } from "../../lib/utils.ts";
import type { useChatModelsByProvider } from "../../rpc.ts";
import { type ModelFilter, type ModelInfo, ServicesEmptyActions } from "./servicesShared.tsx";

type ModelListQuery = Pick<ReturnType<typeof useChatModelsByProvider>, "data" | "error" | "isLoading" | "mutate">;

const MODEL_FILTER_TAB_DEFS: FilterTabDefinition<ModelInfo, ModelFilter>[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available", predicate: m => m.available },
  { id: "unavailable", label: "Unavailable", predicate: m => !m.available },
];

export default function ModelsTab({
  models,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
}: {
  models: ReturnType<typeof useChatModelsByProvider>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: ModelFilter;
  onFilterChange: (f: ModelFilter) => void;
}) {
  const providerMap = models.data?.modelsByProvider;

  const allModels = useMemo(() => {
    const list: ModelInfo[] = [];
    for (const record of Object.values(providerMap ?? {})) {
      for (const info of Object.values(record)) {
        list.push(info);
      }
    }
    return list;
  }, [providerMap]);

  const { tabs: filterOptions } = useFilterTabs(allModels, MODEL_FILTER_TAB_DEFS);

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result: { provider: string; models: [string, ModelInfo][] }[] = [];
    for (const [provider, record] of Object.entries(providerMap ?? {})) {
      const modelsList = Object.entries(record)
        .filter(([modelId, info]) => {
          if (filter === "available" && !info.available) return false;
          if (filter === "unavailable" && info.available) return false;
          if (!q) return true;
          return modelId.toLowerCase().includes(q) || provider.toLowerCase().includes(q) || info.status.toLowerCase().includes(q);
        })
        .sort(([a], [b]) => a.localeCompare(b));
      if (modelsList.length > 0) {
        result.push({ provider, models: modelsList });
      }
    }
    result.sort((a, b) => a.provider.localeCompare(b.provider));
    return result;
  }, [providerMap, searchQuery, filter]);

  if (models.isLoading && !providerMap) {
    return <LoadingState message="Loading models…" className="py-16" />;
  }

  if (models.error) {
    return <ErrorState title="Failed to load models" error={models.error} onRetry={() => void models.mutate()} variant="inline" className="py-6" />;
  }

  if (!providerMap || allModels.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Cpu}
        title="No models available"
        hint="Models are the AI providers' chat models agents think with. Add a provider and its API key in Configuration to register them."
        action={<ServicesEmptyActions />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(opt => (
            <button
              type="button"
              key={opt.id}
              onClick={() => onFilterChange(opt.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-ring",
                filter === opt.id
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40"
                  : "bg-secondary text-muted border-primary hover:text-primary",
              )}
            >
              {opt.label}
              <span className="ml-1 font-mono">{opt.count}</span>
            </button>
          ))}
        </div>
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Filter models…" aria-label="Filter models" className="w-full max-w-xs" />
      </div>

      {filteredProviders.length === 0 ? (
        <EmptyState variant="card" icon={Search} title="No models match the current filters" />
      ) : (
        <div className="space-y-3">
          {filteredProviders.map(({ provider, models: modelList }) => {
            const brand = resolveProviderBrand(provider, modelList[0]?.[0]);
            const ProviderIcon = brand.icon;
            return (
              <div key={provider} className="bg-secondary border border-primary rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-tertiary/50 border-b border-primary flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5 capitalize">
                    <span className={brand.color}>
                      <ProviderIcon className="w-3.5 h-3.5" />
                    </span>
                    {provider}
                  </span>
                  <span className="text-xs text-muted">{modelList.length} models</span>
                </div>
                <div className="p-2 space-y-0.5">
                  {modelList.map(([modelId, modelInfo]) => (
                    <div key={modelId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover transition-colors">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", modelInfo.available ? "bg-emerald-500/70" : "bg-muted/50")} />
                      <span className="text-xs font-mono text-primary truncate" title={modelId}>
                        {modelId.split("/").pop()}
                      </span>
                      <span className="text-xs text-muted ml-auto shrink-0">{modelInfo.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Read-only provider groups for a non-chat model kind (embedding, transcription, reranking). */
export function ModelKindList({ title, models }: { title: string; models: ModelListQuery }) {
  const providerMap = models.data?.modelsByProvider;
  const groups = useMemo(() => {
    const result: { provider: string; models: [string, ModelInfo][] }[] = [];
    for (const [provider, record] of Object.entries(providerMap ?? {})) {
      const modelList = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
      if (modelList.length > 0) result.push({ provider, models: modelList });
    }
    result.sort((a, b) => a.provider.localeCompare(b.provider));
    return result;
  }, [providerMap]);
  const noun = title.toLowerCase();

  return (
    <section className="space-y-3" aria-label={`${title} models`}>
      <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">{title}</h2>
      {models.isLoading && !providerMap ? <LoadingState message={`Loading ${noun} models…`} className="py-8" /> : null}
      {models.error ? (
        <ErrorState title={`Failed to load ${noun} models`} error={models.error} onRetry={() => void models.mutate()} variant="inline" className="py-3" />
      ) : null}
      {!models.isLoading && !models.error && groups.length === 0 ? <p className="text-xs text-muted px-1">No {noun} models.</p> : null}
      {groups.length > 0 ? (
        <div className="space-y-3">
          {groups.map(({ provider, models: modelList }) => {
            const brand = resolveProviderBrand(provider, modelList[0]?.[0]);
            const ProviderIcon = brand.icon;
            return (
              <div key={provider} className="bg-secondary border border-primary rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-tertiary/50 border-b border-primary flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5 capitalize">
                    <span className={brand.color}>
                      <ProviderIcon className="w-3.5 h-3.5" />
                    </span>
                    {provider}
                  </span>
                  <span className="text-xs text-muted">{modelList.length} models</span>
                </div>
                <div className="p-2 space-y-0.5">
                  {modelList.map(([modelId, modelInfo]) => (
                    <div key={modelId} className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", modelInfo.available ? "bg-emerald-500/70" : "bg-muted/50")} />
                      <span className="text-xs font-mono text-primary truncate" title={modelId}>
                        {modelId.split("/").pop()}
                      </span>
                      <span className="text-xs text-muted ml-auto shrink-0">{modelInfo.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
