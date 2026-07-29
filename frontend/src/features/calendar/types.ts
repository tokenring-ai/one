export type ViewMode = "month" | "week" | "day";

export type CalendarEventType = "agent" | "workflow" | "calendar";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (omit for all-day)
  endTime?: string; // HH:MM
  type: CalendarEventType;
  agentType?: string;
  workflowKey?: string;
  color: string;
  allDay?: boolean;
  source?: "local" | "rpc";
  /** Calendar provider name for RPC-backed events */
  provider?: string;
  description?: string;
  location?: string;
}
