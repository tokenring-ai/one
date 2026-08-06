import type { TokenRingPlugin } from "@tokenring-ai/app";
import { WebHostService } from "@tokenring-ai/web-host";
import index from "./index.html";
import packageJSON from "./package.json" with { type: "json" };

const routes = [
  "/agents",
  "/workflows",
  "/bots",
  "/scheduler",
  "/queue",
  "/skills",
  "/web-design",
  "/documents",
  "/research",
  "/blog",
  "/files",
  "/terminal",
  "/email",
  "/database",
  "/calendar",
  "/media",
  "/social",
  "/messaging",
  "/stocks",
  "/plugins",
  "/configuration",
  "/services",
  "/metrics",
  "/debug",
  "/settings",
  "/vault",
  "/agent",
];

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
