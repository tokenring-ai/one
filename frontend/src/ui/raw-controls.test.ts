import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ratchet: hand-rolled accent buttons and field chrome should not spread.
 * Lower the ceilings when you migrate a call site. Do not raise them.
 */
const BUTTON_CEILING = 32;
const FIELD_CEILING = 82;

const FRONTEND_SRC = join(import.meta.dir, "..");
const PLUGIN_ROOT = join(import.meta.dir, "../../../plugin");
const SKIP = new Set(["node_modules", "dist", "raw-controls.test.ts"]);

function filesIn(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) filesIn(path, out);
    else if (/\.(tsx|ts|css)$/.test(entry)) out.push(path);
  }
  return out;
}

function count(needle: string): number {
  let total = 0;
  for (const file of filesIn(FRONTEND_SRC).concat(filesIn(PLUGIN_ROOT))) {
    const text = readFileSync(file, "utf8");
    let index = 0;
    while (true) {
      const found = text.indexOf(needle, index);
      if (found < 0) break;
      total += 1;
      index = found + needle.length;
    }
  }
  return total;
}

describe("raw control ratchet", () => {
  it("does not add new btn-accent call sites", () => {
    expect(count("btn-accent")).toBeLessThanOrEqual(BUTTON_CEILING);
  });

  it("does not add new hand-styled fields", () => {
    expect(count("bg-input border border-primary") + count("bg-input border border-control")).toBeLessThanOrEqual(FIELD_CEILING);
  });
});
