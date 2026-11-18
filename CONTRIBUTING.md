# Contributing to TokenRing One

Thanks for your interest in contributing! This repo is a Bun + TypeScript monorepo: the backend lives in `backend/`, the React frontend in `frontend/`, and every feature area is a plugin package under `plugin/<name>/`.

## Getting started

```bash
bun install

# Type-check the whole monorepo
bun run check:tsc

# Lint and format (auto-fix)
bun run check:biome
bun run check:oxlint

# Run the backend from source
bun run run:one
```

## Before you open a PR

- `bun run check:tsc` passes.
- `bun run check:biome` and `bun run check:oxlint` report no new issues.
- Tests for the packages you touched pass — run `bun test` inside each affected package directory (`backend`, `frontend`, `plugin/<name>`).
- If you added or changed a plugin RPC schema, run `bun run schema:rpc` and commit the regenerated files under `schema/rpc/`.
- If you added a new plugin to `backend/plugins.ts`, make sure its config schema is spread into the composed `configSchema` (guarded by `backend/test/pluginsConfigSchema.test.ts`).

## Conventions

- TypeScript, ESM, ES2022 target; format is enforced by Biome (160-column lines).
- Tests use `bun:test` and live next to the code as `*.test.ts` / `*.test.tsx` or in a package `test/` directory.
- Keep plugins self-contained: a plugin registers its own services, tools, RPC endpoints, and web resources and does not reach into other plugins' internals.

## Reporting issues

For bugs and feature requests, please open a GitHub issue. For security-sensitive reports, see [SECURITY.md](SECURITY.md) — please do not open public issues for security problems.
