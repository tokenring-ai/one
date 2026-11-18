/**
 * The theme tokens built with `color-mix()` (tints of the accent and status
 * colours), injected at runtime.
 *
 * tokens.css declares them too, but the server's CSS bundler can't resolve
 * `var()` inside `color-mix()`: it keeps only its solid fallback, so every tint
 * (active rows, status fills, focus rings) rendered as the full colour. A
 * string in JS is left alone, and an unlayered rule outranks tokens.css's
 * `@layer base`. mixTokens.test.ts keeps this list in step with tokens.css.
 */
export const MIX_TOKENS_CSS = `:root {
  --bg-active: color-mix(in srgb, var(--accent-primary) 10%, transparent);
  --selection: color-mix(in srgb, var(--accent-primary) 30%, transparent);
  --status-info-bg: color-mix(in srgb, var(--status-info-fg) 12%, transparent);
  --status-info-border: color-mix(in srgb, var(--status-info-fg) 35%, transparent);
  --status-success-bg: color-mix(in srgb, var(--status-success-fg) 12%, transparent);
  --status-success-border: color-mix(in srgb, var(--status-success-fg) 35%, transparent);
  --status-warning-bg: color-mix(in srgb, var(--status-warning-fg) 14%, transparent);
  --status-warning-border: color-mix(in srgb, var(--status-warning-fg) 35%, transparent);
  --status-danger-bg: color-mix(in srgb, var(--status-danger-fg) 12%, transparent);
  --status-danger-border: color-mix(in srgb, var(--status-danger-fg) 35%, transparent);
  --accent-tint: color-mix(in oklab, var(--accent-primary) 13%, transparent);
  --accent-line: color-mix(in oklab, var(--accent-primary) 55%, transparent);
  --elevation-accent: 0 10px 15px -3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}
.dark {
  --selection: color-mix(in srgb, var(--accent-primary) 50%, transparent);
  --elevation-accent: 0 10px 15px -3px color-mix(in srgb, var(--accent-primary) 20%, transparent);
}`;

const STYLE_ID = "tokenring-mix-tokens";

/** Adds the stylesheet once. */
export function installMixTokens(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = MIX_TOKENS_CSS;
  doc.head.appendChild(style);
}
