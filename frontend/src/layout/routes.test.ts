import { describe, expect, test } from "bun:test";
import { MessageSquare } from "lucide-react";
import type { ViewLookup } from "./model.ts";
import { createRouteTable } from "./routes.ts";
import type { AppManifest, ViewManifest } from "./types.ts";

const view = (id: string, kind: string, route?: string): ViewManifest => ({
  id,
  kind,
  title: id,
  icon: MessageSquare,
  ...(route !== undefined ? { route } : {}),
});
const VIEWS: Record<string, ViewManifest> = {
  chat: view("chat", "agent", "agent/:agentId"),
  overview: view("overview", "page", ""),
  create: view("create", "agent-type", "new"),
  detail: view("detail", "agent-type", ":agentType"),
  market: view("market", "page", "marketplace/:category?/:name?"),
  list: view("list", "navigator"),
  welcome: view("welcome", "page"),
  inbox: view("inbox", "page", ":provider?"),
};
const lookup: ViewLookup = id => (VIEWS[id] ? { kind: VIEWS[id]!.kind } : undefined);
const base = { description: "", icon: MessageSquare, group: "Build" as const, primaryKind: "page", layout: { presenter: "tabs" as const, accepts: ["*"] } };
const APPS: AppManifest[] = [
  {
    ...base,
    id: "agents",
    path: "/agents",
    label: "Agents",
    views: ["list", "overview", "create", "detail", "market", "chat"],
    aliases: [{ path: "/agent/:agentId", view: "chat" }],
  },
  { ...base, id: "home", path: "/home", label: "Home", views: ["welcome", "chat"] },
  // The optional-only route claims the root regardless of order.
  { ...base, id: "mail", path: "/mail", label: "Mail", views: ["chat", "inbox"] },
];
const table = createRouteTable(APPS, id => VIEWS[id], lookup);

describe("route table", () => {
  test.each([
    ["/agents", "agents", "overview", {}],
    ["/agents/new", "agents", "create", {}],
    ["/agents/coder", "agents", "detail", { agentType: "coder" }],
    ["/agents/marketplace", "agents", "market", {}],
    ["/agents/marketplace/tools/linter", "agents", "market", { category: "tools", name: "linter" }],
    ["/agent/swift-doors-shake-394", "agents", "chat", { agentId: "swift-doors-shake-394" }],
    ["/home/agent/amber-fox-runs-807", "home", "chat", { agentId: "amber-fox-runs-807" }],
  ])("%s resolves and round-trips", (url, app, viewId, params) => {
    const r = table.resolve(url);
    expect(r).toMatchObject({ app, viewId, params });
    expect(table.urlFor(app, viewId, params)).toBe(url);
  });

  test("an app root that no view claims resolves to the app with no view", () => {
    expect(table.resolve("/home")).toMatchObject({ app: "home", viewId: null, key: null });
    expect(table.urlFor("home", "welcome", {})).toBeNull();
  });

  test("the alias is canonical; the nested form still resolves", () => {
    expect(table.urlFor("agents", "chat", { agentId: "a" })).toBe("/agent/a");
    expect(table.resolve("/agents/agent/a")).toMatchObject({ app: "agents", viewId: "chat", key: "chat:a" });
  });

  test("params with slashes and spaces are encoded and decoded", () => {
    const url = table.urlFor("home", "chat", { agentId: "a/b c" });
    expect(url).toBe("/home/agent/a%2Fb%20c");
    expect(table.resolve(url!)?.params).toEqual({ agentId: "a/b c" });
  });

  test("a route of only optional segments claims the app root", () => {
    expect(table.resolve("/mail")).toMatchObject({ app: "mail", viewId: "inbox", params: {} });
    expect(table.resolve("/mail/gmail")).toMatchObject({ app: "mail", viewId: "inbox", params: { provider: "gmail" } });
    expect(table.patterns().filter(p => p === "/mail")).toHaveLength(0);
  });

  test("unknown paths and missing params", () => {
    expect(table.resolve("/nowhere")).toBeNull();
    expect(table.urlFor("home", "chat", {})).toBeNull();
  });
});
