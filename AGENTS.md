---
description: Repository Information Overview
alwaysApply: true
---

# TokenRing One Information

## Summary

TokenRing One is a local-first, multi-agent workspace that bundles five purpose-built apps — coding, canvas, documents, media, and research — into a single product. Same agents, same ecosystem, same configuration across every surface. It provides a chat interface where users can ask questions, issue commands, and interact with source code and content, leveraging AI to assist with code edits, refactors, testing, research, writing, publishing, and more.

## Structure

- **backend/**: Application entry point (`backend/tokenring.ts`), plugin composition (`backend/plugins.ts`), and packaged default config (`backend/config/`)
- **frontend/**: React single-page app served by the web host. Layout engine in `frontend/src/layout/`, shell (top bar, rail, app host) in `frontend/src/shell/`, core apps in `frontend/src/apps/`, shared UI under `frontend/src/components/` and `frontend/src/ui/`. Building apps and views: `docs/plugin-apps.md`
- **plugin/**: One directory per plugin (~65). Each plugin is a Bun workspace package registering services, chat tools, RPC endpoints, and web resources (`@tokenring-ai/<name>`)
- **features/**: Design mockups and product notes (not built or shipped)
- **registry/community/**: Marketplace item sources (agents, tools, workflows) with `scripts/generate-index.ts` rebuilding `registry.yaml`
- **schema/rpc/**: Generated JSON Schema for the RPC wire protocol (`schema:rpc` / `schema:check`)
- **util/**: Maintenance scripts (RPC schema export, package-file boilerplate sync)
- **cli/**: Rust crate for the standalone TokenRing CLI
- **packaging/**: Docker, deb, rpm, npm, and install-script packaging
- **docs/**: Docusaurus documentation site

## Language & Runtime

**Language**: TypeScript (ES2022) plus a small Rust CLI
**Build System**: TypeScript compiler (`tsc`); the backend runs from source under Bun
**Package Manager**: Bun (workspace root is the repo root)

## Dependencies

Dependencies are internal `@tokenring-ai/*` workspace packages plus third-party libraries. Security-sensitive transitive versions are pinned via the root `package.json` `overrides` block.

## Build & Installation

```bash
# Install dependencies
bun install

# Type-check the whole monorepo (backend + frontend + plugin)
bun run check:tsc

# Lint and format (auto-fix)
bun run check:biome
bun run check:oxlint

# Dead-code / unused-dependency analysis
bun run check:knip

# Regenerate / verify the RPC JSON schemas after changing plugin rpc schemas
bun run schema:rpc
bun run schema:check

# Run the backend from source (web UI on http://127.0.0.1:14008)
bun run run:one
```

## Docker

**Dockerfile**: packaging/docker/one/Dockerfile
**Base Image**: debian:trixie-slim
**Configuration**: Ships the prebuilt TokenRing One backend binary (web UI bundled inside) and optional CLI; runtime deps include git
**Build Command**:

```bash
# After preparing packaging/docker/one/dist/ with platform binaries (tokenring-one-*, tokenring-cli-*)
docker build -t tokenring-ai/one:latest -f packaging/docker/one/Dockerfile packaging/docker/one
```

**Run Command**:

```bash
docker run -ti --net host -v ./:/repo:rw tokenring-ai/one:latest
```

## Testing

**Framework**: Bun test
**Test Location**: Alongside sources as `*.test.ts` / `*.test.tsx`, or in `test/` directories per package
**Run Command**: from the package directory:

```bash
cd backend && bun test            # backend tests
cd frontend && bun test --isolate # React component and hook tests
cd plugin/<name> && bun test      # per-plugin tests
```

## Project Architecture

- **Core Application**: `backend/tokenring.ts` parses CLI options, layers configuration, and boots `TokenRingApp` from `plugin/app`
- **Plugin System**: `backend/plugins.ts` composes the installed plugin list and the app-wide zod `configSchema`; every plugin with a config shape must be spread into it or its config is silently dropped (guarded by `backend/test/pluginsConfigSchema.test.ts`)
- **Registry System**: Services, tools, and resources are registered at runtime on the app; agents resolve them via `requireService`
- **Frontend**: React 19 + react-router. Every screen is an app: a user-customizable layout of containers (tabs, single, accordion, carousel) holding views; the URL owns focus. Plugins ship views and apps via `plugin/<name>/frontend/layout.ts` + `views.tsx`. Data comes from shared WebSocket RPC stream stores (`frontend/src/hooks/sharedStreamStore.ts`, `frontend/src/rpc.ts`)
- **Data Persistence**: SQLite database plus workspace files under `~/.tokenring/` (sessions, config overlays, knowledge, media)
