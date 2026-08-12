import { describe, expect, it } from "bun:test";
import { encodeWorkspacePath, workspaceFileUrl } from "./workspaceFileUrl.ts";

describe("encodeWorkspacePath", () => {
  it("encodes each segment and keeps slashes", () => {
    expect(encodeWorkspacePath("media-library/a b.png")).toBe("media-library/a%20b.png");
    expect(encodeWorkspacePath("web-design/flow/index.html")).toBe("web-design/flow/index.html");
  });
});

describe("workspaceFileUrl", () => {
  it("builds /api/fs/{provider}/{path}", () => {
    expect(workspaceFileUrl("posix", "media-library/panda.png")).toBe("/api/fs/posix/media-library/panda.png");
  });

  it("encodes provider and path segments", () => {
    expect(workspaceFileUrl("my provider", "a b/c.png")).toBe("/api/fs/my%20provider/a%20b/c.png");
  });

  it("strips a leading slash from the path", () => {
    expect(workspaceFileUrl("posix", "/src/app.ts")).toBe("/api/fs/posix/src/app.ts");
  });

  it("appends download=1 when requested", () => {
    expect(workspaceFileUrl("posix", "logo.png", { download: true })).toBe("/api/fs/posix/logo.png?download=1");
  });
});
