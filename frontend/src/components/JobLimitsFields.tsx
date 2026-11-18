import { useState } from "react";
import { useJobPolicy } from "../rpc.ts";
import { Select, TextField } from "../ui/index.ts";
import EscalationSetup from "./EscalationSetup.tsx";

/** The value of the approval select meaning "the operator default". */
export const DEFAULT_APPROVAL_LEVEL = "";

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Why a budget text cannot be saved, or null (blank is fine: no limit of its own). */
export function budgetProblem(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? null : "Enter an amount above 0, or leave blank";
}

/** The budget as the RPC takes it: undefined when blank. */
export function parseBudget(value: string): number | undefined {
  return value.trim() ? Number(value.trim()) : undefined;
}

/** The approval level as the RPC takes it: undefined for "operator default". */
export function parseApprovalLevel(value: string): number | undefined {
  return value === DEFAULT_APPROVAL_LEVEL ? undefined : Number(value);
}

/**
 * "Budget (USD)" and "May go ahead without asking, up to level" for forms that start unattended runs
 * (schedules, queues). Levels above the operator's ceiling are disabled; levels 8 and above can
 * never be allowed.
 */
export default function JobLimitsFields({
  maxCostUsd,
  onMaxCostUsd,
  maxApprovalLevel,
  onMaxApprovalLevel,
}: {
  maxCostUsd: string;
  onMaxCostUsd: (value: string) => void;
  /** A level as text, or "" for the operator default. */
  maxApprovalLevel: string;
  onMaxApprovalLevel: (value: string) => void;
}) {
  const policy = useJobPolicy().data;
  const ceiling = policy?.approvalCeiling ?? 5;
  return (
    <>
      <TextField
        label="Budget (USD)"
        type="number"
        min={0}
        step="any"
        value={maxCostUsd}
        onChange={onMaxCostUsd}
        placeholder={policy?.defaultMaxCostUsd != null ? `${policy.defaultMaxCostUsd} (default)` : "no limit"}
        error={budgetProblem(maxCostUsd)}
        hint="A run that spends more is stopped and marked failed"
      />
      <Select
        label="May go ahead without asking, up to level"
        value={maxApprovalLevel}
        onChange={onMaxApprovalLevel}
        hint={`The operator ceiling is ${ceiling}. Anything that sends, posts or publishes (level 8 and above) always needs a person and is refused in unattended runs.`}
      >
        <option value={DEFAULT_APPROVAL_LEVEL}>Default (level {policy?.defaultApprovalLevel ?? ceiling})</option>
        {LEVELS.map(level => (
          <option key={level} value={String(level)} disabled={level > ceiling}>
            Level {level}
            {level > ceiling ? " (above the operator ceiling)" : ""}
          </option>
        ))}
      </Select>
    </>
  );
}

/**
 * A non-blocking note under a form that starts unattended runs: what the run may approve, that
 * anything above is refused, and whether a question can reach anyone.
 */
export function JobPolicyNote({ maxApprovalLevel }: { maxApprovalLevel: string }) {
  const query = useJobPolicy();
  const policy = query.data;
  const [setupOpen, setSetupOpen] = useState(false);
  if (!policy) return null;
  const chosen = parseApprovalLevel(maxApprovalLevel);
  const effective = Math.min(chosen ?? policy.defaultApprovalLevel, policy.approvalCeiling);
  return (
    <div className="space-y-1 text-xs text-muted" data-testid="job-policy-note" aria-live="polite">
      <p>
        While you are away, a run goes ahead without asking only for things up to safety level {effective}. Anything above that is refused, and the run carries
        on without it.
      </p>
      {/* Stays open after saving so the result of the test message is still on screen when the policy refreshes. */}
      {policy.escalationConfigured && !setupOpen ? null : (
        <div className="space-y-2">
          {!policy.escalationConfigured && (
            <p>
              No escalation target is set, so questions from unattended runs are refused immediately.{" "}
              {!setupOpen && (
                <button type="button" onClick={() => setSetupOpen(true)} className="text-accent-soft hover:underline focus-ring rounded cursor-pointer">
                  Set one up here
                </button>
              )}
            </p>
          )}
          {setupOpen && <EscalationSetup onSaved={() => void query.mutate()} />}
        </div>
      )}
    </div>
  );
}
