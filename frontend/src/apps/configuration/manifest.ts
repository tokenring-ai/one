import { SlidersHorizontal } from "lucide-react";
import type { AppManifest } from "../../layout/types.ts";

/** The "connect a model provider" screen. A static segment, so it wins over `/configuration/:plugin`. */
export const AI_PROVIDERS_PATH = "/configuration/ai-providers";

/** The guided "Connect Google" screen (Gmail, Calendar and Google Drive, as chosen). Also a static segment. */
export const CONNECT_GOOGLE_PATH = "/configuration/connect-google";

/**
 * Configuration: the plugin list on the left, one tab per opened plugin.
 * Routes: `/configuration`, `/configuration/ai-providers`, `/configuration/connect-google`, `/configuration/permissions`, `/configuration/users`, `/configuration/<plugin>`
 * (`?scope=workspace` still selects the workspace layer on arrival).
 */
export const CONFIGURATION_APP: AppManifest = {
  id: "configuration",
  path: "/configuration",
  shortLabel: "CO",
  iconClass: "text-amber-500",
  gradient: "from-amber-500 to-orange-600",
  label: "Configuration",
  description: "Configure plugins for your account or this workspace",
  icon: SlidersHorizontal,
  group: "System",
  views: [
    "configuration-plugins",
    "configuration-start",
    "configuration-ai-providers",
    "configuration-connect-google",
    "configuration-permissions",
    "configuration-users",
    "configuration-plugin",
  ],
  primaryKind: "plugin-config",
  layout: {
    split: "row",
    sizes: [1, 3],
    children: [
      { presenter: "single", accepts: ["navigator"], items: ["configuration-plugins"] },
      { presenter: "tabs", accepts: ["plugin-config"], items: ["configuration-start"], primary: true },
    ],
  },
};
