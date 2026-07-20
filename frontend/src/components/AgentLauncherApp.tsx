import formatError from "@tokenring-ai/utility/error/formatError";
import { Loader2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { agentRPCClient, useAgentList } from "../rpc.ts";
import AppPageHeader from "./ui/AppPageHeader.tsx";
import { toastManager } from "./ui/toast.tsx";

interface AgentLauncherAppProps {
  /** App name shown in header */
  label: string;
  /** One-line description */
  description: string;
  /** Icon badge (rendered in gradient container) */
  icon: React.ReactNode;
  /** Tailwind gradient classes for the icon badge */
  gradient: string;
  /** Agent type to create when launching */
  agentType: string;
  /** Friendly description of what this agent does, shown in the launch card */
  launchDescription: string;
  /** Label for the launch button */
  launchLabel?: string;
  /** Optional top chrome content rendered above the launch card */
  chrome?: React.ReactNode;
}

export default function AgentLauncherApp({
  label,
  description,
  icon,
  gradient,
  agentType,
  launchDescription,
  launchLabel = "Launch Agent",
  chrome,
}: AgentLauncherAppProps) {
  const navigate = useNavigate();
  const agents = useAgentList();
  const [creating, setCreating] = useState(false);

  const existingAgents = useMemo(() => (agents.data ?? []).filter(agent => agent.agentType === agentType), [agents.data, agentType]);

  const launch = async () => {
    setCreating(true);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType, headless: false });
      await agents.mutate();
      void navigate(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader title={label} subtitle={description} icon={icon} iconGradient={gradient} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Optional chrome (decorative/status UI) */}
          {chrome}

          {/* Existing agents of this type */}
          {existingAgents.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest px-1">Running Sessions</p>
              <div className="space-y-2">
                {existingAgents.map(agent => (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => navigate(`/agent/${agent.id}`)}
                    className="w-full flex items-center gap-3 bg-secondary border border-amber-500/30 px-3 py-2.5 rounded-xl text-left hover:bg-hover hover:border-amber-500/60 transition-all cursor-pointer focus-ring shadow-sm"
                    aria-label={`Open ${agent.displayName}`}
                  >
                    <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                      <div className="text-2xs text-muted truncate mt-0.5">{agent.currentActivity}</div>
                    </div>
                    <div className="text-2xs text-muted">Open →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Launch card */}
          <div className="bg-secondary border border-primary rounded-xl p-6 flex flex-col items-center text-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl bg-linear-to-br ${gradient} flex items-center justify-center shadow-lg [&>svg]:w-8 [&>svg]:h-8 [&>svg]:text-white`}
            >
              {icon}
            </div>
            <div>
              <h2 className="text-base font-semibold text-primary">{label}</h2>
              <p className="text-sm text-muted mt-1 max-w-sm leading-relaxed">{launchDescription}</p>
            </div>
            <button
              type="button"
              onClick={launch}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary"
              aria-label={`Launch ${label} agent`}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Launching...
                </>
              ) : (
                launchLabel
              )}
            </button>
            <p className="text-2xs text-muted">Powered by TokenRing AI agents</p>
          </div>
        </div>
      </div>
    </div>
  );
}
