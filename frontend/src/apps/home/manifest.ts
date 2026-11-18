import { LayoutDashboard } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Home: running agents first (the welcome guide is a tab beside them), quick
 * launch below, and an accordion of widgets with the log closed until needed. Chats opened here stay here, at
 * `/home/agent/<id>`. Plugins add their own widgets to the accordion through
 * `extends` in their `layout.ts` (metrics, tasks, workflow).
 *
 * React-free apart from the icon: the server imports it to serve routes.
 */
export const HOME_APP: AppManifest = defineApp({
  id: "home",
  path: "/home",
  shortLabel: "HO",
  iconClass: "text-accent",
  gradient: "from-indigo-500 to-violet-600",
  hidden: true,
  label: "Home",
  description: "What your TokenRing instance is doing right now",
  icon: LayoutDashboard,
  group: "System",
  views: ["welcome", "active-agents", "quick-launch", "app-logs", "checkpoints", "chat"],
  primaryKind: "page",
  placement: { agent: "right" },
  // 3: running agents lead; Welcome is a tab beside them, plugin widgets join the side
  // accordion, and Logs starts closed (2 briefly put plugin widgets in the main tabs).
  layoutVersion: 3,
  layout: {
    split: "row",
    sizes: [3, 2],
    children: [
      {
        split: "column",
        sizes: [3, 2],
        children: [
          // Widgets and pages only, so a chat opens beside the agent list (placement) instead of hiding it.
          { presenter: "tabs", accepts: ["widget", "page"], items: ["active-agents", "welcome"], primary: true },
          { presenter: "single", accepts: ["widget"], items: ["quick-launch"] },
        ],
      },
      { presenter: "accordion", accepts: ["widget"], items: ["checkpoints", "app-logs"], collapsed: ["app-logs"] },
    ],
  },
});
