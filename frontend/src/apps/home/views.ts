import { Cpu, History, Rocket, ScrollText, Sparkles } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import ActiveAgentsView from "./ActiveAgentsView.tsx";
import AppLogsView from "./AppLogsView.tsx";
import CheckpointsView from "./CheckpointsView.tsx";
import QuickLaunchView from "./QuickLaunchView.tsx";
import WelcomeView, { WELCOME_VIEW_ID } from "./WelcomeView.tsx";

/** Core Home views. None owns a route: Home's only routable item is a chat. */
export const HOME_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: WELCOME_VIEW_ID,
    kind: "page",
    title: "Welcome",
    description: "Getting started: model provider status, agents and the marketplace",
    icon: Sparkles,
    closable: true,
    component: WelcomeView,
  }),
  defineView({
    id: "active-agents",
    kind: "widget",
    title: "Active agents",
    description: "Running agents and what each one is doing",
    icon: Cpu,
    component: ActiveAgentsView,
  }),
  defineView({
    id: "quick-launch",
    kind: "widget",
    title: "Quick launch",
    description: "Launch a new agent of any installed type",
    icon: Rocket,
    component: QuickLaunchView,
  }),
  defineView({
    id: "app-logs",
    kind: "widget",
    title: "Logs",
    description: "Live application log from the running instance",
    icon: ScrollText,
    component: AppLogsView,
  }),
  defineView({
    id: "checkpoints",
    kind: "widget",
    title: "Checkpoints",
    description: "Saved agent checkpoints you can restore from",
    icon: History,
    component: CheckpointsView,
  }),
];
