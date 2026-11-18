import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Check, Copy, Download, FileJson, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.ts";
import type { ViewProps } from "../../layout/define.ts";
import { usePanel } from "../../layout/hooks.ts";
import { downloadTextFile } from "../../lib/transcriptExport.ts";
import { appRPCClient } from "../../rpc.ts";
import { useMonacoTheme } from "../../theme/bridges/useMonacoTheme.ts";
import { usePanelTitle } from "../panelHooks.ts";
import { prettyPrintSnapshot } from "./formatters.ts";
import { useDeleteSnapshot } from "./shared.tsx";

type SnapshotState = { status: "loading" } | { status: "ready"; content: string } | { status: "missing" } | { status: "error"; error: string };

/**
 * One captured snapshot per panel, pretty-printed in a read-only JSON editor.
 * Without a `snapshotId` it is the start tab ("select a snapshot").
 */
export default function DebugSnapshotView({ params }: ViewProps) {
  const snapshotId = params.snapshotId || undefined;
  const panel = usePanel();
  const monacoTheme = useMonacoTheme();
  const [state, setState] = useState<SnapshotState>({ status: "loading" });
  /** Bumped by the reload action to re-run the fetch for the same snapshot. */
  const [reloadToken, setReloadToken] = useState(0);

  usePanelTitle(snapshotId ?? "Snapshot");

  useEffect(() => {
    if (!snapshotId) return;
    // A box, not a plain boolean: the cleanup below flips it after the await has started.
    const live = { current: true };
    setState({ status: "loading" });
    void (async () => {
      try {
        const result = await appRPCClient.readDebugSnapshot({ name: snapshotId });
        // Ignore a late response for a snapshot this panel no longer shows.
        if (!live.current) return;
        if (result.status === "notFound") setState({ status: "missing" });
        else setState({ status: "ready", content: prettyPrintSnapshot(result.content) });
      } catch (error: unknown) {
        if (live.current) setState({ status: "error", error: formatError(error) });
      }
    })();
    return () => {
      live.current = false;
    };
  }, [snapshotId, reloadToken]);

  const reload = useCallback(() => setReloadToken(token => token + 1), []);
  const { copy, copied } = useCopyToClipboard({ label: "snapshot JSON" });
  const { deleteSnapshot, ConfirmDialog } = useDeleteSnapshot();

  if (!snapshotId) {
    return (
      <EmptyState
        variant="page"
        className="h-full"
        icon={FileJson}
        title="Select a snapshot"
        hint="Capture app or agent state, then pick a snapshot from the list to inspect it."
      />
    );
  }

  if (state.status === "missing") {
    return (
      <EmptyState
        variant="page"
        className="h-full"
        icon={FileJson}
        title="Snapshot no longer exists"
        hint={`${snapshotId} has been deleted. Close this panel or pick another snapshot.`}
        ctaLabel="Close panel"
        ctaIcon={X}
        onCta={() => panel.close()}
      />
    );
  }

  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader
          title={<span className="min-w-0 text-xs font-mono text-primary truncate">{snapshotId}</span>}
          actions={[
            {
              icon: copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />,
              label: "Copy JSON",
              onClick: () => {
                if (state.status === "ready") void copy(state.content);
              },
              disabled: state.status !== "ready",
            },
            {
              icon: <Download className="w-3.5 h-3.5" />,
              label: "Download JSON",
              onClick: () => {
                if (state.status === "ready") downloadTextFile(snapshotId, `${state.content}\n`, "application/json");
              },
              disabled: state.status !== "ready",
            },
            { icon: <RefreshCw className="w-3.5 h-3.5" />, label: "Reload snapshot", onClick: reload },
            {
              icon: <Trash2 className="w-3.5 h-3.5" />,
              label: "Delete snapshot",
              onClick: () => {
                void deleteSnapshot(snapshotId);
              },
            },
          ]}
        />
      }
    >
      <div className="h-full min-h-0">
        {state.status === "loading" ? (
          <LoadingState message="Loading snapshot…" />
        ) : state.status === "error" ? (
          <ErrorState title="Could not load snapshot" error={state.error} onRetry={reload} variant="page" />
        ) : (
          <Editor
            height="100%"
            language="json"
            value={state.content}
            beforeMount={monacoTheme.beforeMount}
            theme={monacoTheme.theme}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
            }}
          />
        )}
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
