import { Cpu, History, List, Play, Plus, Rocket, Workflow } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import CheckpointsView from "../home/CheckpointsView.tsx";
import AgentJobsView from "./AgentJobsView.tsx";
import AgentLaunchView from "./AgentLaunchView.tsx";
import AgentListView from "./AgentListView.tsx";
import AgentsStartView from "./AgentsStartView.tsx";
import { AgentTypeCreateView, AgentTypeDetailView } from "./AgentTypeEditorViews.tsx";
import {
  AGENT_CHECKPOINTS_VIEW,
  AGENT_JOBS_VIEW,
  AGENT_LAUNCH_VIEW,
  AGENT_LIST_VIEW,
  AGENT_TYPE_CREATE_VIEW,
  AGENT_TYPE_DETAIL_VIEW,
  AGENTS_START_VIEW,
} from "./shared.tsx";

/** Views of the Agents app. The chat view lives in `apps/chat` because every app hosts it. */
export const AGENTS_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: AGENT_LIST_VIEW,
    kind: "navigator",
    title: "Running",
    description: "Running agents, the ones waiting on you first, with their todo lists",
    icon: List,
    closable: false,
    component: AgentListView,
  }),
  defineView({
    id: AGENT_CHECKPOINTS_VIEW,
    kind: "navigator",
    title: "Checkpoints",
    description: "Recent agent checkpoints; relaunch one as a new agent",
    icon: History,
    closable: false,
    component: CheckpointsView,
  }),
  defineView({
    id: AGENT_LAUNCH_VIEW,
    kind: "navigator",
    title: "Launch",
    description: "Launch a new agent of any installed type",
    icon: Rocket,
    closable: false,
    component: AgentLaunchView,
  }),
  defineView({
    id: AGENTS_START_VIEW,
    kind: "page",
    title: "Agent types",
    description: "Pick an agent type and launch it",
    icon: Play,
    route: "",
    // Gives way to the chat as soon as one opens; back at `/agents` it returns.
    landing: true,
    component: AgentsStartView,
  }),
  defineView({
    id: AGENT_TYPE_CREATE_VIEW,
    kind: "agent-type",
    title: "New agent type",
    description: "Create a workspace agent type",
    icon: Plus,
    // A static segment, so it outranks `:agentType`; `new` is a reserved type name.
    route: "new",
    component: AgentTypeCreateView,
  }),
  defineView({
    id: AGENT_JOBS_VIEW,
    kind: "page",
    title: "Agent jobs",
    description: "Agents run unattended by Tasks, Queues, Workflows and the Scheduler: status, cost, lineage and Cancel",
    icon: Workflow,
    // A static segment, so it outranks `:agentType`; `jobs` is a reserved type name.
    route: "jobs",
    component: AgentJobsView,
  }),
  defineView({
    id: AGENT_TYPE_DETAIL_VIEW,
    kind: "agent-type",
    title: params => params.agentType ?? "Agent type",
    description: "View or edit one configured agent type",
    icon: Cpu,
    route: ":agentType",
    instanceKey: params => params.agentType ?? "",
    component: AgentTypeDetailView,
  }),
];
