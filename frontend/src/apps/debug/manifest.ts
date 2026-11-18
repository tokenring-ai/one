import { Bug } from "lucide-react";
import type { AppManifest } from "../../layout/types.ts";

/**
 * Debugging: capture controls above the snapshot list on the left, one tab per
 * opened snapshot on the right. Routes: `/debug`, `/debug/<snapshot>`.
 */
export const DEBUG_APP: AppManifest = {
  id: "debug",
  path: "/debug",
  shortLabel: "DE",
  iconClass: "text-rose-500",
  gradient: "from-rose-500 to-red-600",
  label: "Debugging",
  description: "Capture and inspect app and agent state",
  icon: Bug,
  group: "System",
  views: ["debug-capture", "debug-snapshots", "debug-start", "debug-snapshot"],
  primaryKind: "debug-snapshot",
  layout: {
    split: "row",
    sizes: [1, 3],
    children: [
      {
        split: "column",
        sizes: [1, 1],
        children: [
          { presenter: "single", accepts: ["navigator"], items: ["debug-capture"] },
          { presenter: "single", accepts: ["navigator"], items: ["debug-snapshots"] },
        ],
      },
      { presenter: "tabs", accepts: ["debug-snapshot"], items: ["debug-start"], primary: true },
    ],
  },
};
