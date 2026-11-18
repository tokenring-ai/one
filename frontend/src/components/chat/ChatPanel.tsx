import type { ChatAttachment } from "@tokenring-ai/agent/AgentEvents";
import formatError from "@tokenring-ai/utility/error/formatError";
import { isRpcConnectionClosed } from "@tokenring-ai/web-host/createWsRPCClient";
import type React from "react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackDelivery } from "../../features/chat/trackDelivery.ts";
import { agentSessionTitle, useAgentSessionMetaMap } from "../../hooks/agentSessionMetaStore.ts";
import { useAgentEventState } from "../../hooks/useAgentEventState.ts";
import { useAnnouncer } from "../../hooks/useAnnouncer.tsx";
import { useConnectionStatus } from "../../hooks/useConnectionStatus.ts";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import { usePerTurnUsage } from "../../hooks/usePerTurnUsage.ts";
import { resolveAppLink } from "../../lib/appLinks.ts";
import { requireAgentFound } from "../../lib/requireAgentFound.ts";
import { agentRPCClient, useAgentCheckpointList, useAgentList, useAvailableCommands, useChatUsage, useCommandHistory } from "../../rpc.ts";
import { useChatInput } from "../ChatInputContext.tsx";
import FileBrowserOverlay from "../overlay/file-browser.tsx";
import { notificationManager, toastManager } from "../ui/toast.tsx";
import AutoScrollContainer from "./AutoScrollContainer.tsx";
import ChatFooter, { type ExtraChatAttachment, type QueuedChatInput } from "./ChatFooter.tsx";
import ConnectionStatusBanner from "./ConnectionStatusBanner.tsx";
import DeletedAgentRestorePanel from "./DeletedAgentRestorePanel.tsx";
import MessageList from "./MessageList.tsx";
import PendingQuestions from "./PendingQuestions.tsx";
import TranscriptToolbar from "./TranscriptToolbar.tsx";
import { useChatAnnouncements } from "./useChatAnnouncements.ts";

/** What the chat asks its host to show on its tab (unread completion, attention needed). */
export interface ChatBadge {
  /** Short text; omit (or empty) for a plain dot. */
  label?: string | undefined;
  /** Tooltip / accessible description. */
  title?: string | undefined;
  tone?: "accent" | "warning" | "success" | undefined;
}

/**
 * Outcome of a send: delivered, held for reconnect (definitely never sent), lost in a dropped
 * connection (may or may not have been delivered), rejected, or refused because another send was in flight.
 */
type SendResult = "sent" | "offline" | "uncertain" | "failed" | "busy";

interface ChatPanelProps {
  agentId: string;
  /** The hosting panel's state, when the chat lives in a layout panel. Enables visibility-aware notifications. */
  panel?: { panelId: string; isVisible: boolean; isActive: boolean };
  /** Receives the tab badge (unread output in a hidden chat); the host shows it on its tab. */
  onBadgeChange?: (badge: ChatBadge | null) => void;
  /** Passed to the restore panel shown when the agent turns out to be gone. */
  onAgentRestored?: (agentId: string) => void;
  /** App-contributed attachments sent with the next message, shown as chips above the composer. */
  extraAttachments?: ExtraChatAttachment[];
  onRemoveExtraAttachment?: (id: string) => void;
  /** The host's agent controls (status, model, tools, menu), shown in the chat's single header row. */
  header?: ReactNode;
  /** Branch the conversation into a new agent from a point in the transcript (see MessageList). */
  onBranch?: (options: { at: number; draft?: string }) => void;
}

export default function ChatPanel({
  agentId,
  panel,
  onBadgeChange,
  onAgentRestored,
  extraAttachments,
  onRemoveExtraAttachment,
  header,
  onBranch,
}: ChatPanelProps) {
  const onBadgeChangeRef = useRef(onBadgeChange);
  onBadgeChangeRef.current = onBadgeChange;
  const writeBadge = useCallback((_panelId: string, badge: ChatBadge | null) => {
    onBadgeChangeRef.current?.(badge);
  }, []);
  const { getInput, setInput: setPersistedInput } = useChatInput();
  const [input, setInputState] = useState(() => getInput(agentId));
  /** Guards against overlapping sendInput RPCs while one is still awaiting. */
  const sendInFlight = useRef(false);
  /**
   * A message that was never sent because the connection was down, sent automatically on
   * reconnect. `fromComposer` marks a send typed in the composer; `inComposer` that its
   * draft was put back there (the user had not typed anything new). `resolve` settles the
   * composer submit once the retry is delivered, cancelled or fails.
   */
  const pendingRetryRef = useRef<{
    message: string;
    attachments?: ChatAttachment[];
    fromComposer: boolean;
    inComposer: boolean;
    resolve?: (delivered: boolean) => void;
  } | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;
  // Another surface can hand this agent a draft (`prefillChatInput`) while the
  // panel is already open; adopt it, since our own edits are persisted as typed.
  const persistedInput = getInput(agentId);
  useEffect(() => {
    if (persistedInput !== inputRef.current) setInputState(persistedInput);
  }, [persistedInput]);
  const { isOnline } = useConnectionStatus();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const [showHistory, setShowHistory] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [inputError, setInputError] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [retryingRequestId, setRetryingRequestId] = useState<string | null>(null);
  const [injectedDraft, setInjectedDraft] = useState<{ attachments: ChatAttachment[]; nonce: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hideToolCalls, setHideToolCalls] = useLocalStorageState("chat.hideToolCalls", false);
  const inputErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending feedback timers on unmount.
  useEffect(() => {
    return () => {
      if (inputErrorTimerRef.current) clearTimeout(inputErrorTimerRef.current);
      if (submitFeedbackTimerRef.current) clearTimeout(submitFeedbackTimerRef.current);
    };
  }, []);

  const setInputErrorAndClearTimer = (value: boolean) => {
    // A pending auto-reset must not clobber a newly set error state.
    if (inputErrorTimerRef.current) {
      clearTimeout(inputErrorTimerRef.current);
      inputErrorTimerRef.current = null;
    }
    setInputError(value);
  };

  const showSubmitFeedback = (message: string, type: "success" | "error") => {
    if (submitFeedbackTimerRef.current) clearTimeout(submitFeedbackTimerRef.current);
    setSubmitFeedback({ message, type });
    submitFeedbackTimerRef.current = setTimeout(() => {
      submitFeedbackTimerRef.current = null;
      setSubmitFeedback(null);
    }, 2000);
  };

  const setInput = (value: string) => {
    setInputState(value);
    setPersistedInput(agentId, value);
  };

  /**
   * Put an unsent message back in the composer. Text the user typed since is never
   * overwritten: the message goes above it, so neither is lost.
   */
  const restoreDraft = (text: string) => {
    const current = inputRef.current;
    if (current.trim() === text.trim()) return;
    const next = current.trim() === "" ? text : `${text}\n\n${current}`;
    setInput(next);
    inputRef.current = next;
    if (next !== text) toastManager.info("Your unsent message was put back above the text you typed since.", { duration: 6000 });
  };

  const { messages, agentStatus, currentExecutionState, isConnecting, connectionError, reconnectAttempts, agentNotFound, manualReconnect } =
    useAgentEventState(agentId);
  // Only queried once the agent is known to be gone; null key avoids fetching
  // for healthy chat panels.
  const checkpoints = useAgentCheckpointList(agentNotFound ? agentId : undefined);
  const hasCheckpoints = (checkpoints.data?.items.length ?? 0) > 0;
  const navigate = useNavigate();

  const idle = agentStatus.status === "running" && agentStatus.inputExecutionQueue.length === 0;
  const busy = agentStatus.inputExecutionQueue.length > 0;

  const pendingQuestions = useMemo(
    () =>
      currentExecutionState?.availableInteractions
        ?.filter(interaction => interaction.type === "question")
        .map(question => ({ ...question, requestId: currentExecutionState.requestId })) ?? [],
    [currentExecutionState],
  );

  // Short spoken status for screen readers (turn started/finished/failed, questions). Streamed text is never announced.
  const agentList = useAgentList();
  const metaMap = useAgentSessionMetaMap();
  const listed = agentList.data?.find(a => a.id === agentId);
  const spokenName = (listed ? agentSessionTitle(listed, metaMap) : "").slice(0, 40).trim();
  const { announce, region: announcerRegion } = useAnnouncer();
  useChatAnnouncements({
    announce,
    agentName: spokenName,
    messages,
    busy,
    known: agentStatus.status !== "connecting",
    questions: pendingQuestions,
    attending: (panel?.isVisible ?? true) && !document.hidden,
  });

  const commandHistory = useCommandHistory(agentId);
  const availableCommands = useAvailableCommands(agentId);
  const chatUsage = useChatUsage(agentId);
  const usageSnapshot = chatUsage.data?.status === "success" ? chatUsage.data : null;
  const usageByRequestId = usePerTurnUsage(
    chatUsage.data?.status,
    usageSnapshot ? { costTotal: usageSnapshot.cost.total, totalTokens: usageSnapshot.totalUsage.totalTokens } : null,
    messages,
  );

  const filteredAvailableCommands = useMemo(() => {
    let ret: string[] = [];
    if (input.startsWith("/") && availableCommands.data) {
      ret = availableCommands.data
        .filter(cmd => cmd.name.toLowerCase().startsWith(input.slice(1).toLowerCase()))
        .map(cmd => cmd.name)
        .sort();
      if (ret.length === 0) {
        ret = ["help"];
      } else if (ret.length < 4) {
        ret.push(...ret.map(cmd => `help ${cmd}`));
      }
    }
    return ret;
  }, [availableCommands.data, input]);

  const inputByRequestId = useMemo(() => {
    const map = new Map<string, Extract<(typeof messages)[number], { type: "input.received" }>>();
    for (const message of messages) {
      if (message.type === "input.received") map.set(message.requestId, message);
    }
    return map;
  }, [messages]);

  // Queue positions: index 0 is currently executing; the rest are waiting.
  const queuedInputs: QueuedChatInput[] = useMemo(
    () =>
      agentStatus.inputExecutionQueue
        .slice(1)
        .map(requestId => inputByRequestId.get(requestId))
        .filter((message): message is Extract<(typeof messages)[number], { type: "input.received" }> => message !== undefined)
        .map(message => ({ requestId: message.requestId, message: message.input.message })),
    [agentStatus.inputExecutionQueue, inputByRequestId, messages],
  );

  /**
   * Send a message (with optional attachments); records command history and auto-titles the session.
   * `fromComposer` sends clear the composer optimistically and restore it on failure;
   * other sends (retrying an old turn) never touch the user's current draft.
   */
  const sendMessage = useCallback(
    async (message: string, attachments: ChatAttachment[] | undefined, { fromComposer }: { fromComposer: boolean }): Promise<SendResult> => {
      if (sendInFlight.current) {
        showSubmitFeedback("Still sending the previous message", "error");
        return "busy";
      }
      sendInFlight.current = true;
      const hasAttachments = attachments !== undefined && attachments.length > 0;
      // Clear the composer only when it holds this message; a held retry must not wipe newer text.
      const clearsComposer = fromComposer && inputRef.current.trim() === message;
      const draft = clearsComposer ? inputRef.current : message;
      if (clearsComposer) {
        setInput("");
        // Keep the ref in step so a failure before the next render sees the cleared composer.
        inputRef.current = "";
        setInputErrorAndClearTimer(false);
      }
      try {
        const delivery = await trackDelivery(() =>
          agentRPCClient.sendInput({
            agentId,
            input: {
              from: "Chat webapp user",
              message,
              ...(hasAttachments && { attachments }),
            },
          }),
        );
        if (!delivery.ok) {
          if (!delivery.mayHaveBeenSent && !isOnlineRef.current) {
            // The socket was down the whole time, so the message never left: hold it for automatic
            // delivery on reconnect. Put the draft back only if the user has not typed anything new.
            const inComposer = fromComposer && inputRef.current === "";
            if (inComposer) {
              setInput(draft);
              inputRef.current = draft;
            }
            // A newer offline failure supersedes the older one, which is reported as undelivered.
            pendingRetryRef.current?.resolve?.(false);
            pendingRetryRef.current = { message, ...(hasAttachments && { attachments }), fromComposer, inComposer };
            showSubmitFeedback("Offline — will send when reconnected", "error");
            toastManager.warning("You're offline. Your message is kept and will send when the connection returns.", { duration: 6000 });
            return "offline";
          }
          if (delivery.mayHaveBeenSent && (!isOnlineRef.current || isRpcConnectionClosed(delivery.error))) {
            // The connection dropped after the request may have gone out. Resending could run it
            // twice, so hand it back to the user instead.
            if (fromComposer) restoreDraft(draft);
            showSubmitFeedback("May not have been sent", "error");
            toastManager.warning(
              "The connection dropped while sending. Your message may or may not have been delivered — check the conversation before sending it again.",
              { duration: 8000 },
            );
            return "uncertain";
          }
          throw delivery.error;
        }
        requireAgentFound(delivery.value);
        if (message) {
          const newHistory = [...(commandHistory.data || []), message].slice(-50);
          // History is a convenience; a failure to record it must not mark the send as failed.
          await Promise.resolve(commandHistory.mutate(newHistory)).catch(() => undefined);
        }
        if (hasAttachments) {
          showSubmitFeedback(`Sent ${attachments.length} attachment(s)`, "success");
        }
        return "sent";
      } catch (error) {
        // Restore (and persist) the draft without overwriting anything typed since.
        if (fromComposer) restoreDraft(draft);
        toastManager.error(formatError(error), { duration: 5000 });
        showSubmitFeedback("Failed to send", "error");
        return "failed";
      } finally {
        sendInFlight.current = false;
      }
    },
    // `input` and `messages` are intentionally read for the optimistic update and
    // first-message detection only; keeping them as deps matches previous behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId, input, messages, commandHistory],
  );

  /** Wait for an offline-held message to be delivered on reconnect (or dropped). */
  const awaitPendingRetry = (): Promise<boolean> =>
    new Promise<boolean>(resolve => {
      if (pendingRetryRef.current) pendingRetryRef.current.resolve = resolve;
      else resolve(false);
    });

  // Deliver a message that failed while offline as soon as the connection is back.
  useEffect(() => {
    if (!isOnline) return;
    const pending = pendingRetryRef.current;
    if (!pending) return;
    pendingRetryRef.current = null;
    // If the user edited the draft that was put back in the composer, that version is theirs
    // now: say so instead of sending the old text behind their back. The draft was restored
    // untrimmed while the message was trimmed, so compare trimmed text. A message that never
    // made it back into the composer (the user was typing something else) is always sent.
    const composer = inputRef.current.trim();
    if (pending.inComposer && composer !== "" && composer !== pending.message) {
      toastManager.info("Reconnected. Your held message wasn't sent because you edited it — send it when ready.", { duration: 6000 });
      pending.resolve?.(false);
      return;
    }
    void sendMessage(pending.message, pending.attachments, { fromComposer: pending.fromComposer }).then(result => {
      if (result === "sent") showSubmitFeedback("Sent after reconnect", "success");
      if (result === "offline" && pendingRetryRef.current) {
        // Dropped again before delivery: keep the original submitter waiting.
        if (pending.resolve) pendingRetryRef.current.resolve = pending.resolve;
        return;
      }
      pending.resolve?.(result === "sent");
    });
  }, [isOnline, sendMessage]);

  const handleSubmit = async (attachments?: ChatAttachment[]): Promise<boolean> => {
    const hasAttachments = attachments !== undefined && attachments.length > 0;
    const message = input.trim();
    if (!message && !hasAttachments) {
      setInputErrorAndClearTimer(true);
      inputErrorTimerRef.current = setTimeout(() => {
        inputErrorTimerRef.current = null;
        setInputError(false);
      }, 1000);
      return false;
    }
    // When the agent is busy the backend queues the input; sending is always allowed.
    const result = await sendMessage(message, attachments, { fromComposer: true });
    if (result === "offline") return awaitPendingRetry();
    if (result !== "sent") return false;
    if (!idle) showSubmitFeedback("Queued behind current task", "success");
    return true;
  };

  const handleRetryInput = useCallback(
    async (requestId: string) => {
      const inputMessage = inputByRequestId.get(requestId);
      if (!inputMessage) return;
      setRetryingRequestId(requestId);
      try {
        const result = await sendMessage(inputMessage.input.message, inputMessage.input.attachments, { fromComposer: false });
        if (result === "sent") showSubmitFeedback("Retried", "success");
      } finally {
        setRetryingRequestId(null);
      }
    },
    [inputByRequestId, sendMessage],
  );

  const handleEditInput = useCallback(
    (message: Extract<(typeof messages)[number], { type: "input.received" }>) => {
      setInput(message.input.message);
      if (message.input.attachments && message.input.attachments.length > 0) {
        setInjectedDraft({ attachments: message.input.attachments, nonce: Date.now() });
      }
    },
    [setInput],
  );

  const handleCancelQueuedInput = useCallback(
    async (requestId: string) => {
      try {
        await agentRPCClient.cancelInput({ agentId, requestId });
      } catch (error) {
        toastManager.error(`Failed to cancel queued message: ${formatError(error)}`, { duration: 5000 });
      }
    },
    [agentId],
  );

  // Background completion: when a turn finishes while this panel is hidden, raise
  // a notification and badge the dock tab so the user knows the agent needs attention.
  const mountedAtRef = useRef(Date.now());
  const notifiedRequestIdsRef = useRef(new Set<string>());
  useEffect(() => {
    for (const message of messages) {
      if (message.type !== "agent.response") continue;
      if (notifiedRequestIdsRef.current.has(message.requestId)) continue;
      notifiedRequestIdsRef.current.add(message.requestId);
      // History streamed in on mount must not look like fresh completions.
      if (message.timestamp < mountedAtRef.current - 2_000) continue;
      const panelHidden = panel ? !panel.isVisible : false;
      if (!panelHidden && !document.hidden) continue;
      if (message.status === "success" && !message.message.trim()) continue;
      const label = message.status === "error" ? "failed" : message.status === "cancelled" ? "was cancelled" : "finished";
      notificationManager.add({
        type: message.status === "error" ? "error" : message.status === "cancelled" ? "warning" : "success",
        title: "Agent task completed",
        message: `Task ${label}${message.message.trim() ? `: ${message.message.slice(0, 140)}` : ""}`,
        duration: 6000,
      });
      if (panel) {
        writeBadge(panel.panelId, {
          label: "●",
          tone: message.status === "error" ? "warning" : "accent",
          title: `Task ${label} — open to view`,
        });
      }
    }
  }, [messages, panel, writeBadge]);

  // Clear the tab badge as soon as the panel is seen again: when the dock shows
  // it, or when the browser tab returns to the foreground with the panel visible.
  const panelId = panel?.panelId;
  const panelVisible = panel?.isVisible ?? false;
  useEffect(() => {
    if (!panelId || !panelVisible) return;
    const clearIfSeen = () => {
      if (!document.hidden) writeBadge(panelId, null);
    };
    clearIfSeen();
    document.addEventListener("visibilitychange", clearIfSeen);
    return () => document.removeEventListener("visibilitychange", clearIfSeen);
  }, [panelId, panelVisible, writeBadge]);

  // A closed panel must not leave a stale badge behind.
  useEffect(() => {
    if (!panelId) return;
    return () => writeBadge(panelId, null);
  }, [panelId, writeBadge]);

  /**
   * Intercept custom-scheme markdown links (agent://…, workflow://…, etc.) so the
   * browser does not try to open an external protocol handler. Primary rendering
   * rewrites these via MarkdownLink; this capture is a safety net for any raw hrefs.
   */
  const handleAppLinkClickCapture = useCallback(
    (event: React.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!event.currentTarget.contains(anchor)) return;

      const href = anchor.getAttribute("href");
      const path = resolveAppLink(href);
      if (!path) return;

      event.preventDefault();
      event.stopPropagation();
      void navigate(path);
    },
    [navigate],
  );

  // The dock's tab strip is the panel header; ChatPanel renders none of its own.
  if (agentNotFound) {
    return (
      <div className="h-full flex flex-col">
        <DeletedAgentRestorePanel agentId={agentId} {...(onAgentRestored ? { onRestored: onAgentRestored } : {})} />
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <p className="max-w-md text-sm text-muted">
            The agent <code className="px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-primary font-mono text-xs">{agentId}</code> is no longer
            running.{" "}
            {checkpoints.isLoading
              ? "Checking for saved checkpoints…"
              : checkpoints.error
                ? "Couldn't check for saved checkpoints — use the retry button above."
                : hasCheckpoints
                  ? "Restore it from a checkpoint above."
                  : "No checkpoints were saved for this session, so it can't be restored."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {announcerRegion}
      <ConnectionStatusBanner
        isConnecting={isConnecting}
        connectionError={connectionError}
        reconnectAttempts={reconnectAttempts}
        onReconnect={manualReconnect}
      />

      <FileBrowserOverlay agentId={agentId} isOpen={showFileBrowser} onClose={() => setShowFileBrowser(false)} />

      <TranscriptToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hideToolCalls={hideToolCalls}
        onToggleHideToolCalls={() => setHideToolCalls(on => !on)}
        leading={header}
      />

      <div className="flex flex-col flex-1 min-h-0" onClickCapture={handleAppLinkClickCapture}>
        <AutoScrollContainer busy={busy}>
          <MessageList
            messages={messages}
            agentId={agentId}
            agentStatus={agentStatus}
            searchQuery={searchQuery}
            hideToolCalls={hideToolCalls}
            usageByRequestId={usageByRequestId}
            onRetryInput={handleRetryInput}
            retryingRequestId={retryingRequestId}
            onEditInput={handleEditInput}
            {...(onBranch !== undefined && { onBranch })}
          />
        </AutoScrollContainer>

        <PendingQuestions questions={pendingQuestions} agentId={agentId} agentName={spokenName} />

        <ChatFooter
          agentId={agentId}
          input={input}
          setInput={setInput}
          inputError={inputError}
          setInputError={setInputErrorAndClearTimer}
          idle={idle}
          availableCommands={filteredAvailableCommands}
          commandHistory={commandHistory.data || []}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          setShowFileBrowser={setShowFileBrowser}
          onSubmit={handleSubmit}
          submitFeedback={submitFeedback}
          queuedInputs={queuedInputs}
          onCancelQueuedInput={handleCancelQueuedInput}
          injectedDraft={injectedDraft}
          {...(extraAttachments && { extraAttachments })}
          {...(onRemoveExtraAttachment && { onRemoveExtraAttachment })}
        />
      </div>
    </div>
  );
}
