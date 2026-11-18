import { describe, expect, it } from "bun:test";
import { encodeWorkspacePath, workspaceFileUrl } from "./workspaceFileUrl.ts";

describe("encodeWorkspacePath", () => {
  it("encodes each segment and keeps slashes", () => {
    expect(encodeWorkspacePath("media-library/a b.png")).toBe("media-library/a%20b.png");
    expect(encodeWorkspacePath("web-design/flow/index.html")).toBe("web-design/flow/index.html");
  });
});

describe("workspaceFileUrl", () => {
  it("builds /api/fs/{path} for workspace-relative paths", () => {
    expect(workspaceFileUrl("media-library/panda.png")).toBe("/api/fs/media-library/panda.png");
  });

  it("encodes path segments", () => {
    expect(workspaceFileUrl("a b/c.png")).toBe("/api/fs/a%20b/c.png");
  });

  it("preserves a leading slash so the server can tell absolute paths from relative ones", () => {
    expect(workspaceFileUrl("/src/app.ts")).toBe("/api/fs//src/app.ts");
  });

  it("appends download=1 when requested", () => {
    expect(workspaceFileUrl("logo.png", { download: true })).toBe("/api/fs/logo.png?download=1");
  });
});
