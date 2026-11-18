import { Check, Trash2 } from "lucide-react";
import { useCallback } from "react";
import { useAppShell } from "../../components/layout/AppShellContext.tsx";
import { notificationManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { CLIENT_PREFERENCE_KEY_PREFIXES, CLIENT_PREFERENCE_KEYS } from "../../lib/uiPreferences.ts";
import { cn } from "../../lib/utils.ts";
import { SettingsCard, SettingsRow } from "./shared.tsx";

/** The storage card, shared by the standalone view and the combined settings page. */
export function DataSection() {
  const { localStorageAvailable } = useAppShell();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const handleClearPreferences = useCallback(async () => {
    const confirmed = await openConfirm({
      title: "Clear local preferences?",
      message:
        "This removes everything this app stores in this browser: theme; pinned and recent dashboards and saved dashboard layouts; agent session names, pins, and attached agents; skipped confirmation prompts; unsent chat drafts and chat display options; unsaved configuration, workflow, and blog drafts; per-app view state (terminal history and font size, GitHub repositories and filters, web-design previews, task board modes); and the stocks watchlist. Locally stored calendar events, server configuration, and account data are not affected. The page will reload.",
      confirmText: "Clear preferences",
      cancelText: "Cancel",
      variant: "danger",
      // This action wipes the skip list; hiding the prompt here would be confusing.
      dontAskAgain: false,
    });
    if (!confirmed) return;
    // Remove known client keys only — do not call setTheme/resetToDefaults first,
    // which would re-write theme/layout into storage before reload.
    for (const key of CLIENT_PREFERENCE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    }
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && CLIENT_PREFERENCE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
    notificationManager.success("Local preferences cleared");
    // Reload so theme, layout, and chat draft modules re-initialize from empty storage
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }, [openConfirm]);

  return (
    <>
      {!localStorageAvailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300" role="status">
          Browser storage is unavailable. Theme and layout choices will not persist across sessions.
        </div>
      )}
      <SettingsCard>
        <SettingsRow
          title="Local storage"
          description={
            localStorageAvailable ? "Theme, layout, and chat drafts are saved in this browser" : "Storage is blocked — preferences stay in memory only"
          }
        >
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              localStorageAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {localStorageAvailable ? (
              <>
                <Check className="w-3 h-3" aria-hidden="true" /> Available
              </>
            ) : (
              "Unavailable"
            )}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Clear local preferences"
          description="Reset everything stored in this browser: theme, dashboards and layouts, session names and pins, drafts, skipped prompts, per-app view state"
          border={false}
        >
          <button
            type="button"
            onClick={() => void handleClearPreferences()}
            disabled={!localStorageAvailable}
            title={!localStorageAvailable ? "Browser storage is unavailable — nothing to clear" : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Clear
          </button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog />
    </>
  );
}

export default function SettingsDataView() {
  return (
    <ViewShell pad="page">
      <DataSection />
    </ViewShell>
  );
}
