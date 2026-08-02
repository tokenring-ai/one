import { Code, FileText, Folder, Image as ImageIcon } from "lucide-react";
import { createElement } from "react";

export const getBasename = (p: string) => {
  const clean = p.endsWith("/") ? p.slice(0, -1) : p;
  return clean.split("/").pop() || p;
};

export const getParentPath = (p: string) => {
  const clean = p.endsWith("/") ? p.slice(0, -1) : p;
  const idx = clean.lastIndexOf("/");
  if (idx <= 0) return ".";
  return clean.slice(0, idx);
};

export const joinPath = (dir: string, name: string) => {
  const cleanName = name.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!cleanName) return dir === "." ? "" : dir;
  if (dir === "." || dir === "") return cleanName;
  return `${dir.replace(/\/+$/, "")}/${cleanName}`;
};

export const isDirectoryPath = (p: string) => p.endsWith("/");

export const isHiddenEntry = (p: string) => getBasename(p).startsWith(".");

/** True if any path segment is a dotfile/dotdir (e.g. `.git/config`, `src/.env`). */
export const isHiddenPath = (p: string) =>
  p
    .split("/")
    .filter(Boolean)
    .some(seg => seg.startsWith("."));

export const isImageFile = (p: string) => /\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i.test(p);

/** Extensions we treat as text-editable in the Files app editor. */
export const isLikelyTextFile = (p: string) => {
  if (isImageFile(p)) return false;
  if (
    /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tgz|bz2|xz|7z|rar|tar|woff2?|ttf|eot|mp3|mp4|webm|ogg|wav|mov|avi|mkv|bin|exe|dll|so|dylib|class|o|a|wasm)$/i.test(
      p,
    )
  ) {
    return false;
  }
  return true;
};

export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatFileDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export type FileIconVariant = "app" | "overlay";

export function getFileIcon(file: string, isDir: boolean, size = 16, variant: FileIconVariant = "app") {
  const shrink = variant === "app" ? " shrink-0" : "";
  if (isDir) return createElement(Folder, { className: `text-accent-soft${shrink}`, size });
  if (/\.(tsx?|jsx?)$/.test(file)) return createElement(FileText, { className: `text-cyan-500${shrink}`, size });
  if (file.endsWith(".json")) return createElement(Code, { className: `text-amber-500${shrink}`, size });
  if (file.endsWith(".md")) return createElement(FileText, { className: `text-purple-400${shrink}`, size });
  if (isImageFile(file)) {
    const imageColor = variant === "app" ? "text-pink-400" : "text-purple-400";
    return createElement(ImageIcon, { className: `${imageColor}${shrink}`, size });
  }
  return createElement(FileText, { className: `text-muted${shrink}`, size });
}
