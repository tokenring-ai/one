import formatError from "@tokenring-ai/utility/error/formatError";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { chatRPCClient, useToolApproval, useToolApprovalLevels } from "../../rpc.ts";
import Select from "../../ui/select.tsx";

type ToolApprovalMode = "ask" | "reject" | "auto";

/** Same vocabulary as the chat footer's ToolApprovalSelector. */
export const TOOL_APPROVAL_MODES: { mode: ToolApprovalMode; label: string; description: string }[] = [
  { mode: "ask", label: "Ask", description: "Ask me first" },
  { mode: "reject", label: "Reject", description: "Say no without asking me" },
  { mode: "auto", label: "Auto", description: "The AI judges the risk, then goes ahead or asks me" },
];

/** Level 0 is not on the server's 1–10 scale; it means "approve nothing automatically". */
const LEVEL_ZERO = { level: 0, description: "Nothing goes ahead without asking" };

/**
 * How the selected agent approves tool calls: risky actions above the
 * auto-approve level follow the mode. Approval is agent-wide — the chat
 * service classifies each call's risk at run time, so there is no stored
 * per-tool level to edit.
 */
export default function ToolApprovalControls({ agentId, onAgentGone }: { agentId: string; onAgentGone?: () => void }) {
  const approval = useToolApproval(agentId);
  const levels = useToolApprovalLevels();
  const [pending, setPending] = useState<"mode" | "level" | null>(null);

  const settings = approval.data?.status === "success" ? approval.data : null;
  const allLevels = [LEVEL_ZERO, ...(levels.data?.levels ?? [])];

  const apply = async (update: { toolApprovalMode: ToolApprovalMode } | { autoToolApprovalLevel: number }) => {
    setPending("toolApprovalMode" in update ? "mode" : "level");
    try {
      const result = await chatRPCClient.setToolApproval({ agentId, ...update });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
        onAgentGone?.();
        return;
      }
      await approval.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setPending(null);
    }
  };

  const disabled = !settings || pending !== null;
  const modeDescription = TOOL_APPROVAL_MODES.find(m => m.mode === settings?.toolApprovalMode)?.description;

  return (
    <section className="bg-secondary border border-primary rounded-xl px-4 py-3" aria-label="When TokenRing asks first" data-testid="tool-approval-controls">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
        <span className="text-xs font-semibold text-primary">When TokenRing asks first</span>
        {pending ? <BusySpinner label="Saving" /> : null}
      </div>
      {approval.error ? (
        <p className="text-xs text-danger" role="alert">
          Could not load these settings: {formatError(approval.error)}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Go ahead without asking up to safety level"
            value={settings ? String(settings.autoToolApprovalLevel) : ""}
            onChange={value => void apply({ autoToolApprovalLevel: Number(value) })}
            disabled={disabled}
            hint={settings ? allLevels.find(l => l.level === settings.autoToolApprovalLevel)?.description : "Loading…"}
          >
            {settings ? null : <option value="">Loading…</option>}
            {allLevels.map(({ level, description }) => (
              <option key={level} value={String(level)} title={description}>
                {level} — {description}
              </option>
            ))}
          </Select>
          <Select
            label="Above that level, do this"
            value={settings?.toolApprovalMode ?? ""}
            onChange={value => void apply({ toolApprovalMode: value as ToolApprovalMode })}
            disabled={disabled}
            hint={modeDescription}
          >
            {settings ? null : <option value="">Loading…</option>}
            {TOOL_APPROVAL_MODES.map(({ mode, label }) => (
              <option key={mode} value={mode}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}
    </section>
  );
}
