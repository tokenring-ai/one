import { describe, expect, it, mock } from "bun:test";
import { aspectLabel, downloadMedia, formatDuration, keywordsFromPrompt, mediaUrl, workOnMediaMessage } from "./utils.ts";

describe("mediaUrl", () => {
  it("builds a filesystem HTTP URL under the default serve directory", () => {
    expect(mediaUrl("panda.png")).toBe("/api/fs/posix/.tokenring/media-library/panda.png");
    expect(mediaUrl("a b.png")).toBe("/api/fs/posix/.tokenring/media-library/a%20b.png");
  });

  it("accepts custom provider and directory", () => {
    expect(mediaUrl("x.png", { provider: "other", directory: "custom-media" })).toBe("/api/fs/other/custom-media/x.png");
  });
});

describe("downloadMedia", () => {
  it("fetches the media blob and triggers a download link", async () => {
    const blob = new Blob(["fake-image"], { type: "image/png" });
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
      await downloadMedia("panda.png");
      expect(fetchMock).toHaveBeenCalled();
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [calledUrl, calledInit] = call!;
      expect(calledUrl).toBe("/api/fs/posix/.tokenring/media-library/panda.png");
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

  it("revokes the object URL even when click throws", async () => {
    const blob = new Blob(["fake-image"], { type: "image/png" });
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    const createObjectURL = mock(() => "blob:leaky");
    const revokeObjectURL = mock(() => {});
    // Primary path click fails (triggers outer catch + fallback); fallback succeeds.
    let clickCount = 0;
    const click = mock(() => {
      clickCount += 1;
      if (clickCount === 1) throw new Error("click failed");
    });
    const remove = mock(() => {});

    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(blob),
      } as Response),
    ) as unknown as typeof fetch;
    URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
    document.createElement = ((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: click });
        Object.defineProperty(el, "remove", { value: remove });
      }
      return el;
    }) as typeof document.createElement;

    try {
      await downloadMedia("panda.png");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:leaky");
      // Primary anchor removed in finally even after click threw; fallback also removes.
      expect(remove).toHaveBeenCalled();
      expect(clickCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      document.createElement = originalCreateElement;
    }
  });
});

describe("aspectLabel", () => {
  it("classifies square, wide, and tall", () => {
    expect(aspectLabel(100, 100)).toBe("Square");
    expect(aspectLabel(1600, 900)).toBe("Wide");
    expect(aspectLabel(900, 1600)).toBe("Tall");
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss and ignores empty values", () => {
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(125.9)).toBe("2:05");
  });
});

describe("keywordsFromPrompt", () => {
  it("splits and trims punctuation", () => {
    expect(keywordsFromPrompt("A serene mountain lake at sunset!")).toEqual(["A", "serene", "mountain", "lake", "at", "sunset"]);
  });

  it("respects the limit", () => {
    expect(keywordsFromPrompt("one two three four", 2)).toEqual(["one", "two"]);
  });
});

describe("workOnMediaMessage", () => {
  it("includes kind, filename, url, and keywords", () => {
    const msg = workOnMediaMessage("image", "panda.png", ["panda", "wildlife"]);
    expect(msg).toContain("image");
    expect(msg).toContain("Filename: panda.png");
    expect(msg).toContain("URL: /api/fs/posix/.tokenring/media-library/panda.png");
    expect(msg).toContain("Keywords: panda, wildlife");
  });
});
