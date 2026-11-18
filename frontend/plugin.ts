import type { TokenRingPlugin } from "@tokenring-ai/app";
import { WebHostService } from "@tokenring-ai/web-host";
import index from "./index.html";
import packageJSON from "./package.json" with { type: "json" };
import { CORE_APP_PATHS } from "./src/apps/manifests.ts";
import { PLUGIN_LAYOUT_APP_PATHS } from "./src/plugins/layoutManifests.ts";

// Every app's base path (and alias prefixes such as `/agent`, plus `/my` for
// saved apps) serves the SPA shell so the client router can take over below it.
// Both lists come from React-free app manifests.
const routes = [...new Set([...CORE_APP_PATHS, ...PLUGIN_LAYOUT_APP_PATHS])];

export default {
  name: packageJSON.name,
  displayName: "TokenRing One Web Frontend",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    app.waitForService(WebHostService, webHost => {
      webHost.registerResource("Frontend", {
        routes: {
          "/": index,
          ...Object.fromEntries(routes.map(route => [route, index])),
          ...Object.fromEntries(routes.map(route => [`${route}/*`, index])),
        },
      });
    });
  },
} satisfies TokenRingPlugin;
