import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingState from "../components/ui/LoadingState.tsx";
import { toastManager } from "../components/ui/toast.tsx";
import type { AppActions } from "../layout/context.ts";
import { LayoutApp } from "../layout/LayoutApp.tsx";
import { rpcLayoutRemote } from "../layout/rpcRemote.ts";
import NotFoundPage from "../pages/NotFoundPage.tsx";
import { useLayoutRegistry } from "./registry.ts";
import { setActiveTitle } from "./shellStatus.ts";
import { createUserApp, deleteUserApp, renameUserApp, USER_APP_BASE_PATH, useUserApps } from "./userApps.ts";

/** Route element for every layout-engine app: resolves the URL and mounts that app's layout. */
export default function AppHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const registry = useLayoutRegistry();
  const { loaded } = useUserApps();
  const route = registry.routes.resolve(location.pathname);
  const app = route ? registry.app(route.app) : undefined;
  useEffect(() => () => setActiveTitle(null), []);

  const appActions = useMemo<AppActions>(() => {
    if (!app) return {};
    const base = registry.app(app.basedOn ?? app.id) ?? app;
    const actions: AppActions = {
      async saveAs(label, state) {
        const path = await createUserApp(label, base, state, rpcLayoutRemote);
        toastManager.success(`Saved "${label}"`);
        void navigate(path);
      },
    };
    if (app.basedOn) {
      actions.rename = (label, state) => renameUserApp(app.id, label, state, rpcLayoutRemote);
      actions.remove = async () => {
        void navigate(base.path, { replace: true });
        await deleteUserApp(app.id, rpcLayoutRemote);
      };
    }
    return actions;
  }, [app, registry, navigate]);

  if (!route || !app) {
    // Saved apps load from the server after first paint; don't flash "not found" while they arrive.
    if (!loaded && location.pathname.startsWith(`${USER_APP_BASE_PATH}/`)) return <LoadingState className="flex-1" />;
    return <NotFoundPage />;
  }
  return (
    <LayoutApp
      key={route.app}
      registry={registry}
      appId={route.app}
      route={route}
      remote={rpcLayoutRemote}
      onActiveTitleChange={setActiveTitle}
      appActions={appActions}
    />
  );
}
