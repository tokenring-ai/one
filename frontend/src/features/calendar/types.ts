export type ViewMode = "month" | "week" | "day";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM (omit for all-day)
  endTime?: string; // HH:MM
  type: "agent" | "workflow" | "calendar";
  agentType?: string;
  workflowKey?: string;
  color: string;
  allDay?: boolean;
  source?: "local" | "rpc";
  description?: string;
  location?: string;
}
