import { useSyncExternalStore } from "react";
import type { ExtraChatAttachment } from "../../components/chat/ChatFooter.tsx";

/**
 * App-contributed chat attachments, keyed by agent id. An app publishes the
 * attachments it wants sent with the next message (e.g. the design being
 * viewed); the chat panel for that agent, wherever it is docked, shows them.
 */

export interface ChatExtras {
  attachments: ExtraChatAttachment[];
  onRemove?: ((id: string) => void) | undefined;
}

const extras = new Map<string, ChatExtras>();
const listeners = new Set<() => void>();
const EMPTY: ChatExtras = { attachments: [] };

function notify() {
  for (const listener of listeners) listener();
}

export function setChatExtras(agentId: string, value: ChatExtras | null): void {
  if (value && value.attachments.length > 0) extras.set(agentId, value);
  else extras.delete(agentId);
  notify();
}

export function getChatExtras(agentId: string): ChatExtras {
  return extras.get(agentId) ?? EMPTY;
}

export function useChatExtras(agentId: string | undefined): ChatExtras {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (agentId ? getChatExtras(agentId) : EMPTY),
    () => EMPTY,
  );
}
