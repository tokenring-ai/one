import { Camera, FileJson, Layers } from "lucide-react";
import { defineView, type ViewDefinition } from "../../layout/define.ts";
import DebugCaptureView from "./DebugCaptureView.tsx";
import DebugSnapshotsView from "./DebugSnapshotsView.tsx";
import DebugSnapshotView from "./DebugSnapshotView.tsx";
import { DEBUG_CAPTURE_VIEW, DEBUG_SNAPSHOT_VIEW, DEBUG_SNAPSHOTS_VIEW, DEBUG_START_VIEW } from "./shared.tsx";

/** `/debug` with no snapshot: the "select a snapshot" state, closed once one opens. */
function DebugStartView() {
  return <DebugSnapshotView params={{}} />;
}

export const DEBUG_VIEWS: readonly ViewDefinition[] = [
  defineView({
    id: DEBUG_CAPTURE_VIEW,
    kind: "navigator",
    title: "Debug capture",
    description: "Snapshot app and agent state, once or on an interval",
    icon: Camera,
    closable: false,
    component: DebugCaptureView,
  }),
  defineView({
    id: DEBUG_SNAPSHOTS_VIEW,
    kind: "navigator",
    title: "Snapshots",
    description: "Captured debug snapshots, with delete and refresh",
    icon: Layers,
    closable: false,
    component: DebugSnapshotsView,
  }),
  defineView({
    id: DEBUG_START_VIEW,
    landing: true,
    kind: "debug-snapshot",
    title: "Snapshot",
    description: "Pick a snapshot to inspect",
    icon: FileJson,
    route: "",
    component: DebugStartView,
  }),
  defineView({
    id: DEBUG_SNAPSHOT_VIEW,
    kind: "debug-snapshot",
    title: params => params.snapshotId ?? "Snapshot",
    description: "Inspect one captured snapshot",
    icon: FileJson,
    route: ":snapshotId",
    instanceKey: params => params.snapshotId ?? "",
    component: DebugSnapshotView,
  }),
];
