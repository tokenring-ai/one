import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { installMixTokens, MIX_TOKENS_CSS } from "./mixTokens.ts";

const TOKENS = readFileSync(join(import.meta.dir, "tokens.css"), "utf8");

describe("runtime color-mix tokens", () => {
  it("carries every color-mix declaration in tokens.css", () => {
    const declarations = TOKENS.split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("--") && line.includes("color-mix"));
    expect(declarations.length).toBeGreaterThan(10);
    for (const declaration of declarations) expect(MIX_TOKENS_CSS).toContain(declaration);
  });

  it("installs its stylesheet once", () => {
    installMixTokens();
    installMixTokens();
    expect(document.querySelectorAll("style#tokenring-mix-tokens")).toHaveLength(1);
  });
});
