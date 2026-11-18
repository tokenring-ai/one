import { useState } from "react";
import ViewShell from "../../components/ui/ViewShell.tsx";
import AgentModelPicker from "../../features/services/AgentModelPicker.tsx";
import ModelsTab, { ModelKindList } from "../../features/services/ModelsTab.tsx";
import { AgentContextBar, type ModelFilter } from "../../features/services/servicesShared.tsx";
import { useServicesAgent } from "../../features/services/useServicesAgent.ts";
import { useChatModelsByProvider, useEmbeddingModelsByProvider, useRerankingModelsByProvider, useTranscriptionModelsByProvider } from "../../rpc.ts";

/**
 * Which models each configured provider offers, whether they are reachable,
 * and which chat model the selected agent thinks with.
 */
export default function ServicesModelsView() {
  const { agents, selectedAgentId, selectAgent } = useServicesAgent();
  const modelsByProvider = useChatModelsByProvider();
  const embeddingModels = useEmbeddingModelsByProvider();
  const transcriptionModels = useTranscriptionModelsByProvider();
  const rerankingModels = useRerankingModelsByProvider();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ModelFilter>("all");

  return (
    <ViewShell pad="page">
      <AgentContextBar agents={agents} selectedAgentId={selectedAgentId} onSelect={selectAgent} />
      {selectedAgentId ? <AgentModelPicker agentId={selectedAgentId} onAgentGone={() => void agents.mutate()} /> : null}
      <div className="space-y-8">
        <section className="space-y-3" aria-label="Chat models">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest px-1">Chat</h2>
          <ModelsTab models={modelsByProvider} searchQuery={searchQuery} onSearchChange={setSearchQuery} filter={filter} onFilterChange={setFilter} />
        </section>
        <ModelKindList title="Embedding" models={embeddingModels} />
        <ModelKindList title="Transcription" models={transcriptionModels} />
        <ModelKindList title="Reranking" models={rerankingModels} />
      </div>
    </ViewShell>
  );
}
