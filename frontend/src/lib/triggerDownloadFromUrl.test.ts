import { describe, expect, it, mock } from "bun:test";
import { triggerDownloadFromUrl } from "./triggerDownloadFromUrl.ts";

describe("triggerDownloadFromUrl", () => {
  it("fetches a blob and clicks a download link", async () => {
    const blob = new Blob(["data"], { type: "text/plain" });
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    const fetchMock = mock((_url: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(blob),
      } as Response),
    );
    const createObjectURL = mock(() => "blob:test");
    const revokeObjectURL = mock(() => {});
    const click = mock(() => {});

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") Object.defineProperty(el, "click", { value: click });
      return el;
    }) as typeof document.createElement;

    try {
      await triggerDownloadFromUrl({ url: "/api/fs/posix/a.txt", filename: "a.txt" });
      expect(fetchMock).toHaveBeenCalled();
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [calledUrl, calledInit] = call!;
      expect(calledUrl).toBe("/api/fs/posix/a.txt");
      expect(calledInit?.credentials).toBe("include");
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    }
  });

  it("falls back to a direct anchor when fetch fails", async () => {
    const originalFetch = globalThis.fetch;
    const originalCreateElement = document.createElement.bind(document);
    const click = mock(() => {});
    const anchors: HTMLAnchorElement[] = [];

    globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: click });
        anchors.push(el as HTMLAnchorElement);
      }
      return el;
    }) as typeof document.createElement;

    try {
      await triggerDownloadFromUrl({ url: "/api/fs/posix/a.txt", filename: "a.txt" });
      expect(click).toHaveBeenCalled();
      expect(anchors[0]?.href).toContain("/api/fs/posix/a.txt");
      expect(anchors[0]?.download).toBe("a.txt");
    } finally {
      globalThis.fetch = originalFetch;
      document.createElement = originalCreateElement;
    }
  });
});
