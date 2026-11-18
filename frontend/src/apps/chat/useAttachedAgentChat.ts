import { useEffect, useRef } from "react";
import type { ExtraChatAttachment } from "../../components/chat/ChatFooter.tsx";
import { useLayoutApi } from "../../layout/context.ts";
import { usePanel } from "../../layout/hooks.ts";
import { panelKey } from "../../layout/model.ts";
import type { Edge } from "../../layout/types.ts";
import { setChatExtras } from "./chatExtras.ts";
import { CHAT_VIEW } from "./ids.ts";

export interface AttachedAgentChatOptions {
  /** The agent the app is working with; null detaches (closes its chat). */
  agentId: string | null;
  /** Context offered with the next chat message (the open file, the design being viewed...). */
  extraAttachments?: ExtraChatAttachment[] | undefined;
  onRemoveExtraAttachment?: ((id: string) => void) | undefined;
  /**
   * Open the chat in a split on this side of the calling panel, so the two
   * share the screen (a run and the agent running it). Default: wherever the
   * app puts agent chats.
   */
  beside?: Edge | undefined;
}

export interface AttachedAgentChat {
  /** Opens (and focuses) the attached agent's chat. */
  openChat(): void;
  closeChat(): void;
}

/**
 * Keeps an app's agent chat beside the app's work. The app must list the
 * `chat` view in its manifest's `views`; chats then land in an `agent`
 * container (create one with `placement: { agent: "right" }`).
 *
 * - Attaching a new agent during the session opens its chat without stealing focus.
 * - On first mount the chat opens only when the layout came from the app's
 *   template, so a user who closed it keeps it closed across reloads.
 * - Detaching, or switching agents, closes the previous agent's chat.
 */
export function useAttachedAgentChat({ agentId, extraAttachments, onRemoveExtraAttachment, beside }: AttachedAgentChatOptions): AttachedAgentChat {
  const api = useLayoutApi();
  const self = usePanel().key;
  const apiRef = useRef(api);
  apiRef.current = api;
  const previous = useRef<string | null>(null);
  const mounted = useRef(false);
  const hostsChat = api.app.views.includes(CHAT_VIEW);

  useEffect(() => {
    if (!hostsChat) return;
    const { store } = apiRef.current;
    const before = previous.current;
    previous.current = agentId;
    const firstRun = !mounted.current;
    mounted.current = true;
    if (before && before !== agentId) apiRef.current.close(panelKey(CHAT_VIEW, { agentId: before }, p => p.agentId ?? ""));
    if (!agentId) return;
    if (store.getState().panels[panelKey(CHAT_VIEW, { agentId }, p => p.agentId ?? "")]) return;
    if (firstRun && store.restored) return;
    apiRef.current.open(CHAT_VIEW, { agentId }, beside ? { focus: false, beside: { edge: beside, of: self } } : { focus: false });
  }, [agentId, hostsChat, beside, self]);

  useEffect(() => {
    if (!agentId) return;
    setChatExtras(agentId, extraAttachments ? { attachments: extraAttachments, onRemove: onRemoveExtraAttachment } : null);
    return () => setChatExtras(agentId, null);
  }, [agentId, extraAttachments, onRemoveExtraAttachment]);

  return {
    openChat: () => {
      if (agentId && hostsChat) apiRef.current.open(CHAT_VIEW, { agentId });
    },
    closeChat: () => {
      if (agentId) apiRef.current.close(panelKey(CHAT_VIEW, { agentId }, p => p.agentId ?? ""));
    },
  };
}
