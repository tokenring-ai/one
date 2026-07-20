import type { Config } from "dompurify";
import DOMPurify from "dompurify";

const BLOG_HTML_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel"],
};

/** Allows scripts/styles for live preview while stripping XSS vectors. */
const CANVAS_HTML_CONFIG: Config = {
  WHOLE_DOCUMENT: true,
  ADD_TAGS: ["script", "style", "link", "meta", "head", "body", "html", "title"],
  FORBID_TAGS: ["base", "object", "embed", "applet", "iframe", "frame", "frameset"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "oninput", "onchange", "onsubmit"],
};

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, BLOG_HTML_CONFIG);
}

export function sanitizeCanvasHtml(html: string): string {
  return DOMPurify.sanitize(html, CANVAS_HTML_CONFIG);
}
