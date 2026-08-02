/**
 * Maps custom markdown link schemes (agent://…, workflow://…, etc.) to in-app routes.
 * Used by chat markdown so agents can deep-link into TokenRing One surfaces.
 */

/** Schemes that map to a fixed app root (optional path segments are appended). */
const ROOT_SCHEMES: Record<string, string> = {
  scheduler: "/scheduler",
  queue: "/queue",
  skills: "/skills",
  skill: "/skills",
  documents: "/documents",
  document: "/documents",
  media: "/media",
  social: "/social",
  messaging: "/messaging",
  message: "/messaging",
  stocks: "/stocks",
  stock: "/stocks",
  plugins: "/plugins",
  services: "/services",
  service: "/services",
  metrics: "/metrics",
  settings: "/settings",
  vault: "/vault",
};

/**
 * Schemes that take an identity path segment (and possibly more).
 * Values are the route prefix before encoded segments.
 */
const RESOURCE_SCHEMES: Record<string, string> = {
  agent: "/agent",
  agents: "/agents",
  workflow: "/workflows",
  workflows: "/workflows",
  bot: "/bots",
  bots: "/bots",
  blog: "/blog",
  file: "/files",
  files: "/files",
  terminal: "/terminal",
  email: "/email",
  database: "/database",
  calendar: "/calendar",
  configuration: "/configuration",
  config: "/configuration",
  plugin: "/configuration",
  research: "/research",
  "web-design": "/web-design",
  webdesign: "/web-design",
};

const SCHEME_RE = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodeSegments(segments: string[]): string {
  return segments.map(seg => encodeURIComponent(seg)).join("/");
}

/**
 * Parse path segments from the part after `scheme://`, preserving case.
 * Avoids `new URL()` because hostnames are lowercased.
 */
function pathSegments(rest: string): string[] {
  const withoutHash = rest.split("#")[0] ?? "";
  const pathPart = withoutHash.split("?")[0] ?? "";
  return pathPart.split("/").filter(Boolean).map(decodeSegment);
}

/**
 * If `href` is a known app scheme, return the in-app path; otherwise `null`.
 *
 * Examples:
 * - `agent://abc-123` → `/agent/abc-123`
 * - `workflow://deploy` → `/workflows/deploy`
 * - `research://topic/item` → `/research/topic/item`
 * - `files://src/app.ts` → `/files/src%2Fapp.ts` (single param apps encode the full resource)
 * - `scheduler://` → `/scheduler`
 */
export function resolveAppLink(href: string | null | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  const match = SCHEME_RE.exec(trimmed);
  if (!match) return null;

  const scheme = match[1]!.toLowerCase();
  const rest = match[2] ?? "";
  const segments = pathSegments(rest);

  // Agent chat is singular `/agent/:id` (not `/agents/:id`).
  if (scheme === "agent") {
    return segments[0] ? `/agent/${encodeURIComponent(segments[0])}` : "/agents";
  }

  // Single-param routes: multi-segment resources are joined then encoded as one param
  // (plugin names like `@tokenring-ai/bot`, file paths like `src/app.ts`).
  const singleParamBase =
    scheme === "file" || scheme === "files" ? "/files" : scheme === "configuration" || scheme === "config" || scheme === "plugin" ? "/configuration" : null;
  if (singleParamBase) {
    if (segments.length === 0) return singleParamBase;
    return `${singleParamBase}/${encodeURIComponent(segments.join("/"))}`;
  }

  const resourceBase = RESOURCE_SCHEMES[scheme];
  if (resourceBase) {
    if (segments.length === 0) return resourceBase;
    return `${resourceBase}/${encodeSegments(segments)}`;
  }

  const rootBase = ROOT_SCHEMES[scheme];
  if (rootBase) {
    if (segments.length === 0) return rootBase;
    return `${rootBase}/${encodeSegments(segments)}`;
  }

  return null;
}

/** True when the href uses a custom scheme we handle in-app. */
export function isAppLink(href: string | null | undefined): boolean {
  return resolveAppLink(href) !== null;
}
