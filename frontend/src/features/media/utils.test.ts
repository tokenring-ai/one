import { describe, expect, it, mock } from "bun:test";
import { aspectLabel, downloadMedia, formatDuration, keywordsFromPrompt, mediaUrl, workOnMediaMessage } from "./utils.ts";

describe("mediaUrl", () => {
  it("encodes filenames for the static media path", () => {
    expect(mediaUrl("panda.png")).toBe("/api/media/panda.png");
    expect(mediaUrl("a b.png")).toBe("/api/media/a%20b.png");
  });
});

describe("downloadMedia", () => {
  it("fetches the media blob and triggers a download link", async () => {
    const blob = new Blob(["fake-image"], { type: "image/png" });
    const originalFetch = globalThis.fetch;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);

    const fetchMock = mock(() =>
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
      expect(fetchMock).toHaveBeenCalledWith("/api/media/panda.png");
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
    expect(msg).toContain("URL: /api/media/panda.png");
    expect(msg).toContain("Keywords: panda, wildlife");
  });
});
