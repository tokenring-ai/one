import { Hash, Mail, MessageSquare, MessagesSquare } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import MessagingChannelsView from "./MessagingChannelsView.tsx";
import MessagingConversationsView from "./MessagingConversationsView.tsx";
import MessagingEmailView from "./MessagingEmailView.tsx";
import MessagingOverviewView from "./MessagingOverviewView.tsx";
import { MESSAGING_CHANNELS_VIEW, MESSAGING_CONVERSATIONS_VIEW, MESSAGING_EMAIL_VIEW, MESSAGING_OVERVIEW_VIEW } from "./shared.tsx";

/**
 * Views of the Messaging app. Every panel reads `useMessagingData`, which is
 * only affordable because the stream and SWR hooks share one subscription per key.
 */
export const MESSAGING_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: MESSAGING_OVERVIEW_VIEW,
    kind: "page",
    title: "Messaging overview",
    description: "Channels, recent threads and email at a glance",
    icon: MessageSquare,
    component: MessagingOverviewView,
  }),
  defineView({
    id: MESSAGING_CONVERSATIONS_VIEW,
    kind: "widget",
    title: "Conversations",
    description: "Live bot conversations across every connected service",
    icon: MessagesSquare,
    component: MessagingConversationsView,
  }),
  defineView({
    id: MESSAGING_EMAIL_VIEW,
    kind: "widget",
    title: "Email",
    description: "The primary provider's inbox, in summary",
    icon: Mail,
    component: MessagingEmailView,
  }),
  defineView({
    id: MESSAGING_CHANNELS_VIEW,
    kind: "widget",
    title: "Channels",
    description: "Messaging services and email providers, connected or not",
    icon: Hash,
    component: MessagingChannelsView,
  }),
];
