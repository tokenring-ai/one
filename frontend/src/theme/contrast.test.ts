import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MONACO_TOKEN_FIXES } from "./bridges/monaco.ts";
import { ACCENT_IDS, ACCENTS, type AccentId, THEMES, type ThemeDef } from "./themes.ts";

/**
 * WCAG 2.x contrast for every text, status and indicator pair the themes define.
 * `themes.ts` is the source of truth for values and tokens.test.ts keeps tokens.css
 * in step with it, so checking the definitions checks both.
 */

type Rgb = [number, number, number];

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(value);
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: Number(rgba[4]) };
  let hex = value.replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) throw new Error(`Cannot parse color ${value}`);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map(c => c + c)
      .join("");
  return { rgb: [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb, alpha: 1 };
}

/** `top` at `alpha` painted over the opaque `bottom`. */
function over(top: string, alpha: number, bottom: string): string {
  const t = parseColor(top).rgb;
  const b = parseColor(bottom).rgb;
  const mixed = t.map((c, i) => Math.round(c * alpha + b[i]! * (1 - alpha)));
  return `#${mixed.map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(color: string): number {
  const [r, g, b] = parseColor(color).rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const NORMAL = 4.5;
const LARGE_OR_UI = 3;

const MODES = Object.values(THEMES);

/** Every opaque surface text can sit on, including the hover and selected overlays on the main ones. */
function surfaces(theme: ThemeDef, accent: AccentId): Record<string, string> {
  const { canvas, base, raised, sunken, input, hover, active } = theme.surface;
  const hoverOverlay = parseColor(hover);
  // Selected rows are the accent at 10% in Paper (tokens.css --bg-active) and a flat white overlay in Charcoal.
  const selected = theme.mode === "light" ? { color: ACCENTS[accent].color, alpha: 0.1 } : { color: "#ffffff", alpha: parseColor(active).alpha };
  const out: Record<string, string> = { canvas, base, raised, sunken, input };
  for (const [name, bg] of Object.entries({ canvas, base, raised, sunken })) {
    out[`${name}+hover`] = over(`#${hoverOverlay.rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`, hoverOverlay.alpha, bg);
    out[`${name}+selected`] = over(selected.color, selected.alpha, bg);
  }
  return out;
}

function failures(pairs: Array<{ label: string; fg: string; bg: string }>, minimum: number): string[] {
  return pairs.filter(p => contrast(p.fg, p.bg) < minimum).map(p => `${p.label}: ${contrast(p.fg, p.bg).toFixed(2)}:1 (${p.fg} on ${p.bg}), needs ${minimum}`);
}

describe("theme contrast: text", () => {
  for (const theme of MODES) {
    it(`${theme.label}: body, secondary, muted and dim text on every surface`, () => {
      const pairs = [];
      for (const [surface, bg] of Object.entries(surfaces(theme, "indigo"))) {
        for (const [name, fg] of Object.entries({ default: theme.fg.default, secondary: theme.fg.secondary, muted: theme.fg.muted, dim: theme.fg.dim })) {
          pairs.push({ label: `${theme.id} ${name} on ${surface}`, fg, bg });
        }
      }
      expect(failures(pairs, NORMAL)).toEqual([]);
    });

    it(`${theme.label}: status text on surfaces and on its own tint`, () => {
      const { canvas, base, raised, sunken, input } = theme.surface;
      const pairs = [];
      for (const [surface, bg] of Object.entries({ canvas, base, raised, sunken, input })) {
        for (const [name, fg] of Object.entries(theme.status)) {
          pairs.push({ label: `${theme.id} ${name} on ${surface}`, fg, bg });
          // --status-*-bg: the foreground at 12% (14% for warning) over the surface.
          pairs.push({ label: `${theme.id} ${name} on its tint over ${surface}`, fg, bg: over(fg, name === "warning" ? 0.14 : 0.12, bg) });
        }
      }
      expect(failures(pairs, NORMAL)).toEqual([]);
    });

    it(`${theme.label}: text on the accent and status fills, and editor line numbers`, () => {
      const pairs = [
        ...ACCENT_IDS.map(id => ({ label: `${theme.id} on-accent on ${id}`, fg: theme.fg.onAccent, bg: ACCENTS[id].color })),
        { label: `${theme.id} on-accent on warning-solid`, fg: theme.fg.onAccent, bg: theme.statusSolid.warning },
        { label: `${theme.id} on-accent on danger-solid`, fg: theme.fg.onAccent, bg: theme.statusSolid.danger },
        { label: `${theme.id} line numbers`, fg: theme.syntax.lineNumber, bg: theme.syntax.background },
        { label: `${theme.id} terminal`, fg: theme.terminal.fg, bg: theme.terminal.bg },
      ];
      expect(failures(pairs, NORMAL)).toEqual([]);
    });

    it(`${theme.label}: terminal colors are legible on the terminal background`, () => {
      // The color that is the background's own (black on dark, white on light) is not meant to be read.
      const skip = new Set(theme.mode === "light" ? ["white", "brightWhite"] : ["black"]);
      const pairs = Object.entries(theme.terminal.ansi)
        .filter(([name]) => !skip.has(name))
        .map(([name, fg]) => ({ label: `${theme.id} ansi ${name}`, fg, bg: theme.terminal.bg }));
      expect(failures(pairs, NORMAL)).toEqual([]);
    });

    it(`${theme.label}: selected text stays readable on the selection color`, () => {
      const alpha = theme.mode === "light" ? 0.3 : 0.5;
      const pairs = ACCENT_IDS.map(id => ({
        label: `${theme.id} selection ${id}`,
        fg: theme.fg.default,
        bg: over(ACCENTS[id].color, alpha, theme.surface.canvas),
      }));
      expect(failures(pairs, NORMAL)).toEqual([]);
    });
  }
});

describe("theme contrast: accents", () => {
  it("accent text, in the shade each mode uses for text, is readable on the main surfaces", () => {
    const pairs = [];
    for (const theme of MODES) {
      const { canvas, base, raised } = theme.surface;
      for (const id of ACCENT_IDS) {
        // Informational accent text is text-accent-soft in both modes (links, badges, active labels).
        // The solid accent (text-accent) is for icons, large text and fills, held to the 3:1 check below.
        const fg = theme.mode === "light" ? ACCENTS[id].light.soft : ACCENTS[id].dark.soft;
        for (const [surface, bg] of Object.entries({ canvas, base, raised })) pairs.push({ label: `${theme.id} ${id} accent text on ${surface}`, fg, bg });
      }
    }
    expect(failures(pairs, NORMAL)).toEqual([]);
  });

  it("the solid accent stands out as a boundary or large text on every surface (3:1)", () => {
    const pairs = [];
    for (const theme of MODES) {
      const { canvas, base, raised } = theme.surface;
      for (const id of ACCENT_IDS) {
        for (const [surface, bg] of Object.entries({ canvas, base, raised }))
          pairs.push({ label: `${theme.id} ${id} accent on ${surface}`, fg: ACCENTS[id].color, bg });
      }
    }
    expect(failures(pairs, LARGE_OR_UI)).toEqual([]);
  });
});

describe("theme contrast: accent text on accent tints", () => {
  // bg-accent-subtle (8% Paper / 10% Charcoal), bg-accent-tint (13%), bg-accent-muted (15%) and its hover (25%),
  // painted over the surfaces a badge, tab or link row sits on. Wells (sunken) are excluded for the 25% hover:
  // the muted fill is not used there.
  for (const theme of MODES) {
    it(`${theme.label}: text-accent-soft is 4.5:1 on every accent tint`, () => {
      const { canvas, base, raised, sunken } = theme.surface;
      const pairs = [];
      for (const id of ACCENT_IDS) {
        const fg = theme.mode === "light" ? ACCENTS[id].light.soft : ACCENTS[id].dark.soft;
        const tints: Array<[string, number]> = [
          ["subtle", theme.mode === "light" ? 0.08 : 0.1],
          ["tint", 0.13],
          ["muted", 0.15],
        ];
        for (const [surface, bg] of Object.entries({ canvas, base, raised, sunken })) {
          for (const [tint, alpha] of tints) pairs.push({ label: `${theme.id} ${id} on ${tint} over ${surface}`, fg, bg: over(ACCENTS[id].color, alpha, bg) });
        }
        for (const [surface, bg] of Object.entries({ canvas, base, raised }))
          pairs.push({ label: `${theme.id} ${id} on muted hover over ${surface}`, fg, bg: over(ACCENTS[id].color, 0.25, bg) });
      }
      expect(failures(pairs, NORMAL)).toEqual([]);
    });
  }
});

describe("theme contrast: code syntax", () => {
  const css = readFileSync(join(import.meta.dir, "../index.css"), "utf8");
  /** The hljs colors for one mode: `.hljs-x { color: #... }` (Paper) or `.dark .hljs-x { ... }` (Charcoal). */
  function hljsColors(dark: boolean): Array<{ selector: string; color: string }> {
    const out = [];
    for (const match of css.matchAll(/((?:\.dark )?\.hljs[^{]*)\{\s*color:\s*(#[0-9a-f]{6})/gi)) {
      const selector = match[1]!.trim();
      if (selector.startsWith(".dark") === dark) out.push({ selector: selector.split(",")[0]!.replace(/\s+/g, " "), color: match[2]! });
    }
    return out;
  }

  for (const [theme, dark] of [
    [THEMES.paper, false],
    [THEMES.charcoal, true],
  ] as const) {
    it(`${theme.label}: highlight.js tokens are 4.5:1 on the code block background (the sunken surface)`, () => {
      const colors = hljsColors(dark);
      expect(colors.length).toBeGreaterThanOrEqual(8);
      expect(failures(colors.map(c => ({ label: `${theme.id} ${c.selector}`, fg: c.color, bg: theme.surface.sunken })), NORMAL)).toEqual([]);
    });

    it(`${theme.label}: Monaco token colors, built in plus our fixes, are 4.5:1 on the editor background`, () => {
      const monaco = readFileSync(join(import.meta.dir, "../../../node_modules/monaco-editor/esm/vs/editor/standalone/common/themes.js"), "utf8");
      // The first rules array is `vs`, the second `vs-dark`.
      const rules = monaco.split("rules: [")[dark ? 2 : 1]!.split("]")[0]!;
      const fixes = new Map(MONACO_TOKEN_FIXES[theme.mode].map(f => [f.token, f.foreground]));
      const pairs = [];
      for (const rule of rules.matchAll(/token: '([^']*)', foreground: '([0-9a-fA-F]{6})'/g)) {
        const token = rule[1]!;
        if (token === "" || token === "invalid") continue;
        pairs.push({ label: `${theme.id} monaco ${token}`, fg: `#${fixes.get(token) ?? rule[2]!}`, bg: theme.syntax.background });
      }
      expect(pairs.length).toBeGreaterThan(20);
      expect(failures(pairs, NORMAL)).toEqual([]);
    });
  }
});

describe("theme contrast: focus indicator", () => {
  it("the focus ring (the solid accent, --focus-ring) is 3:1 against the surface it sits on", () => {
    const pairs = [];
    for (const theme of MODES) {
      const { canvas, base, raised, input } = theme.surface;
      for (const id of ACCENT_IDS) {
        for (const [surface, bg] of Object.entries({ canvas, base, raised, input }))
          pairs.push({ label: `${theme.id} ${id} focus on ${surface}`, fg: ACCENTS[id].color, bg });
      }
    }
    expect(failures(pairs, LARGE_OR_UI)).toEqual([]);
  });

  it("declares the focus ring as the solid accent", () => {
    const css = Bun.file(`${import.meta.dir}/tokens.css`);
    return css.text().then(text => expect(text).toMatch(/--focus-ring:\s*var\(--accent-primary\);/));
  });
});

describe("theme contrast: control borders (WCAG 1.4.11)", () => {
  /** Every surface a field can sit on: the plain surfaces and their hover and selected overlays, for every accent. */
  function controlSurfaces(theme: ThemeDef): Record<string, string> {
    const out: Record<string, string> = {};
    const hover = parseColor(theme.surface.hover);
    const hoverHex = `#${hover.rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
    for (const accent of ACCENT_IDS) {
      for (const [name, bg] of Object.entries(surfaces(theme, accent))) out[`${name} (${accent})`] = bg;
    }
    for (const [name, bg] of Object.entries({ sunken: theme.surface.sunken, input: theme.surface.input })) {
      out[`${name}+hover`] = over(hoverHex, hover.alpha, bg);
    }
    return out;
  }

  for (const theme of MODES) {
    it(`${theme.label}: --border-control is 3:1 against every surface a control sits on`, () => {
      const pairs = Object.entries(controlSurfaces(theme)).map(([surface, bg]) => ({
        label: `${theme.id} border-control on ${surface}`,
        fg: theme.border.control,
        bg,
      }));
      expect(failures(pairs, LARGE_OR_UI)).toEqual([]);
    });

    it(`${theme.label}: the decorative divider border stays decorative (unchanged, below 3:1)`, () => {
      expect(contrast(theme.border.default, theme.surface.base)).toBeLessThan(LARGE_OR_UI);
      expect(theme.border.control).not.toBe(theme.border.default);
    });
  }

  it("exposes the token and the border-control utility", () => {
    const tokens = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");
    const index = readFileSync(join(import.meta.dir, "../index.css"), "utf8");
    expect(tokens.match(/--border-control:/g)?.length).toBe(2);
    expect(index).toContain("--color-control: var(--border-control);");
  });

  it("shared control components draw their boundary with border-control", () => {
    const read = (path: string) => readFileSync(join(import.meta.dir, "..", path), "utf8");
    expect(read("ui/control.ts")).toContain("border-control");
    expect(read("ui/control.ts")).not.toMatch(/border-primary/);
    expect(read("ui/switch.tsx")).toContain("border-control");
    expect(read("ui/segmented-control.tsx")).toContain("border-control");
    expect(read("components/ui/DataGrid.tsx")).toContain("border-control");
    expect(read("components/chat/ChatFooter.tsx")).toContain("border border-control");
    expect(read("components/overlay/login-overlay.tsx")).toContain("border-control");
  });

  it("no raw field in the app source pairs the input background with the decorative border", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules") continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry) && /bg-input border border-primary/.test(readFileSync(path, "utf8"))) offenders.push(path);
      }
    };
    walk(join(import.meta.dir, ".."));
    expect(offenders).toEqual([]);
  });
});

describe("contrast helper", () => {
  it("matches the WCAG reference ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });
});
