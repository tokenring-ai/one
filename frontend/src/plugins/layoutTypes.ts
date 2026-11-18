import type { ViewDefinition } from "../layout/define.ts";
import type { AppExtension } from "../layout/extend.ts";
import type { AppManifest, KindManifest } from "../layout/types.ts";

/**
 * What a plugin ships for the layout engine, React-free:
 * `plugin/<name>/frontend/layout.ts` default-exports one of these. The server
 * imports it (via `layoutManifests.ts`) to serve each app's path.
 */
export interface PluginLayoutManifest {
  apps: readonly AppManifest[];
  kinds?: readonly KindManifest[];
  /** Views this plugin adds to other apps, such as widgets on Home. */
  extends?: readonly AppExtension[];
}

/** `plugin/<name>/frontend/views.tsx` default-exports one of these. */
export interface PluginLayoutViews {
  views: readonly ViewDefinition[];
}
