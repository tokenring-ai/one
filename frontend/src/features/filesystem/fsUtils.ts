import { formatBytes } from "@tokenring-ai/utility/number/formatBytes";
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

/** Best-effort MIME type for browser downloads (download attribute still uses basename). */
export function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "text/javascript";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "text/plain";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".gz") || lower.endsWith(".tgz")) return "application/gzip";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (isLikelyTextFile(path)) return "text/plain";
  return "application/octet-stream";
}

/** Decode base64 into bytes for Blob construction (binary-safe downloads). */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Trigger a browser download from an in-memory Blob. */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number | undefined | null): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  return formatBytes(bytes);
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
