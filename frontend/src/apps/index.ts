/**
 * Core apps on the layout engine. Each app folder exports a React-free
 * `manifest.ts` (the server imports it to serve routes) and a `views.ts` with
 * the view definitions; the shell composes them into one registry.
 */
import type { ViewDefinition } from "../layout/define.ts";
import type { KindManifest } from "../layout/types.ts";
import { AGENTS_VIEWS } from "./agents/views.ts";
import { CHAT_VIEWS } from "./chat/views.ts";
import { CONFIGURATION_VIEWS } from "./configuration/views.tsx";
import { DEBUG_KINDS } from "./debug/kinds.ts";
import { DEBUG_VIEWS } from "./debug/views.tsx";
import { DOCUMENTS_KINDS } from "./documents/kinds.ts";
import { DOCUMENTS_VIEWS } from "./documents/views.ts";
import { HOME_VIEWS } from "./home/views.ts";
import { CORE_KINDS } from "./kinds.ts";
import { MESSAGING_VIEWS } from "./messaging/views.ts";
import { PLUGINS_KINDS } from "./plugins/kinds.ts";
import { PLUGINS_VIEWS } from "./plugins/views.tsx";
import { SERVICES_VIEWS } from "./services/views.ts";
import { SETTINGS_VIEWS } from "./settings/views.ts";
import { SOCIAL_VIEWS } from "./social/views.ts";

export { CORE_APPS } from "./manifests.ts";
export const CORE_APP_KINDS: readonly KindManifest[] = [...CORE_KINDS, ...DOCUMENTS_KINDS, ...PLUGINS_KINDS, ...DEBUG_KINDS];
export const CORE_APP_VIEWS: readonly ViewDefinition[] = [
  ...CHAT_VIEWS,
  ...AGENTS_VIEWS,
  ...HOME_VIEWS,
  ...SETTINGS_VIEWS,
  ...CONFIGURATION_VIEWS,
  ...DOCUMENTS_VIEWS,
  ...PLUGINS_VIEWS,
  ...SERVICES_VIEWS,
  ...DEBUG_VIEWS,
  ...MESSAGING_VIEWS,
  ...SOCIAL_VIEWS,
];
