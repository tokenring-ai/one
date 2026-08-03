import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { chatRPCClient, useToolApproval, useToolApprovalLevels } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface ToolApprovalSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

type ToolApprovalMode = "ask" | "reject" | "auto";

const MODES: { mode: ToolApprovalMode; label: string; description: string }[] = [
  { mode: "ask", label: "Ask", description: "Prompt before running the action" },
  { mode: "reject", label: "Reject", description: "Deny the action without prompting" },
  { mode: "auto", label: "Auto", description: "Re-assess with the chat model, then approve or ask" },
];

/** Level 0 is not part of the server's 1–10 classification scale; it means "approve nothing automatically". */
const LEVEL_ZERO_DESCRIPTION = "Nothing is auto-approved — every tool action uses the mode above";

export default function ToolApprovalSelector({ agentId, triggerVariant = "default" }: ToolApprovalSelectorProps) {
  const toolApproval = useToolApproval(agentId);
  const approvalLevels = useToolApprovalLevels();
  const [pending, setPending] = useState<"mode" | "level" | null>(null);
  const isIconTrigger = triggerVariant === "icon";

  const settings = toolApproval.data?.status === "success" ? toolApproval.data : null;
  const currentMode = settings?.toolApprovalMode ?? null;
  const currentLevel = settings?.autoToolApprovalLevel ?? null;

  const levels = [{ level: 0, description: LEVEL_ZERO_DESCRIPTION }, ...(approvalLevels.data?.levels ?? [])];

  const applySettings = useCallback(
    async (update: { toolApprovalMode: ToolApprovalMode } | { autoToolApprovalLevel: number }) => {
      setPending("toolApprovalMode" in update ? "mode" : "level");
      try {
        const result = await chatRPCClient.setToolApproval({ agentId, ...update });
        if (result.status === "agentNotFound") {
          toastManager.error(`Agent not found: ${agentId}`, { duration: 5000 });
          return;
        }
        void toolApproval.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setPending(null);
      }
    },
    [agentId, toolApproval],
  );

  const summary = currentMode && currentLevel != null ? `≤ ${currentLevel} auto · ${currentMode}` : "Tool approval";
  const title =
    currentMode && currentLevel != null ? `Tool approval: auto-approve at or below level ${currentLevel}/10, then ${currentMode}` : "Tool approval settings";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={title}
          title={title}
        >
          <ShieldCheck className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
          {!isIconTrigger && <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">{summary}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        style={{ width: "400px" }}
        aria-label="Tool approval settings"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <span className="text-sm flex-1 font-mono text-muted">Tool Approval</span>
          <span className="text-2xs font-mono text-dim">{settings ? summary : "loading…"}</span>
        </div>

        <div className="border-b border-primary py-1">
          <div className="px-3 pb-1 text-2xs font-mono uppercase text-dim">Mode above auto-approval level</div>
          {MODES.map(({ mode, label, description }) => {
            const isActive = currentMode === mode;
            return (
              <div
                key={mode}
                onClick={e => {
                  e.stopPropagation();
                  if (!isActive) void applySettings({ toolApprovalMode: mode });
                }}
                className="flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group hover:bg-hover"
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${isActive ? "bg-accent shadow-[0_0_6px_rgba(99,102,241,0.5)]" : "bg-muted/50"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-mono leading-tight truncate ${isActive ? "text-accent font-medium" : "text-muted group-hover:text-primary"}`}>
                    {label}
                  </div>
                  <div className="text-2xs text-dim font-mono leading-tight truncate mt-0.5">{description}</div>
                </div>
                {isActive &&
                  (pending === "mode" ? (
                    <Loader2 className="w-3 h-3 text-accent ml-2 shrink-0 animate-spin" aria-label="Saving" />
                  ) : (
                    <Check className="w-3 h-3 text-accent ml-2 shrink-0" aria-label="Selected" />
                  ))}
              </div>
            );
          })}
        </div>

        <div className="px-3 pt-2 pb-1 text-2xs font-mono uppercase text-dim shrink-0">Auto-approve at or below</div>
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-1 space-y-0.5">
          {levels.map(({ level, description }) => {
            const isActive = currentLevel === level;
            return (
              <div
                key={level}
                onClick={e => {
                  e.stopPropagation();
                  if (!isActive) void applySettings({ autoToolApprovalLevel: level });
                }}
                className="flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group hover:bg-hover"
              >
                <span
                  className={`w-5 text-2xs font-mono tabular-nums text-right mr-2.5 shrink-0 ${isActive ? "text-accent font-medium" : "text-dim"}`}
                  aria-hidden="true"
                >
                  {level}
                </span>
                <div
                  className={`flex-1 min-w-0 text-xs font-mono leading-tight truncate ${
                    isActive ? "text-accent font-medium" : "text-muted group-hover:text-primary"
                  }`}
                >
                  {description}
                </div>
                {isActive &&
                  (pending === "level" ? (
                    <Loader2 className="w-3 h-3 text-accent ml-2 shrink-0 animate-spin" aria-label="Saving" />
                  ) : (
                    <Check className="w-3 h-3 text-accent ml-2 shrink-0" aria-label="Selected" />
                  ))}
              </div>
            );
          })}

          {levels.length === 1 && <div className="px-3 py-4 text-center text-xs text-muted">Approval levels unavailable</div>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
