/**
 * React-free app manifests for the layout engine. `frontend/plugin.ts` imports
 * this to serve each app's path (and its aliases) as the SPA shell.
 */
import type { AppManifest } from "../layout/types.ts";
import { AGENTS_APP } from "./agents/manifest.ts";
import { CONFIGURATION_APP } from "./configuration/manifest.ts";
import { DEBUG_APP } from "./debug/manifest.ts";
import { DOCUMENTS_APP } from "./documents/manifest.ts";
import { HOME_APP } from "./home/manifest.ts";
import { MESSAGING_APP } from "./messaging/manifest.ts";
import { PLUGINS_APP } from "./plugins/manifest.ts";
import { SERVICES_APP } from "./services/manifest.ts";
import { SETTINGS_APP } from "./settings/manifest.ts";
import { SOCIAL_APP } from "./social/manifest.ts";

export const CORE_APPS: readonly AppManifest[] = [
  HOME_APP,
  AGENTS_APP,
  DOCUMENTS_APP,
  MESSAGING_APP,
  SOCIAL_APP,
  PLUGINS_APP,
  SERVICES_APP,
  CONFIGURATION_APP,
  DEBUG_APP,
  SETTINGS_APP,
];

/** Every path prefix the server must answer with the SPA shell. */
export const CORE_APP_PATHS: readonly string[] = [
  ...CORE_APPS.flatMap(app => [app.path, ...(app.aliases ?? []).map(alias => `/${alias.path.split("/")[1] ?? ""}`)]),
  // User-saved apps live under /my/<slug>.
  "/my",
];
