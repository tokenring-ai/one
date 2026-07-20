# TokenRing One Frontend (`@tokenring-ai/one-frontend`)

React web interface for TokenRing agents with CLI-style chat, app pages, and real-time agent streaming.

## Development

From the monorepo root:

```bash
bun install
cd frontend/one
bun run dev
```

Or from `frontend/one` after dependencies are installed:

```bash
bun run dev
```

The Vite dev server runs on port 5173 by default. In production, built assets in `dist/` are served by the WebFrontendServer.

## Build

```bash
bun run build
bun run preview   # optional: preview production build locally
```

## Test

```bash
bun run test
bun run test:watch
bun run test:coverage
```