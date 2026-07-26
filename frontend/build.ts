import { watch } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import tailwindPlugin from "./tailwind-plugin.ts";

const args = new Set(process.argv.slice(2));
const isWatch = args.has("--watch");
const minify = !args.has("--no-minify");

const root = import.meta.dir;
const outdir = path.join(root, "dist");

async function build(): Promise<boolean> {
  await rm(outdir, { recursive: true, force: true });

  const result = await Bun.build({
    entrypoints: [path.join(root, "index.html")],
    outdir,
    minify,
    target: "browser",
    plugins: [tailwindPlugin],
    // Absolute URLs so SPA client routes (e.g. /agents) still load assets correctly
    publicPath: "/",
    naming: {
      chunk: "assets/[name]-[hash].[ext]",
      asset: "assets/[name]-[hash].[ext]",
    },
  });

  if (!result.success) {
    console.error("Frontend build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    return false;
  }

  const outputs = result.outputs.map(output => path.relative(root, output.path));
  console.log(`Built ${outputs.length} files${minify ? " (minified)" : ""}:`);
  for (const output of outputs) {
    console.log(`  ${output}`);
  }
  return true;
}

const ok = await build();
if (!ok && !isWatch) {
  process.exit(1);
}

if (isWatch) {
  let building = false;
  let pending = false;

  const rebuild = async () => {
    if (building) {
      pending = true;
      return;
    }
    building = true;
    try {
      console.log("\nRebuilding...");
      await build();
    } finally {
      building = false;
      if (pending) {
        pending = false;
        await rebuild();
      }
    }
  };

  const onChange = () => {
    void rebuild();
  };

  watch(path.join(root, "src"), { recursive: true }, onChange);
  watch(path.join(root, "index.html"), onChange);

  console.log("Watching for changes...");
}
