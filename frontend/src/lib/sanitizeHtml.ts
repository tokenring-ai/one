import type { Config } from "dompurify";
import DOMPurify from "dompurify";

const BLOG_HTML_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel"],
};

/**
 * Email bodies often use legacy layout tags/attrs and cid: image URLs.
 * Scripts, event handlers, and javascript: URLs are still stripped by DOMPurify.
 */
const EMAIL_HTML_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ["center", "font"],
  ADD_ATTR: [
    "target",
    "rel",
    "align",
    "valign",
    "bgcolor",
    "border",
    "cellpadding",
    "cellspacing",
    "width",
    "height",
    "color",
    "face",
    "size",
    "colspan",
    "rowspan",
    "background",
  ],
  ALLOW_DATA_ATTR: false,
  // Allow common email URI schemes including cid: for inline attachments.
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|cid):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, BLOG_HTML_CONFIG);
}

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, EMAIL_HTML_CONFIG);
}
