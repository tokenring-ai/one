import { Settings } from "lucide-react";
import type { AppManifest } from "../../layout/types.ts";

/** Settings: one page with every section (appearance, layout, confirmations, data, about). */
export const SETTINGS_APP: AppManifest = {
  id: "settings",
  path: "/settings",
  shortLabel: "SE",
  iconClass: "text-stone-400",
  gradient: "from-stone-500 to-gray-600",
  label: "Settings",
  description: "Configure theme, dashboards, and preferences",
  icon: Settings,
  group: "System",
  views: ["settings"],
  primaryKind: "page",
  layout: { presenter: "single", accepts: ["page"], items: ["settings"], primary: true },
};
