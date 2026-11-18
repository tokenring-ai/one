import { Cpu } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * The Agents app: a sidebar of tabs on the left (running agents, checkpoints, launch), and the main area for what you
 * work on: agent chats, and agent types opened from the Start page (which
 * gives way to the first chat). Community agents are in the Marketplace app.
 * Routes: `/agents` (Start), `/agents/new`, `/agents/jobs` (unattended agent jobs), `/agents/<type>`, and the
 * canonical chat URL `/agent/<id>`.
 *
 * React-free apart from the icon: the server imports it to serve routes.
 */
export const AGENTS_APP: AppManifest = defineApp({
  id: "agents",
  path: "/agents",
  shortLabel: "AG",
  iconClass: "text-amber-500",
  gradient: "from-amber-500 to-orange-600",
  defaultPinned: true,
  label: "Agents",
  description: "Create and manage AI agents",
  icon: Cpu,
  group: "Build",
  views: ["agent-list", "agent-checkpoints", "agent-launch", "agents-start", "agent-type-create", "agent-type-detail", "agent-jobs", "chat"],
  primaryKind: "agent",
  // 2: chats moved into the main area. 3: the sidebar became Running / Checkpoints / Launch tabs.
  layoutVersion: 3,
  aliases: [{ path: "/agent/:agentId", view: "chat" }],
  layout: {
    split: "row",
    // Wide enough for the sidebar's three tabs.
    sizes: [1, 3],
    children: [
      { presenter: "tabs", accepts: ["navigator"], items: ["agent-list", "agent-checkpoints", "agent-launch"] },
      { presenter: "tabs", accepts: ["agent", "agent-type", "page"], items: ["agents-start"], primary: true },
    ],
  },
});
