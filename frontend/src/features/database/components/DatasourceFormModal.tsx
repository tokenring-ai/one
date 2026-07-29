import formatError from "@tokenring-ai/utility/error/formatError";
import { AlertTriangle, CheckCircle2, Database, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toastManager } from "../../../components/ui/toast.tsx";
import { type ConfigScope, formatConfigIssues, SENSITIVE_KEEP, updateConfigLayer } from "../../../lib/configWrites.ts";
import { databaseRPCClient } from "../../../rpc.ts";
import { CONNECTION_STRING_PLACEHOLDER } from "../constants.ts";
import type { DatasourceSummary } from "../types.ts";

/**
 * Creates or edits one entry under the `database` config key.
 *
 * Writes go through the shared config layer rather than a database-specific RPC:
 * that persists to disk and live-reconfigures the running plugin in one step,
 * and it already knows how to keep a stored secret when the user doesn't retype
 * the connection string.
 */
export default function DatasourceFormModal({
  existing,
  scope,
  onClose,
  onSaved,
}: {
  /** Present when editing; absent when adding. */
  existing?: DatasourceSummary;
  scope: ConfigScope;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const isEdit = existing !== undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [url, setUrl] = useState("");
  const [allowWrites, setAllowWrites] = useState(existing?.allowWrites ?? false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  // On edit an untouched URL means "keep what's stored", so it isn't required.
  const canSave = trimmedName !== "" && (isEdit || trimmedUrl !== "");

  const writeConfig = async (): Promise<boolean> => {
    const result = await updateConfigLayer(scope, overrides => {
      const database = { ...(overrides.database as Record<string, unknown> | undefined) };
      // A rename is a move, not a copy.
      if (isEdit && existing.name !== trimmedName) delete database[existing.name];

      const previous = (database[trimmedName] ?? {}) as Record<string, unknown>;
      database[trimmedName] = {
        ...previous,
        url: trimmedUrl !== "" ? trimmedUrl : SENSITIVE_KEEP,
        allowWrites,
      };
      return { ...overrides, database };
    });

    if (!result.ok) {
      toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!canSave) return;
    setTesting(true);
    setTestResult(null);
    try {
      // The server only tests datasources it has, so save first. That makes Test
      // a save-then-verify, which is also what the user wants after an edit.
      if (!(await writeConfig())) return;
      const result = await databaseRPCClient.testConnection({ datasource: trimmedName });
      setTestResult(
        result.ok
          ? { ok: true, message: `Connected — ${result.tableCount ?? 0} table${result.tableCount === 1 ? "" : "s"} found` }
          : { ok: false, message: result.error ?? "Connection failed" },
      );
      if (result.ok) onSaved(trimmedName);
    } catch (err) {
      setTestResult({ ok: false, message: formatError(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (!(await writeConfig())) return;
      toastManager.success(isEdit ? `Datasource "${trimmedName}" updated` : `Datasource "${trimmedName}" added`, { duration: 3000 });
      onSaved(trimmedName);
      onClose();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || testing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-secondary border border-primary rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-primary">
          <div className="flex items-center gap-2.5 min-w-0">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-base font-semibold text-primary truncate">{isEdit ? `Edit ${existing.name}` : "Add datasource"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="datasource-name" className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Name
            </label>
            <input
              id="datasource-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="production"
              autoComplete="off"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus-accent"
            />
            <p className="text-2xs text-muted mt-1">How you and the agent refer to this database.</p>
          </div>

          <div>
            <label htmlFor="datasource-url" className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Connection String
            </label>
            <input
              id="datasource-url"
              type="password"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={isEdit ? "•••••••• (leave blank to keep current)" : CONNECTION_STRING_PLACEHOLDER}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted font-mono focus-accent"
            />
            <p className="text-2xs text-muted mt-1">
              {isEdit
                ? "Stored securely on the server and never sent back to the browser. Leave blank to keep the current one."
                : "Stored securely on the server. Only MySQL and MariaDB are supported today."}
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={allowWrites}
              onChange={e => setAllowWrites(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-primary bg-input accent-accent cursor-pointer"
            />
            <span className="min-w-0">
              <span className="text-sm text-primary block">Allow writes</span>
              <span className="text-2xs text-muted block">
                When off, agents can only read from this datasource — write statements are refused outright rather than prompted for.
              </span>
            </span>
          </label>

          {testResult && (
            <div
              className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                testResult.ok ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />}
              <span className="min-w-0 break-words">{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-primary">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || busy}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring shadow-button-primary"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={!canSave || busy}
            className="flex items-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-hover text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            {testing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…
              </>
            ) : (
              "Save & test"
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="ml-auto px-4 py-2 text-muted hover:text-primary text-sm font-medium rounded-lg hover:bg-hover transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
