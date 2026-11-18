import { Cpu, Wrench, Zap } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import ServicesHooksView from "./ServicesHooksView.tsx";
import ServicesModelsView from "./ServicesModelsView.tsx";
import ServicesToolsView from "./ServicesToolsView.tsx";

export const SERVICES_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: "services-tools",
    kind: "widget",
    title: "Tools",
    description: "Which tools the selected agent may call",
    icon: Wrench,
    component: ServicesToolsView,
  }),
  defineView({
    id: "services-models",
    kind: "widget",
    title: "Models",
    description: "Chat, embedding, transcription, and reranking models",
    icon: Cpu,
    component: ServicesModelsView,
  }),
  defineView({
    id: "services-hooks",
    kind: "widget",
    title: "Hooks",
    description: "Which lifecycle hooks run for the selected agent",
    icon: Zap,
    component: ServicesHooksView,
  }),
];
