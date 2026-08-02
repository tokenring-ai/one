import { describe, expect, it } from "bun:test";
import { isAppLink, resolveAppLink } from "./appLinks.ts";

describe("resolveAppLink", () => {
  it("maps agent:// to the agent chat route", () => {
    expect(resolveAppLink("agent://abc-123")).toBe("/agent/abc-123");
    expect(resolveAppLink("agent://")).toBe("/agents");
  });

  it("maps workflow:// to workflows", () => {
    expect(resolveAppLink("workflow://deploy-prod")).toBe("/workflows/deploy-prod");
    expect(resolveAppLink("workflows://deploy-prod")).toBe("/workflows/deploy-prod");
  });

  it("maps bots, blog, terminal, email, database, calendar, configuration", () => {
    expect(resolveAppLink("bot://helper")).toBe("/bots/helper");
    expect(resolveAppLink("blog://post-1")).toBe("/blog/post-1");
    expect(resolveAppLink("terminal://shell-1")).toBe("/terminal/shell-1");
    expect(resolveAppLink("email://work")).toBe("/email/work");
    expect(resolveAppLink("database://main")).toBe("/database/main");
    expect(resolveAppLink("calendar://google")).toBe("/calendar/google");
    expect(resolveAppLink("configuration://@tokenring-ai/bot")).toBe("/configuration/%40tokenring-ai%2Fbot");
    expect(resolveAppLink("config://widget")).toBe("/configuration/widget");
    expect(resolveAppLink("plugin://widget")).toBe("/configuration/widget");
  });

  it("preserves case in resource names (does not lowercase like URL hostnames)", () => {
    expect(resolveAppLink("workflow://MyWorkflow")).toBe("/workflows/MyWorkflow");
  });

  it("maps multi-segment research and web-design paths", () => {
    expect(resolveAppLink("research://topic/item")).toBe("/research/topic/item");
    expect(resolveAppLink("web-design://flow/design")).toBe("/web-design/flow/design");
  });

  it("encodes multi-segment file paths as a single route param", () => {
    expect(resolveAppLink("files://src/app.ts")).toBe("/files/src%2Fapp.ts");
    expect(resolveAppLink("file://README.md")).toBe("/files/README.md");
  });

  it("maps root-only app schemes", () => {
    expect(resolveAppLink("scheduler://")).toBe("/scheduler");
    expect(resolveAppLink("queue://")).toBe("/queue");
    expect(resolveAppLink("skills://")).toBe("/skills");
    expect(resolveAppLink("vault://")).toBe("/vault");
    expect(resolveAppLink("settings://")).toBe("/settings");
  });

  it("returns null for http(s) and unknown schemes", () => {
    expect(resolveAppLink("https://example.com")).toBeNull();
    expect(resolveAppLink("http://localhost")).toBeNull();
    expect(resolveAppLink("/agents")).toBeNull();
    expect(resolveAppLink("mailto:a@b.com")).toBeNull();
    expect(resolveAppLink("unknown://x")).toBeNull();
    expect(resolveAppLink(null)).toBeNull();
    expect(resolveAppLink("")).toBeNull();
  });

  it("isAppLink mirrors resolveAppLink", () => {
    expect(isAppLink("agent://x")).toBe(true);
    expect(isAppLink("https://x")).toBe(false);
  });
});
