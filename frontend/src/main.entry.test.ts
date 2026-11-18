import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("entry point ordering", () => {
  it("imports the access-link boot before anything else, so the token is stripped before other modules evaluate", () => {
    const source = readFileSync(join(import.meta.dir, "main.tsx"), "utf8");
    const imports = [...source.matchAll(/^import\s.*$/gm)].map(match => match[0]);
    expect(imports[0]).toBe('import "./accessLinkBoot.ts";');
  });

  it("keeps the boot free of imports that could read the URL or open connections", () => {
    const boot = readFileSync(join(import.meta.dir, "accessLinkBoot.ts"), "utf8");
    const imports = [...boot.matchAll(/^import\s.*from\s+"(.*)"/gm)].map(match => match[1]);
    expect(imports).toEqual(["./lib/accessLink.ts"]);
    const lib = readFileSync(join(import.meta.dir, "lib/accessLink.ts"), "utf8");
    expect(lib).not.toMatch(/^import\s/m);
  });
});
