import { Activity, Bot, CircleSlash, Info, Zap } from "lucide-react";
import type React from "react";
import type { ChatMessage } from "../../../types/agent-events.ts";

export interface EventConfig {
  style: string;
  icon: React.ReactNode;
}

export const events: Record<ChatMessage["type"], EventConfig> = {
  "agent.created": {
    style: "text-muted text-xs",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-success" />,
  },
  "agent.stopped": {
    style: "text-error font-medium",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-error" />,
  },
  "agent.status": {
    style: "text-accent-soft",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-accent" />,
  },
  "agent.response": {
    style: "text-primary",
    icon: <span className="text-success font-bold flex items-center">✓</span>,
  },
  "output.info": {
    style: "text-secondary",
    icon: <Info className="w-[1em] text-accent/70" />,
  },
  "output.warning": {
    style: "text-warning",
    icon: <Info className="w-[1em] text-warning/70" />,
  },
  "output.error": {
    style: "text-error",
    icon: <Info className="w-[1em] text-error/70" />,
  },
  "output.chat": {
    style: "text-primary",
    icon: <Bot className="w-[1em] text-muted" />,
  },
  "output.reasoning": {
    style: "text-secondary italic",
    icon: <Zap className="w-[1em] text-warning" />,
  },
  "input.received": {
    style: "text-primary font-medium",
    icon: <span className="text-accent-soft font-bold flex items-center">&gt;</span>,
  },
  "input.execution": {
    style: "text-accent-soft",
    icon: <Activity className="w-[1em] text-accent/70" />,
  },
  "input.interaction": {
    style: "text-primary",
    icon: <span className="text-success font-bold flex items-center">❖</span>,
  },
  cancel: {
    style: "text-error font-medium",
    icon: <CircleSlash className="w-[1em] text-error" />,
  },
  question: {
    style: "text-accent-soft",
    icon: <span className="text-accent-soft font-bold flex items-center">?</span>,
  },
  // Routine: quiet text, and the colour is saved for the outcome (a failed call turns red).
  toolCall: {
    style: "text-secondary text-sm",
    icon: <span className="text-dim flex items-center text-[0.7em]">●</span>,
  },
};
