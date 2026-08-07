import formatError from "@tokenring-ai/utility/error/formatError";
import { FocusTrap } from "focus-trap-react";
import { Download, Loader2, Play, Power, PowerOff, RefreshCw, RotateCcw, Search, Sparkles, Trash2, User, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, skillsRPCClient, useAgentList, useAgentTypes, useEnabledSkills, useSkills } from "../../rpc.ts";

type StatusFilter = "all" | "enabled" | "disabled";

type SkillRow = {
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
  sourceUrl?: string | undefined;
  userInvocable?: boolean | undefined;
  argumentHint?: string | undefined;
  context?: string | undefined;
  agent?: string | undefined;
};

type TrySkillState = {
  name: string;
  argumentHint?: string | undefined;
  args: string;
};

function TrySkillDialog({
  skill,
  busy,
  onChangeArgs,
  onConfirm,
  onCancel,
}: {
  skill: TrySkillState;
  busy: boolean;
  onChangeArgs: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const requestClose = () => {
    if (!busy) onCancel();
  };

  return (
    <FocusTrap>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="try-skill-title"
        onKeyDown={e => {
          if (e.key === "Escape") {
            e.preventDefault();
            requestClose();
          }
        }}
      >
        <div className="bg-secondary border border-primary rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-4 border-b border-primary">
            <h3 id="try-skill-title" className="text-lg font-semibold text-primary font-mono">
              Try /{skill.name}
            </h3>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="p-1.5 text-muted hover:text-primary transition-colors focus-ring cursor-pointer rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-secondary">Runs the skill on the selected agent and opens chat. Disabled skills are enabled automatically first.</p>
            <div>
              <label htmlFor="try-skill-args" className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
                Arguments {skill.argumentHint ? <span className="font-mono normal-case tracking-normal">({skill.argumentHint})</span> : "(optional)"}
              </label>
              <input
                id="try-skill-args"
                type="text"
                value={skill.args}
                onChange={e => onChangeArgs(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !busy) {
                    e.preventDefault();
                    onConfirm();
                  }
                }}
                disabled={busy}
                placeholder={skill.argumentHint || "Optional prompt / args"}
                className="w-full bg-input border border-primary rounded-md py-2 px-3 text-sm text-primary placeholder-muted focus-ring disabled:opacity-50"
                autoFocus
              />
            </div>
          </div>
          <div className="flex gap-3 px-4 pb-4">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-tertiary hover:bg-hover text-primary rounded-md border border-primary transition-colors focus-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-md shadow-lg transition-colors active:scale-[0.98] focus-ring disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run skill
            </button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

export default function SkillsDashboard() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [zipUrl, setZipUrl] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [trySkill, setTrySkill] = useState<TrySkillState | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const busyActionRef = useRef<string | null>(null);

  // Derive agent id synchronously so skills fetch the correct agent-scoped list on the same
  // render that agents become available (avoids a flash of the global all-disabled list).
  const effectiveAgentId = useMemo(() => {
    const list = agents.data ?? [];
    if (list.length === 0) return null;
    if (selectedAgentId && list.some(a => a.id === selectedAgentId)) return selectedAgentId;
    return list[0]!.id;
  }, [agents.data, selectedAgentId]);

  useEffect(() => {
    if (effectiveAgentId !== selectedAgentId) {
      setSelectedAgentId(effectiveAgentId);
    }
  }, [effectiveAgentId, selectedAgentId]);

  const skillsQuery = useSkills(effectiveAgentId ?? undefined);
  const enabledSkillsStream = useEnabledSkills(effectiveAgentId ?? "");

  // Keep latest mutators in refs so async handlers that create an agent mid-flight
  // refresh the post-create SWR/stream keys instead of the pre-create ones.
  const skillsMutateRef = useRef(skillsQuery.mutate);
  skillsMutateRef.current = skillsQuery.mutate;
  const enabledMutateRef = useRef(enabledSkillsStream.mutate);
  enabledMutateRef.current = enabledSkillsStream.mutate;
  const agentsMutateRef = useRef(agents.mutate);
  agentsMutateRef.current = agents.mutate;

  const refreshSkills = async () => {
    await Promise.all([skillsMutateRef.current(), enabledMutateRef.current()]);
  };

  const agentsReady = !agents.isLoading;
  const enabledFromStream = useMemo(() => {
    if (enabledSkillsStream.data?.status !== "success") return null;
    return new Set(enabledSkillsStream.data.skills);
  }, [enabledSkillsStream.data]);

  const skills = useMemo<SkillRow[]>(() => {
    // While agents load, suppress the agent-less global list (every skill forced disabled).
    if (!agentsReady) return [];
    if (skillsQuery.data?.status !== "success") return [];
    return skillsQuery.data.skills.map(skill => ({
      ...skill,
      enabled: enabledFromStream ? enabledFromStream.has(skill.name) : skill.enabled,
    }));
  }, [agentsReady, skillsQuery.data, enabledFromStream]);

  const enabledCount = skills.filter(s => s.enabled).length;
  const disabledCount = skills.length - enabledCount;

  const statusTabs = useMemo<FilterTabOption<StatusFilter>[]>(
    () => [
      { id: "all", label: "All", count: skills.length },
      { id: "enabled", label: "Enabled", count: enabledCount },
      { id: "disabled", label: "Disabled", count: disabledCount },
    ],
    [skills.length, enabledCount, disabledCount],
  );

  const filteredSkills = useMemo(() => {
    let list = skills;
    if (statusFilter === "enabled") list = list.filter(s => s.enabled);
    else if (statusFilter === "disabled") list = list.filter(s => !s.enabled);

    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query) || s.slug.toLowerCase().includes(query));
  }, [skills, searchQuery, statusFilter]);

  const refresh = async () => {
    await Promise.all([refreshSkills(), agentsMutateRef.current()]);
  };

  const ensureAgent = async (): Promise<string | null> => {
    if (effectiveAgentId) return effectiveAgentId;
    setCreatingAgent(true);
    try {
      const types = agentTypes.data ?? (await agentRPCClient.getAgentTypes({}));
      const preferred = types.find(t => t.type === "code") ?? types.find(t => t.category?.toLowerCase().includes("interactive")) ?? types[0];
      if (!preferred) {
        toastManager.error("No agent types available", { duration: 4000 });
        return null;
      }
      const { id } = await agentRPCClient.createAgent({ agentType: preferred.type, headless: false });
      await agentsMutateRef.current();
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

  const beginBusy = (action: string): boolean => {
    if (busyActionRef.current !== null) return false;
    busyActionRef.current = action;
    setBusyAction(action);
    return true;
  };

  const endBusy = () => {
    busyActionRef.current = null;
    setBusyAction(null);
  };

  const handleDownload = async () => {
    const url = zipUrl.trim();
    if (!url) {
      toastManager.warning("Enter a zip URL to download a skill", { duration: 3000 });
      return;
    }
    if (busyActionRef.current !== null) return;
    const agentId = await ensureAgent();
    if (!agentId) return;
    if (!beginBusy("download")) return;
    try {
      const result = await skillsRPCClient.downloadSkill({ agentId, zipUrl: url });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        await agentsMutateRef.current();
        return;
      }
      toastManager.success(`Installed skill "${result.skill.name}"`, { duration: 3000 });
      setZipUrl("");
      await refreshSkills();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      endBusy();
    }
  };

  const handleToggle = async (name: string, currentlyEnabled: boolean) => {
    if (busyActionRef.current !== null) return;
    const agentId = effectiveAgentId ?? (await ensureAgent());
    if (!agentId) {
      toastManager.warning("Select or create an agent first", { duration: 3000 });
      return;
    }
    if (!beginBusy(`toggle:${name}`)) return;
    try {
      const result = currentlyEnabled ? await skillsRPCClient.disableSkill({ agentId, name }) : await skillsRPCClient.enableSkill({ agentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        await agentsMutateRef.current();
        return;
      }
      toastManager.success(currentlyEnabled ? `Disabled /${name}` : `Enabled /${name}`, { duration: 2500 });
      await refreshSkills();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      endBusy();
    }
  };

  const handleReset = async (name: string) => {
    if (busyActionRef.current !== null) return;
    const agentId = effectiveAgentId ?? (await ensureAgent());
    if (!agentId) return;
    if (!beginBusy(`reset:${name}`)) return;
    try {
      const result = await skillsRPCClient.resetSkill({ agentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        await agentsMutateRef.current();
        return;
      }
      toastManager.success(`Reset skill "${name}"`, { duration: 3000 });
      await refreshSkills();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      endBusy();
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete || busyActionRef.current !== null) return;
    const name = confirmDelete;
    setConfirmDelete(null);
    const agentId = effectiveAgentId ?? (await ensureAgent());
    if (!agentId) return;
    if (!beginBusy(`delete:${name}`)) return;
    try {
      const result = await skillsRPCClient.deleteSkill({ agentId, name });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        await agentsMutateRef.current();
        return;
      }
      toastManager.success(`Deleted skill "${name}"`, { duration: 3000 });
      await refreshSkills();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      endBusy();
    }
  };

  const openTrySkill = (skill: SkillRow) => {
    if (busyActionRef.current !== null) return;
    setTrySkill({
      name: skill.name,
      argumentHint: skill.argumentHint,
      args: "",
    });
  };

  const handleTryConfirm = async () => {
    if (!trySkill || busyActionRef.current !== null) return;
    const name = trySkill.name;
    const args = trySkill.args.trim();
    const agentId = effectiveAgentId ?? (await ensureAgent());
    if (!agentId) return;

    if (!beginBusy(`try:${name}`)) return;
    try {
      const skill = skills.find(s => s.name === name);
      if (skill && !skill.enabled) {
        const enableResult = await skillsRPCClient.enableSkill({ agentId, name });
        if (enableResult.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
          await agentsMutateRef.current();
          return;
        }
        await refreshSkills();
      }

      const message = args ? `/${name} ${args}` : `/${name}`;
      await agentRPCClient.sendInput({
        agentId,
        input: {
          from: "Skills dashboard",
          message,
        },
      });
      setTrySkill(null);
      toastManager.success(`Running ${message}`, { duration: 2500 });
      void navigate(`/agent/${agentId}`);
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      endBusy();
    }
  };

  const selectedAgent = agents.data?.find(a => a.id === effectiveAgentId);
  const emptyBecauseFilter = skills.length > 0 && filteredSkills.length === 0;
  const showSkillsLoading = !agentsReady || (skillsQuery.isLoading && skills.length === 0);
  // Treat as failed only when we have an error and no usable agent list (SWR may keep prior data).
  const agentsFailed = Boolean(agents.error) && (agents.data?.length ?? 0) === 0 && !agents.isLoading;

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
          disabled={showSkillsLoading || busyAction !== null}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary hover:bg-hover border border-primary transition-colors focus-ring disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (skillsQuery.isLoading || agents.isLoading) && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Agent context + stats */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-widest">
                <User className="w-3 h-3" />
                Agent context
              </span>
              {agents.isLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
              ) : agentsFailed ? (
                <button
                  type="button"
                  onClick={() => void agentsMutateRef.current()}
                  className="text-xs px-2.5 py-1 rounded-md bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors focus-ring"
                >
                  Retry loading agents
                </button>
              ) : (agents.data?.length ?? 0) === 0 ? (
                <button
                  type="button"
                  onClick={() => void ensureAgent()}
                  disabled={creatingAgent || busyAction !== null}
                  className="text-xs px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 hover:bg-violet-500/20 transition-colors focus-ring disabled:opacity-50"
                >
                  {creatingAgent ? "Creating…" : "Create agent"}
                </button>
              ) : (
                <select
                  value={effectiveAgentId ?? ""}
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
                  className="text-xs text-muted hover:text-primary underline-offset-2 hover:underline focus-ring rounded"
                >
                  Open chat
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">{skills.length} installed</span>
              {effectiveAgentId && (
                <span className="text-xs px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 rounded-full">
                  {enabledCount} enabled
                </span>
              )}
            </div>
          </div>

          {/* Install skill */}
          <section>
            <p className="text-xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Install skill</p>
            <div className="flex flex-col sm:flex-row gap-2 p-4 bg-secondary border border-primary rounded-xl">
              <div className="relative flex-1">
                <Download className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="url"
                  value={zipUrl}
                  onChange={e => setZipUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && busyActionRef.current === null) void handleDownload();
                  }}
                  placeholder="https://example.com/my-skill.zip"
                  className="w-full bg-input border border-primary rounded-md py-2 pl-10 pr-3 text-sm text-primary placeholder-muted focus-ring"
                  aria-label="Skill zip URL"
                  disabled={busyAction === "download"}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={busyAction !== null || !zipUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {busyAction === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </button>
            </div>
            <p className="text-xs text-muted mt-2 px-1">
              Skills are zip archives containing a <code className="font-mono text-secondary">SKILL.md</code> file. Installed skills register as{" "}
              <code className="font-mono text-secondary">/skill-name</code> commands when invocable.
            </p>
          </section>

          {/* Installed list */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 px-1">
              <p className="text-xs font-bold text-muted uppercase tracking-widest">Installed</p>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Escape" && searchQuery) {
                      e.preventDefault();
                      setSearchQuery("");
                    }
                  }}
                  placeholder="Filter skills…"
                  className="w-full bg-input border border-primary rounded-md py-1.5 pl-8 pr-8 text-xs text-primary placeholder-muted focus-ring"
                  aria-label="Filter skills"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
                    aria-label="Clear search"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mb-3 rounded-xl border border-primary bg-secondary overflow-hidden">
              <FilterTabs
                tabs={statusTabs}
                value={statusFilter}
                onChange={setStatusFilter}
                showZeroCounts
                className="px-1"
                activeTabClassName="border-violet-500 text-primary"
                activeCountClassName="bg-violet-500/15 text-violet-600 dark:text-violet-400"
              />
            </div>

            {showSkillsLoading ? (
              <LoadingState message="Loading skills…" className="py-16" />
            ) : agentsFailed ? (
              <ErrorState title="Failed to load agents" error={agents.error} onRetry={() => void agentsMutateRef.current()} variant="inline" className="py-6" />
            ) : skillsQuery.error ? (
              <ErrorState
                title="Failed to load skills"
                error={skillsQuery.error}
                onRetry={() => void skillsMutateRef.current()}
                variant="inline"
                className="py-6"
              />
            ) : filteredSkills.length === 0 ? (
              <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
                <Sparkles className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-secondary mb-1">{emptyBecauseFilter ? "No matching skills" : "No skills installed"}</p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {searchQuery
                    ? `Nothing matches “${searchQuery}”.`
                    : statusFilter !== "all"
                      ? `No ${statusFilter} skills for this agent.`
                      : "Download a skill zip above, or use /skills download <url> in chat."}
                </p>
                {(searchQuery || statusFilter !== "all") && skills.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="mt-3 text-xs text-violet-600 dark:text-violet-400 hover:underline focus-ring rounded"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredSkills.map(skill => {
                  const isBusy =
                    busyAction === `toggle:${skill.name}` ||
                    busyAction === `reset:${skill.name}` ||
                    busyAction === `delete:${skill.name}` ||
                    busyAction === `try:${skill.name}`;
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
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">enabled</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-tertiary text-muted">disabled</span>
                          )}
                          {skill.context === "fork" && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">fork</span>
                          )}
                          {skill.userInvocable === false && <span className="text-xs px-1.5 py-0.5 rounded-full bg-tertiary text-muted">internal</span>}
                        </div>
                        <p className="text-xs text-muted line-clamp-2 mb-1">{skill.description}</p>
                        {skill.argumentHint && <p className="text-xs text-dim font-mono">args: {skill.argumentHint}</p>}
                        {skill.sourceUrl && (
                          <p className="text-xs text-dim font-mono truncate mt-0.5" title={skill.sourceUrl}>
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
                            disabled={isBusy || busyAction !== null}
                            onClick={() => openTrySkill(skill)}
                            className="p-1.5 rounded-md text-muted hover:text-violet-500 hover:bg-violet-500/10 transition-colors focus-ring disabled:opacity-50"
                          >
                            {busyAction === `try:${skill.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          title={skill.enabled ? "Disable" : "Enable"}
                          aria-label={skill.enabled ? `Disable ${skill.name}` : `Enable ${skill.name}`}
                          disabled={isBusy || busyAction !== null}
                          onClick={() => void handleToggle(skill.name, skill.enabled)}
                          className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                        >
                          {busyAction === `toggle:${skill.name}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : skill.enabled ? (
                            <Power className="w-3.5 h-3.5 text-violet-500" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {skill.sourceUrl && (
                          <button
                            type="button"
                            title="Reset from source"
                            aria-label={`Reset ${skill.name}`}
                            disabled={isBusy || busyAction !== null}
                            onClick={() => void handleReset(skill.name)}
                            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                          >
                            {busyAction === `reset:${skill.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete skill"
                          aria-label={`Delete ${skill.name}`}
                          disabled={isBusy || busyAction !== null}
                          onClick={() => setConfirmDelete(skill.name)}
                          className="p-1.5 rounded-md text-muted hover:text-error hover:bg-error/10 transition-colors focus-ring disabled:opacity-50"
                        >
                          {busyAction === `delete:${skill.name}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {trySkill && (
        <TrySkillDialog
          skill={trySkill}
          busy={busyAction === `try:${trySkill.name}`}
          onChangeArgs={args => setTrySkill(prev => (prev ? { ...prev, args } : prev))}
          onConfirm={() => void handleTryConfirm()}
          onCancel={() => {
            if (busyActionRef.current === null) setTrySkill(null);
          }}
        />
      )}
    </div>
  );
}
