import formatError from "@tokenring-ai/utility/error/formatError";
import { FolderOpen, Loader2, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { researchRPCClient, useAgentList } from "../../rpc.ts";

function formatModifiedAt(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
}

export default function ResearchApp() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [researchDirectory, setResearchDirectory] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ name: string; path: string; modifiedAt: number }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const researchAgents = useMemo(() => (agents.data ?? []).filter(agent => agent.agentType === "research"), [agents.data]);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const [config, list] = await Promise.all([researchRPCClient.getResearchConfig({}), researchRPCClient.listResearchProjects({})]);
      setResearchDirectory(config.researchDirectory);
      setProjects(list.projects);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 4000 });
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const startResearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      toastManager.warning("Enter something to research", { duration: 2500 });
      return;
    }

    setSubmitting(true);
    try {
      const { agentId } = await researchRPCClient.startResearch({ query: trimmed });
      await agents.mutate();
      void refreshProjects();
      void navigate(`/agent/${agentId}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Research"
        subtitle="Deep multi-file research with web search, todos, and markdown dossiers"
        icon={<Search className="w-4 h-4" />}
        iconGradient="from-indigo-500 to-violet-600"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Start research */}
          <div className="bg-secondary border border-primary rounded-xl p-6 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-primary">Start deep research</h2>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  Describe a topic or goal. A research agent will search the web, plan with todos, and write SUMMARY.md, TOC.md, and topic deep-dives under your
                  research directory.
                </p>
              </div>
            </div>

            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void startResearch();
                }
              }}
              rows={4}
              placeholder="e.g. Solid-state battery commercialization timeline 2024–2026"
              className="w-full bg-input border border-primary rounded-xl px-3 py-2.5 text-sm text-primary placeholder-muted focus-accent resize-y min-h-[96px]"
              aria-label="Research query"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              {researchDirectory ? (
                <p className="text-2xs text-muted font-mono truncate max-w-full" title={researchDirectory}>
                  Output: {researchDirectory}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void startResearch()}
                disabled={submitting || !query.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary"
                aria-label="Start research"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" /> Start research
                  </>
                )}
              </button>
            </div>
            <p className="text-2xs text-muted">⌘/Ctrl + Enter to submit</p>
          </div>

          {/* Running research agents */}
          {researchAgents.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest px-1">Active research sessions</p>
              <div className="space-y-2">
                {researchAgents.map(agent => (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => navigate(`/agent/${agent.id}`)}
                    className="w-full flex items-center gap-3 bg-secondary border border-indigo-500/30 px-3 py-2.5 rounded-xl text-left hover:bg-hover hover:border-indigo-500/60 transition-all cursor-pointer focus-ring shadow-sm"
                    aria-label={`Open ${agent.displayName}`}
                  >
                    <div className="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                      <div className="text-2xs text-muted truncate mt-0.5">{agent.currentActivity}</div>
                    </div>
                    <div className="text-2xs text-muted">Open →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Past projects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-2xs font-bold text-muted uppercase tracking-widest">Past research projects</p>
              <button
                type="button"
                onClick={() => void refreshProjects()}
                className="text-2xs text-muted hover:text-primary transition-colors cursor-pointer focus-ring rounded"
              >
                Refresh
              </button>
            </div>

            {projectsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="px-4 py-8 bg-secondary border border-primary border-dashed rounded-xl text-center">
                <FolderOpen className="w-7 h-7 text-muted mx-auto mb-2" />
                <p className="text-sm text-secondary">No research projects yet</p>
                <p className="text-2xs text-muted mt-1">Completed dossiers will appear here as subdirectories</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {projects.map(project => (
                  <div key={project.path} className="flex items-center gap-3 bg-secondary border border-primary px-3 py-2.5 rounded-xl">
                    <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">{project.name}</div>
                      <div className="text-2xs text-muted truncate mt-0.5 font-mono" title={project.path}>
                        {project.path}
                      </div>
                    </div>
                    <div className="text-2xs text-muted shrink-0">{formatModifiedAt(project.modifiedAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
