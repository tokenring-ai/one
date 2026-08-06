# TokenRing One Frontend (`@tokenring-ai/one-frontend`)

React web interface for TokenRing agents with CLI-style chat, app pages, and real-time agent streaming.

This is a **monorepo workspace package**, not a separately published npm/deb/rpm artifact. Production serves the UI by importing `frontend/plugin.ts` into the backend (`@tokenring-ai/one-backend`), which registers HTML routes on the web host. The compiled backend binary therefore already includes the web UI.

## Development

From the monorepo root (full app with RPC + UI):

```bash
bun install
bun run run:one
```

Standalone HTML entry (UI only, no backend RPC):

```bash
cd frontend
bun ./index.html --port=5173
```

## Test

```bash
bun run test
bun run test:watch
bun run test:coverage
```
