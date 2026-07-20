import formatError from "@tokenring-ai/utility/error/formatError";
import { Download, Loader2, Play, Power, PowerOff, RefreshCw, RotateCcw, Search, Sparkles, Trash2, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, skillsRPCClient, useAgentList, useAgentTypes, useSkills } from "../../rpc.ts";

export default function SkillsDashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zipUrl, setZipUrl] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);

  useEffect(() => {
    const list = agents.data ?? [];
    if (list.length === 0) {
      setSelectedAgentId(null);
      return;
    }
    if (!selectedAgentId || !list.some(a => a.id === selectedAgentId)) {
      setSelectedAgentId(list[0]!.id);
    }
  }, [agents.data, selectedAgentId]);

  const skillsQuery = useSkills(selectedAgentId ?? undefined);

  const skills = useMemo(() => {
    if (skillsQuery.data?.status !== "success") return [];
    return skillsQuery.data.skills;
  }, [skillsQuery.data]);

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const query = searchQuery.toLowerCase();
    return skills.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query) || s.slug.toLowerCase().includes(query));
  }, [skills, searchQuery]);

  const enabledCount = skills.filter(s => s.enabled).length;

  const refresh = async () => {
    await Promise.all([skillsQuery.mutate(), agents.mutate()]);
  };

  const ensureAgent = async (): Promise<string | null> => {
    if (selectedAgentId) return selectedAgentId;
    setCreatingAgent(true);
    try {
      const types = agentTypes.data ?? (await agentRPCClient.getAgentTypes({}));
      const preferred = types.find(t => t.type === "code") ?? types.find(t => t.category?.toLowerCase().includes("interactive")) ?? types[0];
      if (!preferred) {
        toastManager.error("No agent types available", { duration: 4000 });
        return null;
      }
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      await agents.mutate();
      setSelectedAgentId(id);
      toastManager.success(`Created agent for skills (${preferred.displayName})`, { duration: 3000 });
      return id;
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
      return null;
    } finally {
      setCreatingAgent(false);
    }
  };

  const handleDownload = async () => {
    const url = zipUrl.trim();
    if (!url) {
      toastManager.warning("Enter a zip URL to download a skill", { duration: 3000 });
      return;
    }
    const agentId = await ensureAgent();
    if (!agentId) return;
    setBusyAction("download");
    try {
      const result = await skillsRPCClient.downloadSkill({ agentId, zipUrl: url });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      toastManager.success(`Installed skill "${result.skill.name}"`, { duration: 3000 });
      setZipUrl("");
      await skillsQuery.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggle = async (name: string, currentlyEnabled: boolean) => {
    if (!selectedAgentId) {
      toastManager.warning("Select or create an agent first", { duration: 3000 });
      return;
    }
    setBusyAction(`toggle:${name}`);
    try {
      const result = currentlyEnabled
        ? await skillsRPCClient.disableSkill({ agentId: selectedAgentId, name })
        : await skillsRPCClient.enableSkill({ agentId: selectedAgentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      await skillsQuery.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = async (name: string) => {
    if (!selectedAgentId) return;
    setBusyAction(`reset:${name}`);
    try {
      const result = await skillsRPCClient.resetSkill({ agentId: selectedAgentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      toastManager.success(`Reset skill "${name}"`, { duration: 3000 });
      await skillsQuery.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgentId || !confirmDelete) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    setBusyAction(`delete:${name}`);
    try {
      const result = await skillsRPCClient.deleteSkill({ agentId: selectedAgentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        return;
      }
      toastManager.success(`Deleted skill "${name}"`, { duration: 3000 });
      await skillsQuery.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTry = async (name: string) => {
    const agentId = selectedAgentId ?? (await ensureAgent());
    if (!agentId) return;
    try {
      await agentRPCClient.sendInput({
        agentId,
        input: {
          from: "Skills dashboard",
          message: `/${name}`,
        },
      });
      toastManager.success(`Running /${name}`, { duration: 2500 });
      void navigate(`/agent/${agentId}`);
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  };

  const selectedAgent = agents.data?.find(a => a.id === selectedAgentId);

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      <AppPageHeader
        title="Skills"
        subtitle="Install, enable, and try agent skills"
        icon={<Sparkles className="w-4 h-4" />}
        iconGradient="from-violet-500 to-fuchsia-600"
      >
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={skillsQuery.isLoading || busyAction !== null}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary hover:bg-hover border border-primary transition-colors focus-ring disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", skillsQuery.isLoading && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Agent context + stats */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-2xs font-bold text-muted uppercase tracking-widest">
                <User className="w-3 h-3" />
                Agent context
              </span>
              {agents.isLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
              ) : (agents.data?.length ?? 0) === 0 ? (
                <button
                  type="button"
                  onClick={() => void ensureAgent()}
                  disabled={creatingAgent}
                  className="text-xs px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-colors focus-ring disabled:opacity-50"
                >
                  {creatingAgent ? "Creating…" : "Create agent"}
                </button>
              ) : (
                <select
                  value={selectedAgentId ?? ""}
                  onChange={e => setSelectedAgentId(e.target.value || null)}
                  className="text-xs bg-input border border-primary rounded-md px-2 py-1.5 text-primary focus-ring max-w-56"
                  aria-label="Select agent for skill enablement"
                >
                  {(agents.data ?? []).map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName || agent.agentType || agent.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )}
              {selectedAgent && (
                <button
                  type="button"
                  onClick={() => void navigate(`/agent/${selectedAgent.id}`)}
                  className="text-2xs text-muted hover:text-primary underline-offset-2 hover:underline focus-ring rounded"
                >
                  Open chat
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">{skills.length} installed</span>
              {selectedAgentId && (
                <span className="text-2xs px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 rounded-full">
                  {enabledCount} enabled
                </span>
              )}
            </div>
          </div>

          {/* Install skill */}
          <section>
            <p className="text-2xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Install skill</p>
            <div className="flex flex-col sm:flex-row gap-2 p-4 bg-secondary border border-primary rounded-xl">
              <div className="relative flex-1">
                <Download className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="url"
                  value={zipUrl}
                  onChange={e => setZipUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void handleDownload();
                  }}
                  placeholder="https://example.com/my-skill.zip"
                  className="w-full bg-input border border-primary rounded-md py-2 pl-10 pr-3 text-sm text-primary placeholder-muted focus-ring"
                  aria-label="Skill zip URL"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busyAction === "download" || !zipUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {busyAction === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </button>
            </div>
            <p className="text-2xs text-muted mt-2 px-1">
              Skills are zip archives containing a <code className="font-mono text-secondary">SKILL.md</code> file. Installed skills register as{" "}
              <code className="font-mono text-secondary">/skill-name</code> commands when invocable.
            </p>
          </section>

          {/* Installed list */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-3 px-1">
              <p className="text-2xs font-bold text-muted uppercase tracking-widest">Installed</p>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter skills…"
                  className="w-full bg-input border border-primary rounded-md py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus-ring"
                />
              </div>
            </div>

            {skillsQuery.isLoading && skills.length === 0 ? (
              <LoadingState message="Loading skills…" className="py-16" />
            ) : skillsQuery.error ? (
              <ErrorState title="Failed to load skills" error={skillsQuery.error} onRetry={() => void skillsQuery.mutate()} variant="inline" className="py-6" />
            ) : filteredSkills.length === 0 ? (
              <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
                <Sparkles className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-secondary mb-1">{searchQuery ? "No matching skills" : "No skills installed"}</p>
                <p className="text-2xs text-muted max-w-sm mx-auto">
                  {searchQuery ? `Nothing matches “${searchQuery}”.` : "Download a skill zip above, or use /skills download <url> in chat."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredSkills.map(skill => {
                  const isBusy = busyAction === `toggle:${skill.name}` || busyAction === `reset:${skill.name}` || busyAction === `delete:${skill.name}`;
                  return (
                    <div
                      key={skill.slug || skill.name}
                      className="flex items-start gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl hover:border-accent-muted transition-colors group"
                    >
                      <div
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-sm",
                          skill.enabled ? "bg-linear-to-br from-violet-500 to-fuchsia-600" : "bg-tertiary border border-primary",
                        )}
                      >
                        <Sparkles className={cn("w-4 h-4", skill.enabled ? "text-white" : "text-muted")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-primary font-mono truncate">/{skill.name}</span>
                          {skill.enabled ? (
                            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">enabled</span>
                          ) : (
                            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-tertiary text-muted">disabled</span>
                          )}
                          {skill.context === "fork" && (
                            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">fork</span>
                          )}
                          {skill.userInvocable === false && <span className="text-2xs px-1.5 py-0.5 rounded-full bg-tertiary text-muted">internal</span>}
                        </div>
                        <p className="text-2xs text-muted line-clamp-2 mb-1">{skill.description}</p>
                        {skill.argumentHint && <p className="text-2xs text-dim font-mono">args: {skill.argumentHint}</p>}
                        {skill.sourceUrl && (
                          <p className="text-2xs text-dim font-mono truncate mt-0.5" title={skill.sourceUrl}>
                            {skill.sourceUrl}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {skill.userInvocable !== false && (
                          <button
                            type="button"
                            title="Try skill"
                            aria-label={`Try ${skill.name}`}
                            disabled={isBusy}
                            onClick={() => void handleTry(skill.name)}
                            className="p-1.5 rounded-md text-muted hover:text-violet-500 hover:bg-violet-500/10 transition-colors focus-ring disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title={skill.enabled ? "Disable" : "Enable"}
                          aria-label={skill.enabled ? `Disable ${skill.name}` : `Enable ${skill.name}`}
                          disabled={isBusy || !selectedAgentId}
                          onClick={() => void handleToggle(skill.name, skill.enabled)}
                          className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                        >
                          {skill.enabled ? <Power className="w-3.5 h-3.5 text-violet-500" /> : <PowerOff className="w-3.5 h-3.5" />}
                        </button>
                        {skill.sourceUrl && (
                          <button
                            type="button"
                            title="Reset from source"
                            aria-label={`Reset ${skill.name}`}
                            disabled={isBusy || !selectedAgentId}
                            onClick={() => void handleReset(skill.name)}
                            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete skill"
                          aria-label={`Delete ${skill.name}`}
                          disabled={isBusy || !selectedAgentId}
                          onClick={() => setConfirmDelete(skill.name)}
                          className="p-1.5 rounded-md text-muted hover:text-error hover:bg-error/10 transition-colors focus-ring disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete skill"
          message={`Permanently remove the skill “${confirmDelete}” from this workspace? This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
