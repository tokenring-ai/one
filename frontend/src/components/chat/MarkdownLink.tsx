import type { AnchorHTMLAttributes, ClassAttributes } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { Link } from "react-router-dom";
import { resolveAppLink } from "../../lib/appLinks.ts";

const linkClassName = "text-accent hover:text-accent-soft underline-offset-2 hover:underline focus-ring rounded-sm";

type MarkdownAnchorProps = ClassAttributes<HTMLAnchorElement> & AnchorHTMLAttributes<HTMLAnchorElement> & ExtraProps;

/** Absolute http(s) and protocol-relative URLs open outside the app. */
export function isExternalHttpUrl(href: string | null | undefined): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("//");
}

/**
 * react-markdown `a` renderer:
 * - custom app schemes (agent://…) → in-app routes
 * - same-origin relative paths (/foo) → in-app routes
 * - http(s) absolute URLs → new tab
 * - other schemes (mailto:, …) → normal link behavior
 */
export function MarkdownAnchor({ href, children }: MarkdownAnchorProps) {
  const appPath = resolveAppLink(href);

  if (appPath) {
    return (
      <Link to={appPath} className={linkClassName}>
        {children}
      </Link>
    );
  }

  if (href?.startsWith("/") && !href.startsWith("//")) {
    return (
      <Link to={href} className={linkClassName}>
        {children}
      </Link>
    );
  }

  if (isExternalHttpUrl(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} className={linkClassName}>
      {children}
    </a>
  );
}

/** Drop-in partial for ReactMarkdown `components`. */
export const markdownLinkComponents: Pick<Components, "a"> = {
  a: MarkdownAnchor,
};
