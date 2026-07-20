import { Activity, Bot, CircleSlash, Info, Zap } from "lucide-react";
import type React from "react";
import type { ChatMessage } from "../../../types/agent-events.ts";

export interface EventConfig {
  style: string;
  icon: React.ReactNode;
}

export const events: Record<ChatMessage["type"], EventConfig> = {
  "agent.created": {
    style: "text-success font-medium",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-success" />,
  },
  "agent.stopped": {
    style: "text-error font-medium",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-error" />,
  },
  "agent.status": {
    style: "text-accent",
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-accent" />,
  },
  "agent.response": {
    style: "text-success font-medium",
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
    icon: <span className="text-accent font-bold flex items-center">&gt;</span>,
  },
  "input.execution": {
    style: "text-accent",
    icon: <Activity className="w-[1em] text-accent/70" />,
  },
  "input.interaction": {
    style: "text-success font-medium",
    icon: <span className="text-success font-bold flex items-center">❖</span>,
  },
  cancel: {
    style: "text-error font-medium",
    icon: <CircleSlash className="w-[1em] text-error" />,
  },
  question: {
    style: "text-accent",
    icon: <span className="text-accent font-bold flex items-center">?</span>,
  },
  toolCall: {
    style: "text-primary font-mono",
    icon: <span className="text-accent font-bold flex items-center">●</span>,
  },
};
