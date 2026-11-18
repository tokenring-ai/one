import formatError from "@tokenring-ai/utility/error/formatError";
import { Eraser, MessageCircleQuestion, MessageSquare, Pause } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { prefillChatInput } from "../../components/ChatInputContext.tsx";
import ChatPanel, { type ChatBadge } from "../../components/chat/ChatPanel.tsx";
import DeletedAgentRestorePanel from "../../components/chat/DeletedAgentRestorePanel.tsx";
import GoalChip from "../../components/chat/GoalChip.tsx";
import HookSelector from "../../components/HookSelector.tsx";
import ModelSelector from "../../components/ModelSelector.tsx";
import SkillSelector from "../../components/SkillSelector.tsx";
import ToolApprovalSelector from "../../components/ToolApprovalSelector.tsx";
import ToolSelector from "../../components/ToolSelector.tsx";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useAgentSessionTitle } from "../../hooks/agentSessionMetaStore.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import type { ViewProps } from "../../layout/define.ts";
import { usePaneLink, usePanel, usePanelMenu } from "../../layout/hooks.ts";
import type { PanelBadge } from "../../layout/types.ts";
import { AGENT_STATUS_LABEL } from "../../lib/agentSessions.ts";
import { cn } from "../../lib/utils.ts";
import { chatRPCClient, useAgentCheckpointList, useAgentList } from "../../rpc.ts";
import { agentMenuItems } from "../agents/agentMenu.ts";
import { useAgentActions } from "../agents/useAgentActions.ts";
import { useMonitorAgent } from "../agents/useMonitorAgent.ts";
import { usePanelTitle } from "../panelHooks.ts";
import { useChatExtras } from "./chatExtras.ts";
import { CHAT_VIEW } from "./ids.ts";
import { useBranchAgent } from "./useBranchAgent.ts";

/** ChatPanel's badge vocabulary, mapped onto the layout's tones. */

function toPanelBadge(badge: ChatBadge | null): PanelBadge | null {
  if (!badge) return null;
  const tone = badge.tone === "warning" ? "warning" : badge.tone === "success" ? "success" : "info";
  return badge.title ? { tone, label: badge.title } : { tone };
}

/** The agent's controls, on the chat's single header row: status, model, tools, and a menu. */
/** Clearing a transcript, behind a confirmation. */
function useClearTranscript(agentId: string) {
  const [clearing, setClearing] = useState(false);
  const { openConfirm, Dialog } = useConfirmDialog();
  const clear = async () => {
    if (clearing) return;
    const confirmed = await openConfirm({
      id: "chat:clear-transcript",
      title: "Clear transcript",
      message: "Remove this conversation from the agent? It starts over with an empty context. This can't be undone.",
      confirmText: "Clear",
      variant: "danger",
    });
    if (!confirmed) return;
    setClearing(true);
    try {
      const result = await chatRPCClient.clearChatMessages({ agentId });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent is no longer running", { duration: 3000 });
        return;
      }
      toastManager.success("Transcript cleared", { duration: 2500 });
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setClearing(false);
    }
  };
  return { clear, clearing, Dialog };
}

/**
 * The agent's controls, on the chat's single header row: status, model, tools and settings.
 * What you do with the agent (branch, export, clear, end) is in the chat area's ⋯ menu.
 */
function ChatHeader({ agentId, idle, activity, pendingQuestions }: { agentId: string; idle: boolean; activity: string; pendingQuestions: number }) {
  const headerRef = useRef<HTMLDivElement>(null);
  /** Trying a skill puts `/<skill> ` in this chat's message box, ready to finish and send. */
  const trySkill = (name: string) => {
    prefillChatInput(agentId, `/${name} `);
    requestAnimationFrame(() => headerRef.current?.closest("[data-panel]")?.querySelector("textarea")?.focus());
  };
  const waiting = pendingQuestions > 0;
  const status = AGENT_STATUS_LABEL[waiting ? "needs-you" : idle ? "idle" : "working"];
  return (
    <div ref={headerRef} className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-testid="chat-header">
      {/* No min-w-0: on a phone the status must not shrink under its own label and spill onto the model. */}
      <span className="flex flex-1 items-center gap-1.5 text-xs" title={activity || undefined}>
        {waiting ? (
          <MessageCircleQuestion className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
        ) : idle ? (
          <Pause className="h-3 w-3 shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <BusySpinner size="xs" />
        )}
        <span className={cn("shrink-0 font-medium", waiting ? "text-warning" : idle ? "text-muted" : "text-accent-soft")}>{status}</span>
        {!idle && !waiting && activity ? <span className="min-w-0 truncate text-muted">{activity}</span> : null}
      </span>
      <ModelSelector agentId={agentId} />
      <ToolSelector agentId={agentId} />
      {/* The agent's other settings, as icons: skills, hooks, tool approvals, goal. */}
      <span className="flex items-center">
        <SkillSelector agentId={agentId} triggerVariant="icon" onTrySkill={trySkill} />
        <HookSelector agentId={agentId} triggerVariant="icon" />
        <ToolApprovalSelector agentId={agentId} triggerVariant="icon" />
        <GoalChip agentId={agentId} triggerVariant="icon" />
      </span>
    </div>
  );
}

/** Conversation with one running agent. Always has an agent id: the URL names it. */
export default function ChatView({ params }: ViewProps) {
  // Attachments the hosting app offers with the next message (the file or design being viewed).
  const extras = useChatExtras(params.agentId);
  const agentId = params.agentId ?? "";
  const panel = usePanel();
  const openPane = usePaneLink();
  const branchAgent = useBranchAgent();
  const agents = useAgentList();
  const agent = useMemo(() => agents.data?.find(candidate => candidate.id === agentId), [agentId, agents.data]);
  const sessionTitle = useAgentSessionTitle(agent);
  // Only once the list has loaded without this agent; a still-loading list is not "missing".
  const missing = !agent && !!agents.data && !agents.isLoading;
  // Only queried once the agent is known to be gone, so healthy chats do not fetch.
  const checkpoints = useAgentCheckpointList(missing ? agentId : undefined);
  const hasCheckpoints = (checkpoints.data?.items.length ?? 0) > 0;

  usePanelTitle(agent ? sessionTitle : missing ? `Chat · ${agentId}` : null);

  // The chat area's ⋯ menu is this agent's one menu: branch, copy or download, clear, end.
  const clearTranscript = useClearTranscript(agentId);
  const monitorAgent = useMonitorAgent();
  const { deleteAgent, deletingAgentId, ConfirmDialog: EndAgentDialog } = useAgentActions();
  usePanelMenu(
    agent
      ? {
          label: sessionTitle,
          items: agentMenuItems(agentId, {
            branch: () => void branchAgent(agentId),
            monitor: () => monitorAgent(agentId),
            end: () => void deleteAgent(agentId),
            ending: deletingAgentId === agentId,
            extra: [
              {
                id: "clear",
                label: "Clear transcript…",
                icon: Eraser,
                separated: true,
                disabled: clearTranscript.clearing,
                onSelect: () => void clearTranscript.clear(),
              },
            ],
          }),
        }
      : null,
  );

  const panelRef = useRef(panel);
  panelRef.current = panel;
  const { key, isVisible, isActive } = panel;
  const chatPanel = useMemo(() => ({ panelId: key, isVisible, isActive }), [key, isVisible, isActive]);
  const onBadgeChange = useCallback((badge: ChatBadge | null) => panelRef.current.setBadge(toPanelBadge(badge)), []);

  // Bumped when the agent is restored under the same id, so the chat reconnects to it from scratch.
  const [restoreCount, setRestoreCount] = useState(0);
  /** The restored agent replaces this chat: the old conversation is gone for good. */
  const onRestored = (restoredId: string) => {
    if (restoredId === agentId) {
      setRestoreCount(count => count + 1);
      return;
    }
    panel.close();
    openPane(CHAT_VIEW, { agentId: restoredId });
  };

  if (missing) {
    return (
      <ViewShell data-testid="chat-agent-missing">
        <DeletedAgentRestorePanel agentId={agentId} onRestored={onRestored} />
        <EmptyState
          icon={MessageSquare}
          title="Agent is no longer running"
          hint={
            checkpoints.isLoading
              ? "Checking for saved checkpoints…"
              : hasCheckpoints
                ? "Restore it from a checkpoint above, or close this panel."
                : "No checkpoints were saved for this session, so it can't be restored."
          }
          variant="page"
          ctaLabel="Close panel"
          onCta={() => panel.close()}
          ctaIcon={MessageSquare}
        />
      </ViewShell>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-1 flex-col">
      <div className="flex-1 min-h-0">
        <ChatPanel
          header={
            <ChatHeader agentId={agentId} idle={agent?.idle ?? true} activity={agent?.currentActivity ?? ""} pendingQuestions={agent?.pendingQuestions ?? 0} />
          }
          onBranch={options => void branchAgent(agentId, options)}
          key={`${agentId}:${restoreCount}`}
          agentId={agentId}
          panel={chatPanel}
          onBadgeChange={onBadgeChange}
          onAgentRestored={onRestored}
          extraAttachments={extras.attachments}
          {...(extras.onRemove ? { onRemoveExtraAttachment: extras.onRemove } : {})}
        />
      </div>
      <clearTranscript.Dialog />
      <EndAgentDialog />
    </div>
  );
}
