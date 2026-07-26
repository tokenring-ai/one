import path from "node:path";
import { file } from "bun";

const root = path.resolve(import.meta.dir, "dist");
const indexFile = path.join(root, "index.html");
const port = Number(process.env.PORT ?? 4173);

if (!(await file(indexFile).exists())) {
  console.error(`No production build found at ${indexFile}. Run \`bun run build\` first.`);
  process.exit(1);
}

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = decodeURIComponent(url.pathname);
    const candidate = path.resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);

    // Prevent path traversal outside dist/
    if (candidate !== root && !candidate.startsWith(root + path.sep)) {
      return new Response("Not found", { status: 404 });
    }

    const asset = file(candidate);
    if (await asset.exists()) {
      return new Response(asset);
    }

    // SPA fallback
    return new Response(file(indexFile));
  },
});

console.log(`Preview server running at http://localhost:${server.port}`);
