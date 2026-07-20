import { Code, FileText, Folder, Image as ImageIcon } from "lucide-react";
import { createElement } from "react";

export const getBasename = (p: string) => {
  const clean = p.endsWith("/") ? p.slice(0, -1) : p;
  return clean.split("/").pop() || p;
};

export type FileIconVariant = "app" | "overlay";

export function getFileIcon(file: string, isDir: boolean, size = 16, variant: FileIconVariant = "app") {
  const shrink = variant === "app" ? " shrink-0" : "";
  if (isDir) return createElement(Folder, { className: `text-accent-soft${shrink}`, size });
  if (/\.(tsx?|jsx?)$/.test(file)) return createElement(FileText, { className: `text-cyan-500${shrink}`, size });
  if (file.endsWith(".json")) return createElement(Code, { className: `text-amber-500${shrink}`, size });
  if (file.endsWith(".md")) return createElement(FileText, { className: `text-purple-400${shrink}`, size });
  if (/\.(png|jpe?g|gif|svg|webp)$/i.test(file)) {
    const imageColor = variant === "app" ? "text-pink-400" : "text-purple-400";
    return createElement(ImageIcon, { className: `${imageColor}${shrink}`, size });
  }
  return createElement(FileText, { className: `text-muted${shrink}`, size });
}
