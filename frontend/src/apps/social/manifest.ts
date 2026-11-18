import { Share2 } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Social: write one post and send it to X and Reddit, platform status, and the agent launcher. Chats opened here
 * stay here, at `/social/agent/<id>`. None of its views owns a route.
 *
 * React-free apart from the icon: the server imports it to serve routes.
 */
export const SOCIAL_APP: AppManifest = defineApp({
  id: "social",
  path: "/social",
  shortLabel: "SO",
  iconClass: "text-blue-500",
  gradient: "from-blue-500 to-indigo-600",
  label: "Social",
  description: "Connect and publish to social platforms",
  icon: Share2,
  group: "Operate",
  views: ["social-compose", "social-platforms", "social-sessions", "chat"],
  layoutVersion: 2,
  primaryKind: "widget",
  placement: { agent: "right" },
  layout: {
    split: "row",
    sizes: [3, 2],
    children: [
      { presenter: "tabs", accepts: ["widget"], items: ["social-compose", "social-platforms"], primary: true },
      { presenter: "single", accepts: ["widget"], items: ["social-sessions"] },
    ],
  },
});
