import { describe, expect, it } from "bun:test";
import path from "node:path";
import { ADMIN_ONLY_METHODS } from "@tokenring-ai/web-host/adminOnlyMethods";

/**
 * The member deny-list names RPC methods by `<endpoint path>.<method>`. A misspelled or renamed entry
 * silently stops protecting anything, because the central gate only compares strings. This loads every
 * plugin's RPC endpoints and requires each listed name to be a real method.
 */
async function registeredMethodIds(): Promise<Set<string>> {
  const pluginRoot = path.resolve(import.meta.dir, "..", "..", "plugin");
  const ids = new Set<string>();
  for await (const file of new Bun.Glob("*/rpc/*.ts").scan({ cwd: pluginRoot })) {
    if (file.includes(".test.")) continue;
    const module = (await import(path.join(pluginRoot, file)).catch(() => null)) as { default?: unknown } | null;
    const endpoint = module?.default as { path?: unknown; methods?: Record<string, unknown> } | undefined;
    if (typeof endpoint?.path === "string" && endpoint.methods && typeof endpoint.methods === "object") {
      for (const name of Object.keys(endpoint.methods)) ids.add(`${endpoint.path}.${name}`);
    }
  }
  return ids;
}

describe("admin-only RPC method list", () => {
  it("names only methods that really exist", async () => {
    const real = await registeredMethodIds();
    expect(real.size).toBeGreaterThan(200);
    const unknown = ADMIN_ONLY_METHODS.filter(id => !real.has(id));
    expect(unknown).toEqual([]);
  }, 60000);

  it("covers the security-critical areas", () => {
    for (const id of [
      "/rpc/config.applyConfig",
      "/rpc/vault.getItem",
      "/rpc/vault.setItems",
      "/rpc/chat.grantPermission",
      "/rpc/chat.revokePermissionGrant",
      "/rpc/bot.setEscalation",
      "/rpc/marketplace.installMarketplaceItem",
      "/rpc/scheduler.addSchedule",
      "/rpc/scheduler.updateSchedule",
      "/rpc/users.createUser",
      "/rpc/users.removeUser",
    ]) {
      expect(ADMIN_ONLY_METHODS).toContain(id);
    }
  });
});
