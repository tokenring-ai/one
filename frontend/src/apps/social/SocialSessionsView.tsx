import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2, Pause, Share2, Square } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import MissingAgentTypeNotice from "../../features/agents/MissingAgentTypeNotice.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { usePaneLink } from "../../layout/hooks.ts";
import { agentRPCClient, useAgentList, useAgentTypes } from "../../rpc.ts";
import Button from "../../ui/button.tsx";
import { CHAT_VIEW } from "../chat/ids.ts";
import { SOCIAL_AGENT_TYPE } from "./shared.ts";

const LAUNCH_LABEL = "Launch Social agent";

const LAUNCH_DESCRIPTION =
  "Launch a social agent to draft posts, manage conversations, and work across Slack, Telegram, and other connected platforms through a unified chat interface.";

/** Running social agents, and the card that launches another one. */
export default function SocialSessionsView() {
  const openPane = usePaneLink();
  const openAgentChat = useCallback((agentId: string) => openPane(CHAT_VIEW, { agentId }), [openPane]);
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [creating, setCreating] = useState(false);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  // Unknown until the catalog loads; only a loaded catalog without the type disables launching.
  const socialTypeMissing = agentTypes.data !== undefined && !agentTypes.data.some(type => type.type === SOCIAL_AGENT_TYPE);

  const existingAgents = useMemo(() => (agents.data ?? []).filter(agent => agent.agentType === SOCIAL_AGENT_TYPE), [agents.data]);

  const launch = useCallback(async () => {
    setCreating(true);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: SOCIAL_AGENT_TYPE });
      await agents.mutate();
      openAgentChat(id);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCreating(false);
    }
  }, [agents, openAgentChat]);

  const stop = useCallback(
    async (agentId: string, displayName: string) => {
      const confirmed = await openConfirm({
        id: "social:stop-agent",
        title: "Stop session",
        message: `Stop and delete "${displayName}"? Its conversation cannot be recovered.`,
        confirmText: "Stop",
        variant: "danger",
      });
      if (!confirmed) return;
      setStoppingId(agentId);
      try {
        await agentRPCClient.deleteAgent({ agentId, reason: "User stopped the session from the Social app" });
        await agents.mutate();
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setStoppingId(prev => (prev === agentId ? null : prev));
      }
    },
    [agents, openConfirm],
  );

  return (
    <ViewShell pad="page" width="prose" bodyClassName="space-y-6">
      {existingAgents.length > 0 && (
        <div className="space-y-2">
          <SectionLabel tone="warning" className="px-1">
            Running sessions
          </SectionLabel>
          <div className="space-y-2">
            {existingAgents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center gap-1 bg-secondary border border-amber-500/30 rounded-xl hover:bg-hover hover:border-amber-500/60 transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => openAgentChat(agent.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer focus-ring"
                  aria-label={`Open ${agent.displayName}, ${agent.idle ? "idle" : "working"}`}
                >
                  {/* Only a working agent spins; an idle one is waiting for input. */}
                  {agent.idle ? <Pause className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" /> : <BusySpinner size="sm" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                    <div className="text-xs text-muted truncate mt-0.5">{agent.idle ? "Idle" : agent.currentActivity || "Working…"}</div>
                  </div>
                  <div className="text-xs text-muted">Open →</div>
                </button>
                <button
                  type="button"
                  onClick={() => void stop(agent.id, agent.displayName)}
                  disabled={stoppingId === agent.id}
                  className="mr-1.5 p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Stop ${agent.displayName}`}
                  title="Stop and delete this session"
                >
                  {stoppingId === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-secondary border border-primary rounded-xl p-6 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <Share2 className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-primary">Social</h2>
          <p className="text-sm text-muted mt-1 max-w-sm leading-relaxed">{LAUNCH_DESCRIPTION}</p>
        </div>
        <Button size="md" onClick={() => void launch()} disabled={socialTypeMissing} busy={creating} busyLabel="Launching…" className="px-5 rounded-xl">
          {LAUNCH_LABEL}
        </Button>
        {socialTypeMissing && <MissingAgentTypeNotice agentType={SOCIAL_AGENT_TYPE} feature="The Social agent" className="w-full max-w-sm" />}
        <p className="text-xs text-muted">Powered by TokenRing AI agents</p>
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
