import { Plug } from "lucide-react";
import { defineApp } from "../../layout/define.ts";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Services: tools beside models, with hooks and the app log tabbed under them.
 * One route (`/services`); the panels are widgets and never own the URL. The
 * Logs tab is Home's `app-logs` widget.
 */
export const SERVICES_APP: AppManifest = defineApp({
  id: "services",
  path: "/services",
  shortLabel: "SV",
  iconClass: "text-violet-500",
  gradient: "from-violet-500 to-purple-600",
  label: "Services",
  description: "Tools, models, hooks, and integrations",
  icon: Plug,
  group: "System",
  views: ["services-tools", "services-models", "services-hooks", "app-logs"],
  primaryKind: "widget",
  layout: {
    split: "row",
    sizes: [1, 1],
    children: [
      { presenter: "single", accepts: ["widget"], items: ["services-tools"], primary: true },
      {
        split: "column",
        sizes: [1, 1],
        children: [
          { presenter: "single", accepts: ["widget"], items: ["services-models"] },
          { presenter: "tabs", accepts: ["widget"], items: ["services-hooks", "app-logs"] },
        ],
      },
    ],
  },
});
