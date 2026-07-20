import { YAML } from "bun";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../");

function getSubdirectories(srcPath: string) {
  const filePath = path.join(rootDir, srcPath);
  if (!fs.existsSync(filePath)) return [];
  return fs
  .readdirSync(filePath)
  .filter((f) => fs.statSync(path.join(filePath, f)).isDirectory())
  .sort()
  .map((f) => f);
}

function makeFileTreeEntry(pkgRoot: string, dir: string, resources: Record<string, any>) {
 const name = `fileTree/${pkgRoot}/${dir}`;
 resources[name] = {
  type: "fileTree",
  description: `${pkgRoot}/${dir} File Tree`,
  items: [
   {
    path: `./${pkgRoot}/${dir}`,
    include: "\\.(txt|tsx?|jsx?|md|json|yaml)$",
   },
  ],
 };
}

function makeRepoMapEntry(pkgRoot: string, dir: string, resources: Record<string, any>) {
 const name = `repoMap/${pkgRoot}/${dir}`;
 resources[name] = {
  type: "repoMap",
  description: `${pkgRoot}/${dir} Repo Map`,
  items: [
   {
    path: `./${pkgRoot}/${dir}`,
    include: "\\.(txt|tsx?|jsx?|md|json|yaml)$",
   },
  ],
 };
}

function makeWholeFileEntry(pkgRoot: string, dir: string, resources: Record<string, any>) {
 const name = `wholeFile/${pkgRoot}/${dir}`;
 resources[name] = {
  type: "wholeFile",
  description: `${pkgRoot}/${dir} Source Files`,
  items: [
   {
    path: `./${pkgRoot}/${dir}`,
    include: "\\.(txt|tsx?|jsx?|md|json)$",
    exclude: "/test/|\\.test\\."
   },
  ],
 };
}

const packageRoots = ["plugin"];
const dynamicCodebaseResources = {};
const dynamicRepoMapResources = {};

for (const pkgRoot of packageRoots) {
 const dirs = getSubdirectories(pkgRoot);
 for (const dir of ["frontend","backend",...dirs]) {
  makeFileTreeEntry(pkgRoot, dir, dynamicCodebaseResources);
  makeRepoMapEntry(pkgRoot, dir, dynamicRepoMapResources);
  makeWholeFileEntry(pkgRoot, dir, dynamicCodebaseResources);
 }
}

const configFile = path.resolve(import.meta.dir, "configs/codebase.yaml")

fs.writeFileSync(configFile, YAML.stringify({
  codebase: {
    resources: {
      ...dynamicRepoMapResources,
      ...dynamicCodebaseResources,
    },
  },
}, null, 2));
