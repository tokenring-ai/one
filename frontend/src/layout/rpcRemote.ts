import { dashboardRPCClient } from "../rpc.ts";
import type { LayoutRemote } from "./persistence.ts";
import { LAYOUT_SCHEMA_VERSION } from "./types.ts";

/** Layouts are stored through the dashboard plugin's RPC, under `layout-<app>` ids. */
export const rpcLayoutRemote: LayoutRemote = {
  async get(id) {
    const result = await dashboardRPCClient.getDashboardLayout({ dashboardId: id });
    if (result.status !== "success" || result.record.schemaVersion !== LAYOUT_SCHEMA_VERSION) return null;
    return { layout: result.record.layout, updatedAt: result.record.updatedAt };
  },
  async save(id, layout, expectedUpdatedAt, app) {
    const result = await dashboardRPCClient.saveDashboardLayout({
      dashboardId: id,
      schemaVersion: LAYOUT_SCHEMA_VERSION,
      viewRegistryHash: "",
      layout,
      ...(expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}),
      ...(app ? { app } : {}),
    });
    if (result.status === "success") return { status: "ok", updatedAt: result.updatedAt };
    return { status: "conflict", record: { layout: result.record.layout, updatedAt: result.record.updatedAt } };
  },
  async remove(id) {
    await dashboardRPCClient.deleteDashboardLayout({ dashboardId: id });
  },
  async list() {
    const { layouts } = await dashboardRPCClient.listDashboardLayouts({});
    return layouts
      .filter(record => record.schemaVersion === LAYOUT_SCHEMA_VERSION)
      .map(record => ({ id: record.dashboardId, updatedAt: record.updatedAt, ...(record.app ? { app: record.app } : {}) }));
  },
};
