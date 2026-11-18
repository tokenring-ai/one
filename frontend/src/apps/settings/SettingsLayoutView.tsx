import { RotateCcw } from "lucide-react";
import { useCallback } from "react";
import { MAX_PINNED_DASHBOARDS, useAppShell } from "../../components/layout/AppShellContext.tsx";
import { notificationManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import Button from "../../ui/button.tsx";
import Switch from "../../ui/switch.tsx";
import { SettingsCard, SettingsRow } from "./shared.tsx";

/** Read by useRestoreLastSession on launch; stored as the string "true" / "false". */
const RESTORE_LAST_DASHBOARD_KEY = "tokenring-restore-last-dashboard";
const RESTORE_LAST_OPTIONS = { serialize: String, deserialize: (raw: string) => raw === "true" };

/** The rail card, shared by the standalone view and the combined settings page. */
export function LayoutSection() {
  const { pinnedDashboardIds, toggleSwitcher, resetToDefaults } = useAppShell();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  // Shared through localStorage, so every open copy of this card stays in sync.
  const [restoreLast, setRestoreLast] = useLocalStorageState<boolean>(RESTORE_LAST_DASHBOARD_KEY, false, RESTORE_LAST_OPTIONS);

  const toggleRestoreLast = useCallback(() => {
    setRestoreLast(previous => !previous);
  }, [setRestoreLast]);

  const handleResetLayout = useCallback(async () => {
    const confirmed = await openConfirm({
      title: "Reset rail?",
      message: "Pinned and recent dashboards will return to defaults on this device.",
      confirmText: "Reset",
      cancelText: "Cancel",
      variant: "info",
    });
    if (!confirmed) return;
    resetToDefaults();
    notificationManager.success("Rail reset to defaults");
  }, [openConfirm, resetToDefaults]);

  return (
    <>
      <SettingsCard>
        <SettingsRow title="Pinned dashboards" description={`${pinnedDashboardIds.length} of ${MAX_PINNED_DASHBOARDS} shortcuts shown in the rail`}>
          <Button type="button" variant="secondary" onClick={toggleSwitcher}>
            Manage
          </Button>
        </SettingsRow>
        <SettingsRow title="Reopen last dashboard on launch" description="Continue where you left off instead of starting on Home (this device only)">
          <Switch checked={restoreLast} onChange={() => toggleRestoreLast()} label="Reopen last dashboard on launch" />
        </SettingsRow>
        <SettingsRow title="Reset rail" description="Restore pinned and recent dashboards to defaults" border={false}>
          <Button type="button" variant="secondary" icon={RotateCcw} onClick={() => void handleResetLayout()}>
            Reset
          </Button>
        </SettingsRow>
      </SettingsCard>
      <ConfirmDialog />
    </>
  );
}

export default function SettingsLayoutView() {
  return (
    <ViewShell pad="page">
      <LayoutSection />
    </ViewShell>
  );
}
