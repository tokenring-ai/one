import { describe, expect, test } from "bun:test";
import { formatFileSize, getBasename, getParentPath, isHiddenEntry, isHiddenPath, isImageFile, isLikelyTextFile, joinPath } from "./fsUtils.ts";

describe("getBasename", () => {
  test("returns last segment", () => {
    expect(getBasename("src/features/file.ts")).toBe("file.ts");
    expect(getBasename("file.ts")).toBe("file.ts");
  });

  test("strips trailing slash for directories", () => {
    expect(getBasename("src/features/")).toBe("features");
  });
});

describe("getParentPath", () => {
  test("returns parent directory", () => {
    expect(getParentPath("src/features/file.ts")).toBe("src/features");
    expect(getParentPath("file.ts")).toBe(".");
    expect(getParentPath("src/")).toBe(".");
  });
});

describe("joinPath", () => {
  test("joins under root", () => {
    expect(joinPath(".", "a.ts")).toBe("a.ts");
    expect(joinPath("", "a.ts")).toBe("a.ts");
  });

  test("joins under directory", () => {
    expect(joinPath("src", "a.ts")).toBe("src/a.ts");
    expect(joinPath("src/", "a.ts")).toBe("src/a.ts");
  });
});

describe("isHiddenEntry", () => {
  test("detects dotfiles", () => {
    expect(isHiddenEntry(".env")).toBe(true);
    expect(isHiddenEntry("src/.gitkeep")).toBe(true);
    expect(isHiddenEntry("readme.md")).toBe(false);
  });
});

describe("isHiddenPath", () => {
  test("detects any hidden segment", () => {
    expect(isHiddenPath(".git/config")).toBe(true);
    expect(isHiddenPath("src/.env")).toBe(true);
    expect(isHiddenPath("src/app.ts")).toBe(false);
  });
});

describe("isLikelyTextFile / isImageFile", () => {
  test("images", () => {
    expect(isImageFile("photo.png")).toBe(true);
    expect(isLikelyTextFile("photo.png")).toBe(false);
  });

  test("text sources", () => {
    expect(isLikelyTextFile("app.tsx")).toBe(true);
    expect(isLikelyTextFile("notes.md")).toBe(true);
  });

  test("archives and binaries", () => {
    expect(isLikelyTextFile("a.zip")).toBe(false);
    expect(isLikelyTextFile("lib.so")).toBe(false);
  });
});

describe("formatFileSize", () => {
  test("formats units", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });
});
