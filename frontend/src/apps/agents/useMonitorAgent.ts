import { MONITOR_CREATE_VIEW_ID } from "@tokenring-ai/monitor/frontend/ids.ts";
import { useCallback } from "react";
import { usePaneLink } from "../../layout/hooks.ts";

/** "Monitor this agent": opens the Monitors app's create form with the agent already chosen. */
export function useMonitorAgent(): (agentId: string) => void {
  const open = usePaneLink();
  return useCallback((agentId: string) => open(MONITOR_CREATE_VIEW_ID, { kind: "agent", target: agentId }), [open]);
}
