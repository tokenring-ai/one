import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useLayoutApi } from "./context.ts";
import type { ViewParams } from "./types.ts";

interface PaneLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> {
  view: string;
  params?: ViewParams;
  /** Open as a preview item (replaced by the next preview). */
  preview?: boolean;
  children: ReactNode;
}

/**
 * A real link to a view in the current app: middle-click and ⌘-click open a
 * new browser tab; a plain click opens the view in this layout.
 */
export function PaneLink({ view, params = {}, preview, children, ...rest }: PaneLinkProps) {
  const api = useLayoutApi();
  const href = api.urlFor(view, params);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    api.open(view, params, preview ? { preview: true } : {});
  };
  return (
    <a {...rest} href={href ?? "#"} onClick={onClick}>
      {children}
    </a>
  );
}
