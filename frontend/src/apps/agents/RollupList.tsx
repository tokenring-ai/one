import type { JobRollupRow } from "@tokenring-ai/agent/rpc/jobs.schema";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";
import { Badge } from "../../ui";
import { AGENT_JOBS_PATH } from "./JobLink.tsx";
import { rollupCostText, rollupTone } from "./JobRollup.tsx";

function OutcomeBar({ row }: { row: JobRollupRow }) {
  const other = row.runs - row.succeeded - row.failed;
  const pct = (n: number) => `${row.runs === 0 ? 0 : (n / row.runs) * 100}%`;
  return (
    <div
      className="flex h-1.5 w-24 overflow-hidden rounded-full bg-tertiary"
      role="img"
      aria-label={`${row.succeeded} succeeded, ${row.failed} failed, ${other} other`}
    >
      <div className="bg-success" style={{ width: pct(row.succeeded) }} />
      <div className="bg-error" style={{ width: pct(row.failed) }} />
      <div className="bg-warning" style={{ width: pct(other) }} />
    </div>
  );
}

function when(ms: number | null): string {
  return ms === null ? "never" : new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({
  row,
  total,
  itemAttribute,
  owner,
  onSelect,
}: {
  row: JobRollupRow;
  total?: boolean;
  itemAttribute: string;
  owner: string;
  onSelect?: ((key: string) => void) | undefined;
}) {
  const tone = rollupTone(row);
  const attribute = total ? {} : { [itemAttribute]: row.key };
  return (
    <li
      {...attribute}
      data-tone={tone ?? undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs",
        total && "bg-tertiary font-medium",
        tone === "danger" && "border-l-2 border-danger",
        tone === "warning" && "border-l-2 border-warning",
      )}
    >
      {total || !onSelect ? (
        <span className="min-w-24 flex-1 text-primary">{row.label}</span>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(row.key)}
          className="min-w-24 flex-1 truncate text-left text-primary hover:underline focus-ring rounded cursor-pointer"
        >
          {row.label}
        </button>
      )}
      <span className="tabular-nums text-muted">{row.runs} runs</span>
      <OutcomeBar row={row} />
      <Badge tone="success">{row.succeeded} ok</Badge>
      {row.failed > 0 && <Badge tone="danger">{row.failed} failed</Badge>}
      {row.refusedActions > 0 && <Badge tone="warning">{row.refusedActions} refused</Badge>}
      <span className="tabular-nums text-muted">{rollupCostText(row)}</span>
      {!total && (
        <span className="text-muted">
          {row.lastStatus ?? "none"} · {when(row.lastRunAt)}
        </span>
      )}
      {tone !== null && (
        <Link to={`${AGENT_JOBS_PATH}?owner=${owner}`} className="text-accent-soft hover:underline focus-ring rounded">
          Jobs
        </Link>
      )}
    </li>
  );
}

/**
 * Per-group runs, outcomes and spend with a total row. Shared by the Scheduler (per schedule) and Workflows (per
 * workflow); `owner` is the Agent jobs filter the "Jobs" link opens, `itemAttribute` the data attribute each row carries.
 */
export default function RollupList({
  rows,
  totals,
  label,
  owner,
  itemAttribute,
  onSelect,
}: {
  rows: readonly JobRollupRow[];
  totals: JobRollupRow;
  label: string;
  owner: string;
  itemAttribute: string;
  onSelect?: (key: string) => void;
}) {
  return (
    <ul className="divide-y divide-primary overflow-hidden rounded-xl border border-primary bg-secondary" aria-label={label}>
      {rows.map(row => (
        <Row key={row.key} row={row} itemAttribute={itemAttribute} owner={owner} onSelect={onSelect} />
      ))}
      <Row row={{ ...totals, label: "Total" }} total itemAttribute={itemAttribute} owner={owner} />
    </ul>
  );
}
