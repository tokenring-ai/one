# @tokenring-ai/one

The complete TokenRing One local-first, multi-agent workspace.

This meta-package installs:

- `@tokenring-ai/one-cli`
- `@tokenring-ai/one-backend`
- `@tokenring-ai/one-frontend`

Its `tokenring-one` command starts the terminal client and configures it to
launch the installed backend with the installed web frontend.

```bash
npx @tokenring-ai/one
```

Or install it globally:

```bash
npm install -g @tokenring-ai/one
tokenring-one
```

Supported platforms are macOS and Linux on arm64 and x64.

Container variants are published as:

```bash
docker pull ghcr.io/tokenring-ai/one:full
docker pull ghcr.io/tokenring-ai/one:server
docker pull ghcr.io/tokenring-ai/one:cli
```
