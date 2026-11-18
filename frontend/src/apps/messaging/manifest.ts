import { MessageSquare } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Messaging: the overview beside live conversations, with email and channels
 * tabbed beneath them. One route, `/messaging`; no view owns a URL of its own.
 *
 * React-free apart from the icon: the server imports it to serve routes.
 */
export const MESSAGING_APP: AppManifest = defineApp({
  id: "messaging",
  path: "/messaging",
  shortLabel: "MS",
  iconClass: "text-teal-500",
  gradient: "from-teal-500 to-emerald-600",
  label: "Messaging",
  description: "Unified activity across connected channels",
  icon: MessageSquare,
  group: "Operate",
  views: ["messaging-overview", "messaging-conversations", "messaging-email", "messaging-channels"],
  primaryKind: "page",
  layout: {
    split: "row",
    sizes: [3, 2],
    children: [
      { presenter: "single", accepts: ["page"], items: ["messaging-overview"], primary: true },
      {
        split: "column",
        children: [
          { presenter: "single", accepts: ["widget"], items: ["messaging-conversations"] },
          { presenter: "tabs", accepts: ["widget"], items: ["messaging-email", "messaging-channels"] },
        ],
      },
    ],
  },
});
