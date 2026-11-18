import { Cpu, Plus, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { usePaneLink } from "../../layout/hooks.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { AGENT_TYPE_CREATE_VIEW, type AgentType, MARKETPLACE_PATH, matchesTypeFilter, SourceDot, sourceOf, typeName, UNCATEGORIZED } from "./shared.tsx";
import { useAgentActions } from "./useAgentActions.ts";

const footerLink = "inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted hover:bg-hover hover:text-fg focus-ring cursor-pointer";

/**
 * The Launch tab of the Agents sidebar: every installed agent type, one click
 * to start it. The Start page in the main area has the same list with more room.
 */
export default function AgentLaunchView() {
  const openPane = usePaneLink();
  const { agentTypes, agentTypeList, launch, launchingType } = useAgentActions();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const byCategory = new Map<string, AgentType[]>();
    for (const agentType of agentTypeList) {
      if (!matchesTypeFilter(agentType, query)) continue;
      const category = agentType.category || UNCATEGORIZED;
      byCategory.set(category, [...(byCategory.get(category) ?? []), agentType]);
    }
    return [...byCategory.entries()];
  }, [agentTypeList, query]);

  const footer = (
    <div className="flex flex-wrap items-center gap-1 border-t border-line-subtle px-1.5 py-1.5">
      <Link to={MARKETPLACE_PATH} className={footerLink}>
        <Store className="h-3.5 w-3.5" aria-hidden="true" /> Marketplace
      </Link>
      <button type="button" onClick={() => openPane(AGENT_TYPE_CREATE_VIEW)} className={footerLink}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New agent type
      </button>
    </div>
  );

  return (
    <ViewShell tone="sidebar" scroll={false}>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {agentTypes.isLoading && agentTypeList.length === 0 ? (
            <LoadingState size="sm" className="py-6" />
          ) : agentTypes.error && agentTypeList.length === 0 ? (
            <ErrorState title="Failed to load agent types" error={agentTypes.error} onRetry={() => void agentTypes.mutate()} variant="inline" />
          ) : agentTypeList.length === 0 ? (
            <EmptyState icon={Cpu} title="No agent types yet" hint="Write one, or install one from the marketplace." variant="inline" />
          ) : (
            <>
              {agentTypeList.length > 6 && (
                <div className="mx-2 my-1.5 flex items-center gap-1.5 rounded-md border border-control bg-tertiary px-2 py-1">
                  <Search className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Find an agent type…"
                    aria-label="Find an agent type"
                    className="w-full min-w-0 bg-transparent text-xs text-primary placeholder-muted outline-none"
                  />
                </div>
              )}
              {groups.length === 0 ? (
                <EmptyState title={`No agent types match “${query.trim()}”`} variant="inline" />
              ) : (
                groups.map(([category, types]) => (
                  <section key={category} aria-label={category} className="pb-1">
                    <h3 className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{category}</h3>
                    <ul>
                      {types.map(agentType => {
                        const name = typeName(agentType);
                        const launching = launchingType === agentType.type;
                        return (
                          <li key={agentType.type}>
                            <button
                              type="button"
                              onClick={() => toastOnReject(launch(agentType.type))}
                              disabled={launching}
                              aria-label={`Launch ${name}`}
                              title={agentType.description || `Launch a new ${name}`}
                              className="group mx-1.5 flex w-[calc(100%-0.75rem)] min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover focus-ring cursor-pointer disabled:cursor-wait"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-sm text-secondary group-hover:text-fg">{name}</span>
                                  <SourceDot source={sourceOf(agentType)} />
                                </span>
                                {agentType.description && <span className="block truncate text-xs text-muted">{agentType.description}</span>}
                              </span>
                              {launching ? (
                                <BusySpinner className="mt-1 h-3.5 w-3.5" />
                              ) : (
                                <span className="mt-0.5 shrink-0 text-xs font-medium text-accent-soft opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                                  Launch
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </>
          )}
        </div>
        {footer}
      </div>
    </ViewShell>
  );
}
