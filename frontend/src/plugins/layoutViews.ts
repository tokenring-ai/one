/** Views of plugins that ship apps (see `layoutManifests.ts`). */

import blogViews from "@tokenring-ai/blog/frontend/views.tsx";
import botViews from "@tokenring-ai/bot/frontend/views.tsx";
import browserViews from "@tokenring-ai/browser/frontend/views.tsx";
import calendarViews from "@tokenring-ai/calendar/frontend/views.tsx";
import cloudquoteViews from "@tokenring-ai/cloudquote/frontend/views.tsx";
import databaseViews from "@tokenring-ai/database/frontend/views.tsx";
import emailViews from "@tokenring-ai/email/frontend/views.tsx";
import filesystemViews from "@tokenring-ai/filesystem/frontend/views.tsx";
import githubViews from "@tokenring-ai/github/frontend/views.tsx";
import marketplaceViews from "@tokenring-ai/marketplace/frontend/views.tsx";
import mediaLibraryViews from "@tokenring-ai/media-library/frontend/views.tsx";
import memoryViews from "@tokenring-ai/memory/frontend/views.tsx";
import metricsViews from "@tokenring-ai/metrics/frontend/views.tsx";
import monitorViews from "@tokenring-ai/monitor/frontend/views.tsx";
import newsletterViews from "@tokenring-ai/newsletter/frontend/views.tsx";
import queueViews from "@tokenring-ai/queue/frontend/views.tsx";
import researchViews from "@tokenring-ai/research/frontend/views.tsx";
import schedulerViews from "@tokenring-ai/scheduler/frontend/views.tsx";
import skillsViews from "@tokenring-ai/skills/frontend/views.tsx";
import tasksViews from "@tokenring-ai/tasks/frontend/views.tsx";
import terminalViews from "@tokenring-ai/terminal/frontend/views.tsx";
import vaultViews from "@tokenring-ai/vault/frontend/views.tsx";
import webDesignViews from "@tokenring-ai/web-design/frontend/views.tsx";
import workflowViews from "@tokenring-ai/workflow/frontend/views.tsx";
import type { ViewDefinition } from "../layout/define.ts";
import type { PluginLayoutViews } from "./layoutTypes.ts";

const PLUGIN_VIEW_SETS: readonly PluginLayoutViews[] = [
  marketplaceViews,
  skillsViews,
  vaultViews,
  researchViews,
  schedulerViews,
  monitorViews,
  memoryViews,
  blogViews,
  browserViews,
  terminalViews,
  metricsViews,
  newsletterViews,
  queueViews,
  calendarViews,
  emailViews,
  databaseViews,
  mediaLibraryViews,
  workflowViews,
  filesystemViews,
  botViews,
  cloudquoteViews,
  webDesignViews,
  tasksViews,
  githubViews,
];

export const PLUGIN_LAYOUT_VIEWS: readonly ViewDefinition[] = PLUGIN_VIEW_SETS.flatMap(set => set.views);
