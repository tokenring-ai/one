import { List, Mail, Plug, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import AIProvidersView from "./AIProvidersView.tsx";
import ConfigurationPluginsView from "./ConfigurationPluginsView.tsx";
import ConfigurationPluginView from "./ConfigurationPluginView.tsx";
import ConnectGoogleView from "./ConnectGoogleView.tsx";
import PermissionsView from "./PermissionsView.tsx";
import {
  AI_PROVIDERS_VIEW,
  CONFIGURATION_PLUGIN_VIEW,
  CONFIGURATION_PLUGINS_VIEW,
  CONFIGURATION_START_VIEW,
  CONNECT_GOOGLE_VIEW,
  PERMISSIONS_VIEW,
  USERS_VIEW,
} from "./shared.tsx";
import UsersView from "./UsersView.tsx";

/** `/configuration` with no plugin: the editor's "choose a plugin" state. */
function ConfigurationStartView() {
  return <ConfigurationPluginView params={{}} />;
}

export const CONFIGURATION_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: CONFIGURATION_PLUGINS_VIEW,
    kind: "navigator",
    title: "Plugins",
    description: "Configurable plugins, with the scope switch and override markers",
    icon: List,
    closable: false,
    component: ConfigurationPluginsView,
  }),
  defineView({
    id: CONFIGURATION_START_VIEW,
    landing: true,
    kind: "plugin-config",
    title: "Configuration",
    description: "Pick a plugin to configure",
    icon: SlidersHorizontal,
    route: "",
    component: ConfigurationStartView,
  }),
  defineView({
    id: AI_PROVIDERS_VIEW,
    kind: "plugin-config",
    title: "AI providers",
    description: "Connect a model provider: paste an API key, point at a local server, or add a custom one",
    icon: Plug,
    route: "ai-providers",
    component: AIProvidersView,
  }),
  defineView({
    id: CONNECT_GOOGLE_VIEW,
    kind: "plugin-config",
    title: "Connect Google",
    description: "Connect your Google account and choose whether TokenRing uses Gmail, Google Calendar and Google Drive",
    icon: Mail,
    route: "connect-google",
    component: ConnectGoogleView,
  }),
  defineView({
    id: PERMISSIONS_VIEW,
    kind: "plugin-config",
    title: "Permissions",
    description: "Actions you chose to always allow, and how to take them back",
    icon: ShieldCheck,
    route: "permissions",
    component: PermissionsView,
  }),
  defineView({
    id: USERS_VIEW,
    kind: "plugin-config",
    title: "Users",
    description: "Who can sign in, and signing yourself in on your phone",
    icon: Users,
    route: "users",
    component: UsersView,
  }),
  defineView({
    id: CONFIGURATION_PLUGIN_VIEW,
    kind: "plugin-config",
    title: params => params.plugin ?? "Configuration",
    description: "Override one plugin's settings for the selected scope",
    icon: SlidersHorizontal,
    route: ":plugin",
    instanceKey: params => params.plugin ?? "",
    component: ConfigurationPluginView,
  }),
];
