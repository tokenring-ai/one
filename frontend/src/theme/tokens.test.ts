import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEMES, type ThemeDef } from "./themes.ts";

const css = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");

function block(selector: ":root" | ".dark"): string {
  const marker = `${selector} {`;
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`missing ${selector}`);
  const next = selector === ":root" ? css.indexOf(".dark {", start) : css.length;
  return css.slice(start, next);
}

const IN_BOTH = [
  "--bg-primary",
  "--bg-secondary",
  "--bg-sidebar",
  "--bg-tertiary",
  "--bg-hover",
  "--bg-active",
  "--bg-input",
  "--bg-overlay",
  "--border-primary",
  "--accent-primary",
  "--accent-primary-hover",
  "--accent-primary-soft",
  "--text-on-accent",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-dim",
  "--selection",
  "--status-info-fg",
  "--status-success-fg",
  "--status-warning-fg",
  "--status-danger-fg",
  "--status-warning-solid",
  "--status-danger-solid",
  "--elevation-card",
  "--elevation-button",
  "--elevation-popover",
  "--elevation-overlay",
  "--elevation-accent",
  "--terminal-bg",
  "--terminal-fg",
  "--border-subtle",
  "--border-default",
  "--border-strong",
  "--border-control",
  "--surface-raised",
] as const;

/** CSS variable each concrete ThemeDef value is declared under, in its mode's block. */
const THEME_VARS: [string, (theme: ThemeDef) => string][] = [
  ["--bg-primary", t => t.surface.canvas],
  ["--bg-secondary", t => t.surface.base],
  ["--bg-tertiary", t => t.surface.sunken],
  ["--bg-hover", t => t.surface.hover],
  ["--bg-active", t => t.surface.active],
  ["--bg-input", t => t.surface.input],
  ["--bg-overlay", t => t.surface.overlay],
  ["--surface-raised", t => t.surface.raised],
  ["--border-primary", t => t.border.default],
  ["--border-subtle", t => t.border.subtle],
  ["--border-strong", t => t.border.strong],
  ["--border-control", t => t.border.control],
  ["--text-primary", t => t.fg.default],
  ["--text-secondary", t => t.fg.secondary],
  ["--text-muted", t => t.fg.muted],
  ["--text-dim", t => t.fg.dim],
  ["--text-on-accent", t => t.fg.onAccent],
  ["--status-info-fg", t => t.status.info],
  ["--status-success-fg", t => t.status.success],
  ["--status-warning-fg", t => t.status.warning],
  ["--status-danger-fg", t => t.status.danger],
  ["--status-warning-solid", t => t.statusSolid.warning],
  ["--status-danger-solid", t => t.statusSolid.danger],
  ["--terminal-bg", t => t.terminal.bg],
  ["--terminal-fg", t => t.terminal.fg],
];

describe("theme tokens", () => {
  it("defines the palette in both modes", () => {
    const light = block(":root");
    const dark = block(".dark");
    for (const name of IN_BOTH) {
      expect(light, name).toContain(name);
      expect(dark, name).toContain(name);
    }
  });

  it("derives text and status fills from the status foregrounds", () => {
    const light = block(":root");
    for (const name of ["--text-error", "--text-warning", "--text-success", "--status-success-bg", "--status-danger-border", "--focus-ring", "--z-modal"]) {
      expect(light).toContain(name);
    }
  });

  it("matches the ThemeDefs used by Monaco, the terminal and the page chrome", () => {
    const light = block(":root");
    const dark = block(".dark");
    for (const [variable, read] of THEME_VARS) {
      expect(light).toContain(`${variable}: ${read(THEMES.paper)};`);
      expect(dark).toContain(`${variable}: ${read(THEMES.charcoal)};`);
    }
  });

  it("keeps the editor surface on the theme canvas", () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.syntax.background).toBe(theme.surface.canvas);
      expect(theme.syntax.foreground).toBe(theme.fg.default);
      expect(theme.syntax.widgetBorder).toBe(theme.border.default);
    }
  });

  it("defines density scales and the accent-derived tokens", () => {
    for (const name of ["--tab-h", "--head-h", "--control-h", "--pane-gap", "--rail-w", "--pane-radius", "--accent-tint", "--accent-line"]) {
      expect(block(":root")).toContain(name);
    }
    expect(css).toContain(':root[data-density="compact"]');
    expect(css).toContain(':root[data-density="comfortable"]');
  });
});
