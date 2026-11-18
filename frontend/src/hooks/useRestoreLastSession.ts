import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppShell } from "../components/layout/AppShellContext.tsx";
import { getDashboardManifestById } from "../shell/appCatalog.ts";
import { readLocalStorageState, writeLocalStorageState } from "./useLocalStorageState.ts";

const RESTORE_STORAGE_KEY = "tokenring-restore-last-dashboard";

/** Whether the "reopen last dashboard on launch" preference is enabled. */
export function readRestoreLastDashboard(): boolean {
  return readLocalStorageState<boolean>(RESTORE_STORAGE_KEY, false, {
    deserialize: raw => raw === "true",
  });
}

export function writeRestoreLastDashboard(value: boolean): void {
  writeLocalStorageState(RESTORE_STORAGE_KEY, value, { serialize: String });
}

/**
 * Reopens the most recently visited dashboard on launch, so a reload (or a
 * re-opened tab) continues where the user left off instead of always landing
 * on Home. Opt-in from Settings → Layout; only fires on the home path.
 */
export function useRestoreLastSession(): void {
  const { recentDashboards } = useAppShell();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (!readRestoreLastDashboard()) return;
    const last = recentDashboards[0];
    if (!last) return;
    const manifest = getDashboardManifestById(last.id);
    if (!manifest) return;
    void navigate(manifest.path);
    // Runs once per mount: the point is the launch restore, not redirecting the
    // user home every time they navigate back to "/".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
