import { describe, expect, it } from "bun:test";
import buildConfigUISchema from "@tokenring-ai/app/config/buildConfigUISchema";
import { ConfigUIPluginSchemaSchema } from "@tokenring-ai/app/config/uiSchema";
import { plugins } from "../plugins.ts";

/**
 * Smoke test: the introspection walker must handle every real plugin schema
 * without throwing, and its output must round-trip through the wire schema.
 */
describe("buildConfigUISchema against all installed plugins", () => {
  for (const plugin of plugins) {
    it(`introspects ${plugin.name}`, () => {
      const uiSchema = buildConfigUISchema(plugin);
      if (!("configSchema" in plugin)) {
        expect(uiSchema).toBeNull();
        return;
      }
      expect(uiSchema).not.toBeNull();
      // Some plugins declare an empty config shape (config: z.object({})) — zero slices is valid.
      expect(() => ConfigUIPluginSchemaSchema.parse(uiSchema)).not.toThrow();
    });
  }
});
