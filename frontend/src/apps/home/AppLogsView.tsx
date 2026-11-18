import { useMemo, useState } from "react";
import AutoScrollContainer from "../../components/chat/AutoScrollContainer.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { cn } from "../../lib/utils.ts";
import { useAppLogs } from "../../rpc.ts";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Live application log from the running instance. */
export default function AppLogsView() {
  const logs = useAppLogs();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const stored = logs.data?.logs;
  const entries = useMemo(() => (errorsOnly ? (stored ?? []).filter(entry => entry.level === "error") : (stored ?? [])), [errorsOnly, stored]);

  if (logs.isLoading && !logs.data) return <LoadingState size="sm" className="h-full" />;
  if (logs.error && !logs.data) return <ErrorState error={logs.error} onRetry={() => void logs.mutate()} title="Unable to stream logs" variant="page" />;

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader variant="navigator" title={<span className="text-xs text-muted">{entries.length} entries</span>}>
          <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={errorsOnly} onChange={event => setErrorsOnly(event.target.checked)} className="accent-accent" />
            Errors only
          </label>
        </ViewHeader>
      }
    >
      <AutoScrollContainer className="h-full">
        <ol className="font-mono text-[11px] leading-5 px-2 py-1" aria-label="Application log">
          {entries.length === 0 && (
            <li>
              <EmptyState title="No log entries yet" variant="inline" />
            </li>
          )}
          {entries.map(entry => (
            <li key={entry.id} className={cn("flex gap-2 whitespace-pre-wrap break-words", entry.level === "error" ? "text-error" : "text-secondary")}>
              <span className="shrink-0 text-dim tabular-nums">{timeFormat.format(entry.timestamp)}</span>
              <span className="min-w-0">{entry.message}</span>
            </li>
          ))}
        </ol>
      </AutoScrollContainer>
    </ViewShell>
  );
}
