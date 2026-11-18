import { useCallback } from "react";
import ErrorBanner from "../../components/ui/ErrorBanner.tsx";
import { useLayoutApi, useLayoutState } from "../../layout/context.ts";
import { useLayout, usePaneLink } from "../../layout/hooks.ts";
import { panelKey } from "../../layout/model.ts";

/** Vocabulary shared by the Plugins views. Selection lives in the URL. */

export const PLUGINS_PATH = "/plugins";

export const PLUGIN_LIST_VIEW = "plugin-list";
export const PLUGIN_START_VIEW = "plugin-start";
export const PLUGIN_DETAIL_VIEW = "plugin-detail";

export type InstalledPlugin = {
  name: string;
  displayName: string;
  version: string;
  description: string;
  hasConfig: boolean;
  services: string[];
  tools: string[];
  commands: string[];
  rpcMethods: string[];
};

export function pluginPath(name?: string | null): string {
  return name ? `${PLUGINS_PATH}/${encodeURIComponent(name)}` : PLUGINS_PATH;
}

export function packageShortName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

export function configurationPath(pluginName: string): string {
  return `/configuration/${encodeURIComponent(pluginName)}`;
}

/** True while a detail panel for `name` is open in this app. */
export function usePluginDetailOpen(name: string | null): boolean {
  const api = useLayoutApi();
  const state = useLayoutState();
  if (name === null) return false;
  const info = api.registry.lookup(PLUGIN_DETAIL_VIEW);
  return !!info && !!state.panels[panelKey(PLUGIN_DETAIL_VIEW, { name }, info.instanceKey)];
}

/**
 * Selecting a plugin opens its detail panel (and so navigates to it); the
 * "select a plugin" tab has done its job then and closes. Deselecting closes
 * the panel and returns to the bare `/plugins` route.
 */
export function usePluginsNavigation() {
  const open = usePaneLink();
  const layout = useLayout();

  const openPlugin = useCallback(
    (name: string) => {
      open(PLUGIN_DETAIL_VIEW, { name });
    },
    [open, layout],
  );

  const closePlugin = useCallback(
    (name: string) => {
      open(PLUGIN_START_VIEW, {});
      layout.close(PLUGIN_DETAIL_VIEW, { name });
    },
    [open, layout],
  );

  return { openPlugin, closePlugin };
}

/**
 * Shown once a configuration change touched a plugin that cannot be
 * reconfigured while running: the app keeps the old settings for it until it
 * restarts. The server flag is sticky, so the notice stays until then.
 */
export function RestartRequiredNotice({ requiresRestart, className }: { requiresRestart: boolean | undefined; className?: string }) {
  if (!requiresRestart) return null;
  return (
    <ErrorBanner
      variant="warning"
      title="Restart required"
      message="A configuration change affects a plugin that cannot be updated while TokenRing is running. Restart TokenRing to fully apply it."
      className={className ?? "rounded-lg border border-warning/30"}
      data-testid="plugins-restart-required"
    />
  );
}
