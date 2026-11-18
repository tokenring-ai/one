/**
 * Plugin apps: their React-free app and kind manifests. A plugin that ships
 * apps is listed here and in `layoutViews.ts` (see docs/plugin-apps.md).
 */

import blogLayout from "@tokenring-ai/blog/frontend/layout.ts";
import botLayout from "@tokenring-ai/bot/frontend/layout.ts";
import browserLayout from "@tokenring-ai/browser/frontend/layout.ts";
import calendarLayout from "@tokenring-ai/calendar/frontend/layout.ts";
import cloudquoteLayout from "@tokenring-ai/cloudquote/frontend/layout.ts";
import databaseLayout from "@tokenring-ai/database/frontend/layout.ts";
import emailLayout from "@tokenring-ai/email/frontend/layout.ts";
import filesystemLayout from "@tokenring-ai/filesystem/frontend/layout.ts";
import githubLayout from "@tokenring-ai/github/frontend/layout.ts";
import marketplaceLayout from "@tokenring-ai/marketplace/frontend/layout.ts";
import mediaLibraryLayout from "@tokenring-ai/media-library/frontend/layout.ts";
import memoryLayout from "@tokenring-ai/memory/frontend/layout.ts";
import metricsLayout from "@tokenring-ai/metrics/frontend/layout.ts";
import monitorLayout from "@tokenring-ai/monitor/frontend/layout.ts";
import newsletterLayout from "@tokenring-ai/newsletter/frontend/layout.ts";
import queueLayout from "@tokenring-ai/queue/frontend/layout.ts";
import researchLayout from "@tokenring-ai/research/frontend/layout.ts";
import schedulerLayout from "@tokenring-ai/scheduler/frontend/layout.ts";
import skillsLayout from "@tokenring-ai/skills/frontend/layout.ts";
import tasksLayout from "@tokenring-ai/tasks/frontend/layout.ts";
import terminalLayout from "@tokenring-ai/terminal/frontend/layout.ts";
import vaultLayout from "@tokenring-ai/vault/frontend/layout.ts";
import webDesignLayout from "@tokenring-ai/web-design/frontend/layout.ts";
import workflowLayout from "@tokenring-ai/workflow/frontend/layout.ts";
import type { AppExtension } from "../layout/extend.ts";
import type { AppManifest, KindManifest } from "../layout/types.ts";
import type { PluginLayoutManifest } from "./layoutTypes.ts";

const PLUGIN_LAYOUTS: readonly PluginLayoutManifest[] = [
  marketplaceLayout,
  skillsLayout,
  vaultLayout,
  researchLayout,
  schedulerLayout,
  monitorLayout,
  memoryLayout,
  blogLayout,
  browserLayout,
  terminalLayout,
  metricsLayout,
  newsletterLayout,
  queueLayout,
  calendarLayout,
  emailLayout,
  databaseLayout,
  mediaLibraryLayout,
  workflowLayout,
  filesystemLayout,
  botLayout,
  cloudquoteLayout,
  webDesignLayout,
  tasksLayout,
  githubLayout,
];

export const PLUGIN_LAYOUT_APPS: readonly AppManifest[] = PLUGIN_LAYOUTS.flatMap(layout => layout.apps);
export const PLUGIN_LAYOUT_KINDS: readonly KindManifest[] = PLUGIN_LAYOUTS.flatMap(layout => layout.kinds ?? []);
/** Views plugins add to apps they don't own (widgets on Home). */
export const PLUGIN_APP_EXTENSIONS: readonly AppExtension[] = PLUGIN_LAYOUTS.flatMap(layout => layout.extends ?? []);

/** Path prefixes the server answers with the SPA shell for plugin apps (paths and alias prefixes). */
export const PLUGIN_LAYOUT_APP_PATHS: readonly string[] = PLUGIN_LAYOUT_APPS.flatMap(app => [
  app.path,
  ...(app.aliases ?? []).map(alias => `/${alias.path.split("/")[1] ?? ""}`),
]);
