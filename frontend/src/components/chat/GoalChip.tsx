import type { GoalSnapshot } from "@tokenring-ai/goal/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Goal as GoalIcon, Loader2, Pause, Play, Square } from "lucide-react";
import { useCallback, useState } from "react";
import { requireAgentFound } from "../../lib/requireAgentFound.ts";
import { agentRPCClient, goalRPCClient, useGoal } from "../../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu.tsx";
import { toastManager } from "../ui/toast.tsx";

interface GoalChipProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

const STATUS_STYLES: Record<GoalSnapshot["status"], { label: string; className: string }> = {
  active: { label: "active", className: "text-accent-soft" },
  paused: { label: "paused", className: "text-warning" },
  completed: { label: "completed", className: "text-success" },
  blocked: { label: "blocked", className: "text-error" },
  stopped: { label: "stopped", className: "text-dim" },
};

/** Live goal-mode chip: shows the active goal, its turn budget usage, and the verifier's last verdict. */
export default function GoalChip({ agentId, triggerVariant = "default" }: GoalChipProps) {
  const goalStream = useGoal(agentId);
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const isIconTrigger = triggerVariant === "icon";

  const goal = goalStream.data?.status === "success" ? goalStream.data.goal : null;
  const known = goalStream.data !== undefined || goalStream.error !== undefined;

  const runAction = useCallback(
    async (command: string) => {
      setPending(command);
      try {
        requireAgentFound(await agentRPCClient.sendInput({ agentId, input: { from: "Goal controls", message: command } }));
        void goalStream.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setPending(null);
      }
    },
    [agentId, goalStream],
  );

  const applyGoal = useCallback(
    async (next: string) => {
      const clearing = next.trim().length === 0;
      setPending(clearing ? "clear" : "set");
      try {
        const result = await goalRPCClient.setGoal({ agentId, goal: clearing ? "" : next.trim() });
        if (result.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
          return;
        }
        if (clearing) setDraft("");
        void goalStream.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setPending(null);
      }
    },
    [agentId, goalStream],
  );

  if (!known) return null;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setDraft(goal?.text ?? "");
  };

  const status = goal ? STATUS_STYLES[goal.status] : null;
  const summary = status ? `Goal · ${goal?.attempts}/${goal?.maxTurns} · ${status.label}` : "Set a goal";
  const verdict = goal?.lastVerdict;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={summary}
          title={summary}
        >
          <GoalIcon className={`${isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5"} ${status?.className ?? "text-muted"}`} />
          {!isIconTrigger && <span className={`text-xs font-mono truncate max-w-48 ${status?.className ?? "text-muted"}`}>{summary}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        style={{ width: "420px" }}
        aria-label="Goal status"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <GoalIcon className="w-4 h-4 text-muted shrink-0" />
          <span className="text-sm flex-1 font-mono text-muted">Goal</span>
          {status ? <span className={`text-xs font-mono ${status.className}`}>{status.label}</span> : null}
        </div>

        <div className="px-3 py-2 space-y-2 overflow-y-auto custom-scrollbar">
          {goal ? (
            <div className="text-xs font-mono text-dim">
              Turns {goal.attempts} / {goal.maxTurns}
            </div>
          ) : (
            <p className="text-xs text-muted">No goal is set. The agent works toward one until it is achieved, blocked, or stopped.</p>
          )}

          <label className="block">
            <span className="text-xs font-mono uppercase text-dim mb-1 block">Goal</span>
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              rows={3}
              aria-label="Goal text"
              placeholder="Describe the outcome you want"
              className="w-full bg-input border border-control rounded-md px-2 py-1.5 text-xs font-mono text-primary placeholder-muted focus-ring resize-y"
            />
          </label>

          {verdict && (
            <div className="border-t border-primary pt-2">
              <div className="text-xs font-mono uppercase text-dim mb-1">Last verdict</div>
              <div
                className={`text-xs font-mono ${verdict.status === "achieved" ? "text-success" : verdict.status === "blocked" ? "text-error" : "text-accent-soft"}`}
              >
                {verdict.status}
              </div>
              <div className="text-xs text-muted leading-snug mt-1">{verdict.reasoning}</div>
              {verdict.guidance && (
                <div className="text-xs text-dim leading-snug mt-1">
                  <span className="font-mono uppercase text-dim">Guidance: </span>
                  {verdict.guidance}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-primary shrink-0">
          <button
            type="button"
            onClick={() => void applyGoal(draft)}
            disabled={pending !== null || draft.trim().length === 0}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50 cursor-pointer"
          >
            {pending === "set" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Set goal
          </button>
          {goal ? (
            <button
              type="button"
              onClick={() => void applyGoal("")}
              disabled={pending !== null}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-error hover:bg-hover transition-colors focus-ring disabled:opacity-50 cursor-pointer"
            >
              {pending === "clear" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
              Clear goal
            </button>
          ) : null}
        </div>

        {goal && (goal.status === "active" || goal.status === "paused") && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-primary shrink-0">
            {goal.status === "active" ? (
              <button
                type="button"
                onClick={() => void runAction("/goal pause")}
                disabled={pending !== null}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50 cursor-pointer"
              >
                {pending === "/goal pause" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runAction("/goal resume")}
                disabled={pending !== null}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50 cursor-pointer"
              >
                {pending === "/goal resume" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={() => void runAction("/goal stop")}
              disabled={pending !== null}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono text-error hover:bg-hover transition-colors focus-ring disabled:opacity-50 cursor-pointer"
            >
              {pending === "/goal stop" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
              Stop
            </button>
            <span className="flex-1" aria-hidden="true" />
            <Check className="w-3 h-3 text-dim" aria-hidden="true" />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
