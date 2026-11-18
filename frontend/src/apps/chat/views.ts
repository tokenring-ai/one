import { MessageSquare } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import ChatView from "./ChatView.tsx";
import { CHAT_VIEW } from "./ids.ts";

/**
 * Conversation with a running agent. Routed at `agent/:agentId` inside each
 * app that lists it (`/home/agent/<id>`); the Agents app aliases it to the
 * canonical `/agent/<id>`.
 */
export const chatView = defineView({
  id: CHAT_VIEW,
  kind: "agent",
  // Running chats rename their tab to the session title; the id is the fallback.
  title: params => params.agentId ?? "Chat",
  description: "Conversation with a running agent",
  closeHint: "Close the chat. The agent keeps running; end it from the Agents list.",
  icon: MessageSquare,
  route: "agent/:agentId",
  instanceKey: params => params.agentId ?? "",
  closable: true,
  component: ChatView,
});

export const CHAT_VIEWS: readonly ViewDefinition[] = [chatView];
