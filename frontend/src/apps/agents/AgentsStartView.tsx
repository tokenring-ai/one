import { Cpu, Plus, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LaunchButton from "../../components/ui/LaunchButton.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { usePaneLink } from "../../layout/hooks.ts";
import { PaneLink } from "../../layout/links.tsx";
import { agentCountSummary } from "../../lib/agentSessions.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import Button from "../../ui/button.tsx";
import TextField from "../../ui/text-field.tsx";
import {
  AGENT_TYPE_CREATE_VIEW,
  AGENT_TYPE_DETAIL_VIEW,
  type AgentType,
  MARKETPLACE_PATH,
  matchesTypeFilter,
  SourceDot,
  sourceOf,
  typeName,
  UNCATEGORIZED,
} from "./shared.tsx";
import { useAgentActions } from "./useAgentActions.ts";

const linkClass = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-hover hover:text-fg focus-ring";

function TypeCard({
  agentType,
  liveSummary,
  launching,
  onStart,
}: {
  agentType: AgentType;
  liveSummary: string | null;
  launching: boolean;
  onStart: () => void;
}) {
  const name = typeName(agentType);
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-raised px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <PaneLink
          view={AGENT_TYPE_DETAIL_VIEW}
          params={{ agentType: agentType.type }}
          className="min-w-0 flex-1 rounded text-left focus-ring hover:underline"
          title={`View or edit ${name}`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-fg">{name}</span>
            <SourceDot source={sourceOf(agentType)} />
          </span>
        </PaneLink>
        <LaunchButton
          loading={launching}
          onClick={onStart}
          label="Launch"
          loadingLabel="Launching…"
          aria-label={`Launch ${name}`}
          title={`Launch a new ${name}`}
          className="shrink-0"
        />
      </div>
      <p className="line-clamp-2 min-w-0 text-xs leading-relaxed text-muted">{agentType.description || "No description provided."}</p>
      {liveSummary && <p className="text-[11px] text-muted">{liveSummary}</p>}
    </li>
  );
}

/**
 * The Agents app's landing page (`/agents`): pick an agent type and start it.
 * It is a landing view, so it gives way to the chat as soon as one opens.
 * Running agents live in the sidebar; community agents in the Marketplace app.
 */
export default function AgentsStartView() {
  const openPane = usePaneLink();
  const openCreate = () => openPane(AGENT_TYPE_CREATE_VIEW);
  const { agentTypes, agentList, agentTypeList, launch, launchingType, ConfirmDialog } = useAgentActions();
  const [query, setQuery] = useState("");

  // "1 working · 2 idle", in the same words as the agent rows and the top bar.
  const liveSummaryByType = useMemo(() => {
    const byType = new Map<string, typeof agentList>();
    for (const agent of agentList) byType.set(agent.agentType, [...(byType.get(agent.agentType) ?? []), agent]);
    return new Map([...byType].map(([type, agents]) => [type, agentCountSummary(agents)]));
  }, [agentList]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, AgentType[]>();
    for (const agentType of agentTypeList) {
      if (!matchesTypeFilter(agentType, query)) continue;
      const category = agentType.category || UNCATEGORIZED;
      byCategory.set(category, [...(byCategory.get(category) ?? []), agentType]);
    }
    return [...byCategory.entries()];
  }, [agentTypeList, query]);

  const marketplaceLink = (
    <Link to={MARKETPLACE_PATH} className={linkClass}>
      <Store className="h-3.5 w-3.5" aria-hidden="true" /> Browse marketplace
    </Link>
  );

  return (
    <ViewShell
      pad="page"
      width="prose"
      header={
        <ViewHeader title="Launch an agent">
          {marketplaceLink}
          <Button variant="secondary" icon={Plus} onClick={openCreate}>
            New agent type
          </Button>
        </ViewHeader>
      }
    >
      {agentTypes.isLoading && agentTypeList.length === 0 ? (
        <LoadingState className="py-10" />
      ) : agentTypes.error && agentTypeList.length === 0 ? (
        <ErrorState title="Failed to load agent types" error={agentTypes.error} onRetry={() => void agentTypes.mutate()} variant="page" className="py-8" />
      ) : agentTypeList.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Cpu}
          title="No agent types yet"
          hint="Write one yourself, or install one from the marketplace."
          ctaLabel="New agent type"
          onCta={openCreate}
          action={marketplaceLink}
        />
      ) : (
        <div className="space-y-5">
          <TextField
            value={query}
            onChange={setQuery}
            placeholder="Find an agent type…"
            aria-label="Find an agent type"
            leading={<Search className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
            autoFocus
          />
          {groups.length === 0 ? (
            <EmptyState title={`No agent types match “${query.trim()}”`} variant="inline" />
          ) : (
            groups.map(([category, types]) => (
              <section key={category} aria-label={category} className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">{category}</h2>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {types.map(agentType => (
                    <TypeCard
                      key={agentType.type}
                      agentType={agentType}
                      liveSummary={liveSummaryByType.get(agentType.type) ?? null}
                      launching={launchingType === agentType.type}
                      onStart={() => toastOnReject(launch(agentType.type))}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
      <ConfirmDialog />
    </ViewShell>
  );
}
