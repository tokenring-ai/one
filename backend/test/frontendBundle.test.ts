import { describe, expect, it } from "bun:test";
import path from "node:path";

/**
 * The backend serves the web app by bundling frontend/index.html for the browser at startup, and the app
 * imports every plugin's frontend code plus its RPC schema. One server-only import (Bun's `bun` module,
 * `node:fs`) anywhere in that graph breaks the whole app, and no unit test of the offending module notices,
 * because those run on the server. This builds the same entry the server does and fails on any bundling error.
 */
describe("web app bundle", () => {
  it("bundles frontend/index.html for the browser without errors", async () => {
    const entry = path.resolve(import.meta.dir, "..", "..", "frontend", "index.html");

    const result = await Bun.build({ entrypoints: [entry], target: "browser", throw: false });

    expect(result.logs.filter(log => log.level === "error").map(log => log.message)).toEqual([]);
    expect(result.success).toBe(true);
  }, 120000);
});
