import fs from "node:fs";
import path from "node:path";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { StaticResource, WebHostService } from "@tokenring-ai/web-host";
import FallbackResource from "@tokenring-ai/web-host/FallbackResource";
import { z } from "zod";
import packageJSON from "./package.json" with { type: "json" };

const packageConfigSchema = z.object({
  frontend: z
    .object({
      directory: z.string().meta({ hidden: true } satisfies ConfigFieldMeta), // runtime-injected build output path
    })
    .meta({ label: "Chat Frontend" } satisfies ConfigFieldMeta),
});

export default {
  name: packageJSON.name,
  displayName: "TokenRing One Web Frontend",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const spaDirectory = path.resolve(config.frontend.directory);
    const indexFile = path.join(spaDirectory, "index.html");
    if (!fs.existsSync(indexFile)) {
      throw new Error(`One frontend not found at ${indexFile}`);
    }

    const assetsDir = path.join(spaDirectory, "assets");

    app.waitForService(WebHostService, webHostService => {
      webHostService.registerResource(
        "Static Assets",
        new StaticResource({
          prefix: "/assets",
          root: assetsDir,
          indexFile: "index.html",
        }),
      );

      webHostService.registerResource("Agent Web Interface", new FallbackResource({ file: indexFile }));
    });
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
