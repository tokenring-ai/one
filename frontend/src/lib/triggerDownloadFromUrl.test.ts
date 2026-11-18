import { describe, expect, it, mock } from "bun:test";
import { triggerDownloadFromUrl } from "./triggerDownloadFromUrl.ts";

/**
 * `document.createElement` carries a deprecated overload for legacy tag names, so
 * referencing the method directly resolves to it. Aliasing the document through a
 * type that only exposes the current `(tagName: string)` signature keeps the stub
 * swapping below on the non-deprecated API.
 */
const doc: { createElement: (tagName: string) => HTMLElement } = document;

describe("triggerDownloadFromUrl", () => {
  it("fetches a blob and clicks a download link", async () => {
    const blob = new Blob(["data"], { type: "text/plain" });
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = doc.createElement.bind(document);

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
    doc.createElement = (tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") Object.defineProperty(el, "click", { value: click });
      return el;
    };

    try {
      await triggerDownloadFromUrl({ url: "/api/fs/a.txt", filename: "a.txt" });
      expect(fetchMock).toHaveBeenCalled();
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [calledUrl, calledInit] = call!;
      expect(calledUrl).toBe("/api/fs/a.txt");
      expect(calledInit?.credentials).toBe("include");
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      doc.createElement = originalCreateElement;
    }
  });

  it("omits RPC credentials for cross-origin URLs", async () => {
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = doc.createElement.bind(document);

    const fetchMock = mock((_url: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["data"], { type: "text/plain" })),
      } as Response),
    );
    const createObjectURL = mock(() => "blob:test");
    const revokeObjectURL = mock(() => {});
    const click = mock(() => {});

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
    doc.createElement = (tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") Object.defineProperty(el, "click", { value: click });
      return el;
    };

    try {
      await triggerDownloadFromUrl({ url: "https://evil.example.com/a.txt", filename: "a.txt" });
      const [calledUrl, calledInit] = fetchMock.mock.calls[0]!;
      expect(calledUrl).toBe("https://evil.example.com/a.txt");
      expect(calledInit?.credentials).toBe("omit");
      expect(calledInit?.headers).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      doc.createElement = originalCreateElement;
    }
  });

  it("falls back to a direct anchor when fetch fails", async () => {
    const originalFetch = globalThis.fetch;
    const originalCreateElement = doc.createElement.bind(document);
    const click = mock(() => {});
    const anchors: HTMLAnchorElement[] = [];

    globalThis.fetch = mock(() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    doc.createElement = (tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: click });
        anchors.push(el as HTMLAnchorElement);
      }
      return el;
    };

    try {
      await triggerDownloadFromUrl({ url: "/api/fs/a.txt", filename: "a.txt" });
      expect(click).toHaveBeenCalled();
      expect(anchors[0]?.href).toContain("/api/fs/a.txt");
      expect(anchors[0]?.download).toBe("a.txt");
    } finally {
      globalThis.fetch = originalFetch;
      doc.createElement = originalCreateElement;
    }
  });
});
