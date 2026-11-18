import { Package, PackageSearch } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import PluginDetailView from "./PluginDetailView.tsx";
import PluginListView from "./PluginListView.tsx";
import { PLUGIN_DETAIL_VIEW, PLUGIN_LIST_VIEW, PLUGIN_START_VIEW } from "./shared.tsx";

/** `/plugins` with no plugin named: the "select a plugin" state. */
function PluginStartView() {
  return <PluginDetailView params={{}} />;
}

export const PLUGINS_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: PLUGIN_LIST_VIEW,
    kind: "navigator",
    title: "Plugins",
    description: "Installed plugins, searchable and sortable",
    icon: PackageSearch,
    closable: false,
    component: PluginListView,
  }),
  defineView({
    id: PLUGIN_START_VIEW,
    landing: true,
    kind: "plugin",
    title: "Plugin",
    description: "Pick a plugin to inspect",
    icon: Package,
    route: "",
    component: PluginStartView,
  }),
  defineView({
    id: PLUGIN_DETAIL_VIEW,
    kind: "plugin",
    title: params => params.name ?? "Plugin",
    description: "One installed plugin: version, package and configuration",
    icon: Package,
    route: ":name",
    instanceKey: params => params.name ?? "",
    component: PluginDetailView,
  }),
];
