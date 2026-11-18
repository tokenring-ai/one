import { Settings } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import SettingsView from "./SettingsView.tsx";

export const SETTINGS_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: "settings",
    kind: "page",
    title: "Settings",
    description: "Theme, layout, confirmations, storage and about in one page",
    icon: Settings,
    route: "",
    closable: false,
    component: SettingsView,
  }),
];
