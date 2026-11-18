import { describe, expect, it } from "bun:test";
import type { TokenRingPlugin } from "@tokenring-ai/app/types";
import { configSchema, plugins } from "../plugins.ts";

type ShapedPlugin = TokenRingPlugin<any, any> & {
  configSchema?: { shape: Record<string, unknown> };
  immutableConfigSchema?: { shape: Record<string, unknown> };
};

/**
 * Invariant: every plugin that ships a configSchema (or immutableConfigSchema)
 * must have its shape spread into the composed app configSchema. Zod strips
 * unknown keys, so a missing spread silently discards that plugin's config —
 * which is how the email plugin's config went missing for months.
 */
describe("plugin config schema composition", () => {
  it("spreads every plugin's config shape into the composed app configSchema", () => {
    const composedKeys = new Set(Object.keys(configSchema.shape));
    const missing: string[] = [];

    for (const plugin of plugins as ShapedPlugin[]) {
      const shape = plugin.configSchema?.shape ?? plugin.immutableConfigSchema?.shape;
      if (!shape) continue;
      for (const key of Object.keys(shape)) {
        if (!composedKeys.has(key)) {
          missing.push(`${plugin.name}: ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
