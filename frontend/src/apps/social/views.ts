import { PenSquare, Rocket, Share2 } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import SocialComposeView from "./SocialComposeView.tsx";
import SocialPlatformsView from "./SocialPlatformsView.tsx";
import SocialSessionsView from "./SocialSessionsView.tsx";
import { SOCIAL_COMPOSE_VIEW, SOCIAL_PLATFORMS_VIEW, SOCIAL_SESSIONS_VIEW } from "./shared.ts";

/** Core Social views. Neither owns a route: Social's only routable item is a chat. */
export const SOCIAL_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: SOCIAL_COMPOSE_VIEW,
    kind: "widget",
    title: "Compose",
    description: "Write one post and send it to X and Reddit",
    icon: PenSquare,
    component: SocialComposeView,
  }),
  defineView({
    id: SOCIAL_PLATFORMS_VIEW,
    kind: "widget",
    title: "Platforms",
    description: "Connection status for Slack, Telegram, Discord and friends",
    icon: Share2,
    component: SocialPlatformsView,
  }),
  defineView({
    id: SOCIAL_SESSIONS_VIEW,
    kind: "widget",
    title: "Social agents",
    description: "Running social agents, and launching another",
    icon: Rocket,
    component: SocialSessionsView,
  }),
];
