import { Package } from "lucide-react";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Plugins: the searchable list on the left, one tab per inspected plugin.
 * Routes: `/plugins` (the "select a plugin" tab), `/plugins/<name>`.
 */
export const PLUGINS_APP: AppManifest = {
  id: "plugins",
  path: "/plugins",
  shortLabel: "PL",
  iconClass: "text-fuchsia-500",
  gradient: "from-fuchsia-500 to-pink-600",
  label: "Plugins",
  description: "Browse installed plugins and their configuration",
  icon: Package,
  group: "System",
  views: ["plugin-list", "plugin-start", "plugin-detail"],
  primaryKind: "plugin",
  layout: {
    split: "row",
    sizes: [3, 2],
    children: [
      { presenter: "single", accepts: ["navigator"], items: ["plugin-list"] },
      { presenter: "tabs", accepts: ["plugin"], items: ["plugin-start"], primary: true },
    ],
  },
};
