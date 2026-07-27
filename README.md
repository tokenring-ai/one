# TokenRing One

**An AI-powered coding assistant with a comprehensive ecosystem for local development**

TokenRing One is an interactive AI assistant designed to help developers with coding tasks like editing, refactoring, testing, and git operations. It runs locally on your machine and supports multiple AI providers while keeping your code secure. The modular ecosystem includes specialized packages covering everything from audio processing to cloud services, communication platforms, and advanced development tools.

## How it works: Backend (daemon) and CLI

TokenRing One is packaged as **two separate binaries** plus optional web frontend assets:

| Component | Role | Typical command |
|-----------|------|-----------------|
| **Backend (daemon)** | Long-running server: agents, tools, plugins, HTTP/WebSocket API, and the web UI | `tokenring-one-server` (npm/deb) or `tokenring-one` (binary install) |
| **CLI** | Native terminal UI that talks to a backend over WebSocket JSON-RPC | `tokenring` / `one`, or `tokenring-one` from the full meta-package (starts the CLI) |
| **Frontend** | Static web UI assets served by the backend | installed with the full package |

**Backend** binds an HTTP server (`--listen` / `--port`), loads plugins, stores session data, and exposes the RPC endpoint used by clients. It is the process that actually runs agents and tools.

**CLI** is a standalone Ratatui terminal client. It does **not** embed the agent runtime. On start it either:

1. **Connects to a remote (or already-running) backend** when you pass a URL (`ws://…`, `wss://…`, or `http(s)://…`), or
2. **Offers to launch a local backend** when no URL is given — discovering `tokenring-one` via `TOKENRING_ONE_BINARY` or common install paths, then attaching with generated session credentials.

You can also open the **web UI** in a browser against the same backend. Multiple CLIs (and browsers) can attach to one daemon.

## Features

### AI and Language Model Support

- **Multiple AI Providers**: OpenAI, Anthropic, Google, Groq, Cerebras, DeepSeek, and more
- **Unified AI Client**: Chat, embeddings, and images via Vercel AI SDK
- **Model Registry**: Dynamic model selection and configuration
- **Agent Orchestration**: Multi-agent workflows with specialized roles

### Communication and Collaboration

- **Bot Service**: Channel-agnostic bots with per-conversation agents, group broadcasting, and human-in-the-loop channels
- **Slack Integration**: Slack transport for bots
- **Telegram Integration**: Telegram transport for bots
- **Human Feedback Tools**: File reviews, React component previews, and interactive Q&A
- **Real-time Communication**: WebSocket API for browser clients

### Audio and Media Capabilities

- **Audio Framework**: Recording, playback, transcription, and text-to-speech
- **Linux Audio**: Platform-specific implementation using naudiodon3
- **Native Audio I/O**: PortAudio bindings for high-performance audio operations

### Web and External Services

- **Web Search**: Multiple providers (Serper.dev, ScraperAPI, Chrome automation)
- **Browser Automation**: Puppeteer scripts for web interaction
- **Web Scraping**: SERP results and page content fetching

### Database and Storage

- **Multi-Database Support**: MySQL, SQLite, PostgreSQL via Drizzle ORM
- **Database Abstraction**: SQL execution, schema inspection, and resource management
- **Checkpoint Persistence**: Agent state storage across sessions
- **Task Queuing**: Sequential processing with checkpoint preservation
- **Memory Management**: Short-term memory and attention storage

### Cloud and Infrastructure

- **AWS Integration**: STS/S3 clients with authentication
- **S3 Storage**: Cloud filesystem and CDN providers for AWS S3
- **Docker Support**: Container management and sandbox execution
- **Kubernetes**: Resource discovery and management across namespaces
- **Sandbox Environment**: Isolated execution for security

### Advanced Development Tools

- **Code Intelligence**: Semantic file indexing with Tree-sitter integration
- **Code Watch**: AI comment-triggered modification detection
- **JavaScript Tooling**: ESLint auto-fix, package management, script execution
- **Git Integration**: Commits, rollbacks, branch management with auto-commit
- **Testing Framework**: Agent testing with auto-repair hooks
- **File System**: Abstract filesystem with ignore patterns and dirty tracking

### Workflow Automation

- **Scripting Language**: Variables, functions, LLM integration, and command sequences
- **Task Orchestration**: Multi-step workflows with user approval
- **Batch Processing**: Named iterables system with /foreach command
- **Workflow Engine**: Advanced task planning and execution
- **Scheduler**: Task scheduling and automation

### Protocol Extensions

- **MCP Integration**: Model Context Protocol client for external server connectivity
- **Web Hosting**: Fastify-based service with pluggable resources
- **Frontend Interface**: Complete React frontend with CLI-style interaction
- **RPC**: Remote procedure call infrastructure

### Terminal and POSIX Support

- **Terminal Service**: Interactive terminal sessions with output collection
- **POSIX System**: POSIX-compliant file system and terminal providers

### Specialized Agents

TokenRing One includes 27 specialized AI agents organized into two categories:

**Interactive Agents (5)**

- **Coding Agent** - A general code assistant that directly executes development tasks
- **Team Leader** - Orchestrates full-stack projects, coordinates specialists, manages workflow
- **Planning Agent** - Creates detailed project plans and task breakdowns
- **Swarm Agent** - Coordinates multiple agents working in parallel on complex tasks
- **Research Agent** - Conducts research and gathers information from multiple sources (uses web search for factual, verified information)

**Background Specialists (22)**

*Planning & Management (3)*

- **Product Manager** - Creates PRDs, defines user stories, plans feature roadmaps
- **Product Design Engineer** - Product enhancement and comprehensive PRD creation
- **System Architect** - Designs system architectures and selects technology stacks

*Development (6)*

- **Full Stack Developer** - Implements complete features across frontend and backend
- **Frontend Designer** - Creates React/Vue components, responsive layouts, state management
- **Backend Designer** - Implements server-side logic, business rules, data processing
- **API Designer** - Designs REST/GraphQL APIs, creates OpenAPI specifications
- **Database Designer** - Designs schemas, implements migrations, optimizes queries
- **Code Symbol Locator** - Finds and analyzes code symbols and references

*Engineering (4)*

- **Business Logic Engineer** - Implements workflows, rules engines, automation systems
- **Data Engineer** - Creates ETL pipelines, data migrations, processing workflows
- **Integration Engineer** - Implements third-party integrations, APIs, webhooks
- **Auth Designer** - Designs authentication/authorization systems, OAuth/OIDC

*Quality & Operations (5)*

- **Test Engineer** - Creates unit/integration/E2E tests, test automation
- **Code Quality Engineer** - Code reviews, refactoring, standards enforcement
- **Security Review** - Security assessments, vulnerability remediation, OWASP compliance
- **Performance Engineer** - Performance optimization, caching, monitoring, scalability
- **DevOps Engineer** - CI/CD pipelines, Docker configs, infrastructure setup

*Design & Documentation (4)*

- **UI/UX Designer** - Creates wireframes, design systems, user flows
- **Documentation Engineer** - Technical documentation, API docs, user guides
- **Accessibility Engineer** - Ensures accessibility compliance and WCAG standards
- **SEO Engineer** - Search engine optimization, meta tags, and search visibility

## Quick Start

### Install (Recommended)

Install the latest release with a one-liner:

```bash
curl -fsSL https://github.com/tokenring-ai/one/releases/latest/download/install.sh | bash
```

The release script is available for inspection here:

[https://github.com/tokenring-ai/one/releases/latest/download/install.sh](https://github.com/tokenring-ai/one/releases/latest/download/install.sh)

Each published `install.sh` pins an explicit release version (bumped with the rest of
the project via `.bumpversion.cfg`), so installs from that script are deterministic.
Override with `TOKENRING_INSTALL_VERSION=x.y.z` only when you intentionally want a
different release.

The installer chooses the best method for your machine:

1. **If `bun` or `npm` is available** — installs `@tokenring-ai/one@<version>` globally  
   (`tokenring-one` on your PATH). That meta-package pulls in CLI, backend, and frontend.
2. **Otherwise on macOS or Linux** — downloads the CLI, backend, and frontend  
   assets for that same version and installs them to:
   - `~/.local/bin/one` — terminal client (CLI)
   - `~/.local/bin/tokenring-one` — backend (daemon)
   - `~/.local/share/tokenring-ai/one-frontend` — web frontend assets

Supported platforms for the binary install path: macOS and Linux on arm64 and x64.  
Ensure `~/.local/bin` is on your `PATH` after a binary install.

### Packages

| npm package | What it installs |
|-------------|------------------|
| [`@tokenring-ai/one`](packaging/npm/one) | **Full stack** — CLI + backend + frontend (`tokenring-one` wires them together) |
| [`@tokenring-ai/one-cli`](packaging/npm/cli) | **CLI only** — connect to an existing backend, or launch one if available |
| [`@tokenring-ai/one-backend`](packaging/npm/backend) | **Backend only** — headless daemon / server (`tokenring-one-server`) |
| [`@tokenring-ai/one-frontend`](packaging/npm/frontend) | **Web UI assets** — served by the backend |

Debian/RPM packages follow the same split (`tokenring-one-cli`, `tokenring-one-backend`, `tokenring-one-frontend`, and the `tokenring-one` meta-package). See [`packaging/`](packaging/).

### Environment Variables

At least one AI provider key is required (set on the **backend** process):

```bash
export OPENAI_API_KEY=sk-...              # OpenAI
export ANTHROPIC_API_KEY=sk-ant-...      # Anthropic
export GOOGLE_GENERATIVE_AI_API_KEY=...  # Google Gemini
export GROQ_API_KEY=gsk_...              # Groq
export CEREBRAS_API_KEY=...              # Cerebras
export DEEPSEEK_API_KEY=...              # DeepSeek
export XAI_API_KEY=...                   # xAI
export OPENROUTER_API_KEY=...            # OpenRouter

# Optional: web search
export SERPER_API_KEY=...
```

### Option 1: Full install (CLI launches local backend)

Recommended for local use. The meta-package starts the terminal client and points it at the installed backend and frontend:

```bash
npx @tokenring-ai/one

# Or install globally
npm install -g @tokenring-ai/one
# or: bun install -g @tokenring-ai/one
tokenring-one
```

With no URL argument, the CLI **prompts to launch a local backend** (using `TOKENRING_ONE_BINARY` when set). Backend stdout/stderr are captured so they do not clobber the TUI.

```bash
# Project directory for a locally launched backend
tokenring-one --project-directory ./your-project
```

### Option 2: CLI only — connect to a remote (or already-running) backend

Install just the terminal client, then pass a backend URL:

```bash
npx @tokenring-ai/one-cli http://127.0.0.1:3000
# or WebSocket form:
npx @tokenring-ai/one-cli ws://127.0.0.1:3000/rpc:ws
```

HTTP(S) URLs are rewritten to WebSocket and `/rpc:ws` is appended when missing. Auth for remote backends uses WebSocket session credentials (`--auth-user` / `--auth-password`, or env `TR_ADMIN_USER` / `TR_ADMIN_PASSWORD` / `TR_AUTH_PASSWORD`) and optional `--auth-bearer`.

### Option 3: Backend only (daemon / server)

Run the daemon without a terminal UI — for headless hosts, remote access, or so multiple CLIs can share one server:

```bash
npx @tokenring-ai/one-backend --listen 127.0.0.1 --port 3000

# Global install
npm install -g @tokenring-ai/one-backend
tokenring-one-server --listen 0.0.0.0 --port 3000 --projectDirectory ./your-project
```

Then open the web UI at `http://127.0.0.1:3000`, or connect a CLI (Option 2).  
Admin credentials default to user `admin` (override with `TR_ADMIN_USER` / `TR_ADMIN_PASSWORD`); if no password is set, one is generated and stored in the system keychain on first run.

### Option 4: Run from source

```bash
git clone https://github.com/tokenring-ai/one.git
cd one
git submodule update --init --recursive
bun install

# Backend only (daemon on port 14008, frontend from frontend/dist)
bun run run:one

# CLI that launches the local backend automatically
bun run run:cli

# CLI that connects to an already-running backend
bun run run:cli-remote
```

Or start the pieces by hand:

```bash
# Terminal 1 — backend (entry: backend/tokenring.ts)
FRONTEND_DIRECTORY=frontend/dist bun backend/tokenring.ts --listen 127.0.0.1 --port 3000

# Terminal 2 — CLI against that backend
cargo run --manifest-path cli/Cargo.toml -- http://127.0.0.1:3000
```

### Option 5: Docker

Published images:

| Tag | Contents |
|-----|----------|
| `ghcr.io/tokenring-ai/one:full` | CLI + backend + frontend (entrypoint is the CLI) |
| `ghcr.io/tokenring-ai/one:server` | Backend daemon only (listens on port 80 by default) |
| `ghcr.io/tokenring-ai/one:cli` | CLI only (pass a backend URL) |

```bash
# Full stack (CLI will launch / use the in-image backend)
docker pull ghcr.io/tokenring-ai/one:full
docker run -ti --rm \
  -v ./your-project:/repo:rw \
  -e OPENAI_API_KEY \
  ghcr.io/tokenring-ai/one:full

# Backend only (web UI + RPC)
docker pull ghcr.io/tokenring-ai/one:server
docker run -ti --rm \
  -p 3000:80 \
  -v ./your-project:/repo:rw \
  -e OPENAI_API_KEY \
  ghcr.io/tokenring-ai/one:server \
  --listen 0.0.0.0 --port 80 --projectDirectory /repo
```

## Command Line Options

### Backend (daemon)

Entry point: `backend/tokenring.ts` · installed as `tokenring-one-server` (npm/deb) or `tokenring-one` (binary install)

```bash
tokenring-one-server [options]
```

| Option | Description |
|--------|-------------|
| `--projectDirectory <path>` | Working directory for agents (default: cwd) |
| `--dataDirectory <path>` | Knowledge, session data, etc. (default: `<projectDirectory>/.tokenring`) |
| `--listen <host>` | HTTP bind address (default: `127.0.0.1`) |
| `--port <port>` | HTTP port; `0` picks a free port (default: `0`) |
| `--vaultFile <path>` | Secrets vault path (default: `~/.config/tokenring/secrets.vault`) |

```bash
# Local daemon with fixed port and web UI
tokenring-one-server --listen 127.0.0.1 --port 3000 --projectDirectory ./my-app

# Reachable on the LAN (set TR_ADMIN_PASSWORD in production)
TR_ADMIN_PASSWORD=… tokenring-one-server --listen 0.0.0.0 --port 3000
```

### CLI (terminal client)

Entry point: native binary from `cli/` · installed as `tokenring` / `one`, or `tokenring-one` when using the full meta-package (which invokes the CLI)

```bash
tokenring [URL] [options]
# or: one [URL] [options]
```

| Option | Description |
|--------|-------------|
| `URL` | Backend URL (`ws://`, `wss://`, `http://`, `https://`). If omitted, the CLI offers to **launch a local backend** |
| `--one-binary <path>` | Backend executable for local launch (`TOKENRING_ONE_BINARY`) |
| `--project-directory <path>` | Project directory for a locally launched backend (default: `.`) |
| `--agent-id <id>` | Attach to an existing agent (`TR_AGENT_ID`) |
| `--agent-type <type>` | Agent type to create (default from config / `code`) |
| `--select` / `--no-select` | Show or skip agent selection on startup |
| `--auth-user` / `--auth-password` | WebSocket session auth for remote backends |
| `--auth-bearer <token>` | Optional bearer on the WebSocket upgrade |
| `--prompt <text>` | Send an initial message after attach |
| `--shutdown-when-done` | Exit when the agent stops (pairs with `--prompt`) |
| `--verbose` / `--theme` / `--config` / `--profile` | TUI and config options — see `cli/README.md` |

```bash
# Launch local backend from the startup menu (no URL)
tokenring
tokenring --project-directory ./my-app

# Connect to a remote or already-running backend
tokenring http://127.0.0.1:3000
tokenring wss://work.example.com/rpc:ws --auth-user admin --auth-password '…'

# One-shot automation
tokenring http://127.0.0.1:3000 \
  --prompt "Summarize this repo" \
  --shutdown-when-done
```

Optional CLI config: `~/.config/tokenring/cli.toml` (profiles, themes, notifications). See [`cli/README.md`](cli/README.md).

## Architecture

### Packaging layout

```text
backend/tokenring.ts     Backend daemon (TypeScript / Bun)
cli/                     Native terminal client (Rust / Ratatui)
frontend/                Web UI assets served by the backend
packaging/
  npm/{one,cli,backend,frontend}   Published npm packages
  deb/  rpm/                       Linux packages (same split)
  docker/one                       full / server / cli images
  install.sh                       Release installer
```

TokenRing One is built as a modular TypeScript monorepo with specialized packages:

### Core Foundation

- **@tokenring-ai/app**: Base application framework with service management and plugin architecture
- **@tokenring-ai/agent**: Central orchestrator for AI agents with tools, commands, and state persistence
- **@tokenring-ai/utility**: Shared utilities (cache, logging, shell escape) used across packages

### AI and Language Models

- **@tokenring-ai/ai-client**: Unified AI client for chat/embeddings/images via Vercel AI SDK
- **@tokenring-ai/chat**: AI chat client with model configuration, tool management, and message history

### Storage and Database

- **@tokenring-ai/database**: Abstract database layer with resource management and SQL execution
- **@tokenring-ai/mysql**: MySQL integration with connection pooling and schema inspection
- **@tokenring-ai/drizzle-storage**: Multi-database storage using Drizzle ORM (SQLite, MySQL, PostgreSQL)
- **@tokenring-ai/checkpoint**: Checkpoint service for agent state persistence
- **@tokenring-ai/queue**: App-level work queue that dispatches items to agents of a specific type
- **@tokenring-ai/memory**: Agent memory management and attention storage

### Development Tools

- **@tokenring-ai/testing**: Agent testing framework with auto-repair hooks and shell command resources
- **@tokenring-ai/git**: Git operations with auto-commit functionality
- **@tokenring-ai/javascript**: JavaScript development tools including ESLint, package management, and script execution
- **@tokenring-ai/codebase**: Codebase injection into agent context via memories and resources
- **@tokenring-ai/code-watch**: AI comment-triggered file modification detection and agent spawning
- **@tokenring-ai/file-index**: Semantic file search and indexing with Tree-sitter integration
- **@tokenring-ai/scripting**: Scripting language with variables, functions, and LLM integration
- **@tokenring-ai/tasks**: Task planning and multi-agent workflow orchestration

### Web and External Services

- **@tokenring-ai/websearch**: Abstract web search interface with pluggable providers
- **@tokenring-ai/serper**: Google search via Serper.dev API
- **@tokenring-ai/scraperapi**: Web scraping and SERP results via ScraperAPI
- **@tokenring-ai/chrome**: Puppeteer browser automation for web scraping and interaction
- **@tokenring-ai/aws**: AWS integration with STS/S3 clients and authentication
- **@tokenring-ai/s3**: S3 filesystem and CDN providers for cloud storage and content delivery
- **@tokenring-ai/docker**: Docker container management with sandbox provider
- **@tokenring-ai/kubernetes**: Kubernetes resource discovery and management
- **@tokenring-ai/sandbox**: Abstract sandbox interface for isolated execution
- **@tokenring-ai/mcp**: Model Context Protocol client for external server integration
- **@tokenring-ai/web-host**: Fastify-based web hosting service for static files and APIs

### Communication and Collaboration

- **@tokenring-ai/bot**: Bots that span messaging platforms, with per-conversation agents and group broadcasting
- **@tokenring-ai/slack**: Slack transport for bots
- **@tokenring-ai/telegram**: Telegram transport for bots
- **@tokenring-ai/feedback**: Human feedback tools for file reviews and React component previews

### Audio and Media

- **@tokenring-ai/audio**: Abstract audio framework for recording, playback, and speech processing
- **@tokenring-ai/linux-audio**: Linux-specific audio implementation using naudiodon3

### UI and Frontend

- **cli/**: Native Ratatui terminal client (published as `@tokenring-ai/one-cli`)
- **frontend/**: React web interface served by the backend (published as `@tokenring-ai/one-frontend`)

### Filesystem and Storage

- **@tokenring-ai/filesystem**: Abstract filesystem with read/write/search operations and ignore filters
- **@tokenring-ai/local-filesystem**: Local disk filesystem implementation with file watching
- **@tokenring-ai/posix-system**: POSIX-compliant file system and terminal providers

### Thinking and Workflow

- **@tokenring-ai/thinking**: Advanced reasoning and planning capabilities
- **@tokenring-ai/workflow**: Workflow engine for complex task execution
- **@tokenring-ai/scheduler**: Task scheduling and automation
- **@tokenring-ai/vault**: Secure storage for sensitive data

### Research

- **@tokenring-ai/research**: Research tools and capabilities

### Terminal

- **@tokenring-ai/terminal**: Terminal service with session management and output collection

### RPC

- **@tokenring-ai/rpc**: Remote procedure call infrastructure

### Additional Packages

- **@tokenring-ai/acp**: AI Code Protocol integration
- **@tokenring-ai/lifecycle**: Agent lifecycle hooks and management
- **@tokenring-ai/metrics**: Metrics tracking and monitoring
- **@tokenring-ai/skills**: Skills management and registration

## Configuration

Configuration is loaded from `.tokenring/one-config.mjs` in your working directory. The file uses the same schema as the plugin config. A minimal example:

```javascript
export default {
  ai: {
    autoConfigure: true, // auto-detect providers from env vars
  },
  filesystem: {
    providers: {
      local: { type: "posix" }
    }
  }
};
```

### Default AI Models

The app tries models in this order, using the first available:

```
llamacpp:*                    Local LlamaCpp
zai:glm-5                   zAI
openrouter:openrouter/auto    OpenRouter auto-routing
openai:gpt-5-mini             OpenAI
anthropic:claude-4.5-haiku    Anthropic
google:gemini-3-flash-preview Google
xai:grok-code-fast-1          xAI
deepseek:deepseek-chat        DeepSeek
qwen:qwen3-coder-flash        Qwen
*                             Any available model
```

### Authentication

The **backend** protects the HTTP/WebSocket API with an admin user. Credentials are resolved in this order:

1. `TR_ADMIN_PASSWORD` (and optional `TR_ADMIN_USER`, default `admin`)
2. Password stored in the system keychain (`tokenring` / `adminPassword`)
3. Auto-generated on first run (printed once, then stored in the keychain when possible)

```bash
export TR_ADMIN_USER=admin
export TR_ADMIN_PASSWORD=your-secure-password
tokenring-one-server --listen 0.0.0.0 --port 3000
```

The **CLI** authenticates to remote backends over WebSocket session `auth` (not HTTP Basic):

```bash
tokenring http://host:3000 \
  --auth-user admin \
  --auth-password "$TR_ADMIN_PASSWORD"
# Optional upgrade bearer:
tokenring http://host:3000 --auth-bearer "$TR_AUTH_BEARER"
```

Local launches (CLI starts the backend itself) use generated session credentials automatically.

## Docker Usage

### Image variants

| Image | Entrypoint | Use when |
|-------|------------|----------|
| `ghcr.io/tokenring-ai/one:full` | CLI (`tokenring`) with backend + frontend on image | Interactive TUI in a container |
| `ghcr.io/tokenring-ai/one:server` | Backend daemon on port 80 | Headless / web UI / remote CLI clients |
| `ghcr.io/tokenring-ai/one:cli` | CLI only | Connecting to a backend elsewhere |

```bash
# Full stack
docker pull ghcr.io/tokenring-ai/one:full
docker run -ti --rm \
  -v ./your-project:/repo:rw \
  -e OPENAI_API_KEY \
  -e ANTHROPIC_API_KEY \
  ghcr.io/tokenring-ai/one:full

# Backend daemon with published port (web UI + RPC)
docker pull ghcr.io/tokenring-ai/one:server
docker run -ti --rm \
  -p 3000:80 \
  -v ./your-project:/repo:rw \
  -e OPENAI_API_KEY \
  -e TR_ADMIN_PASSWORD \
  ghcr.io/tokenring-ai/one:server

# CLI container against a host or remote backend
docker pull ghcr.io/tokenring-ai/one:cli
docker run -ti --rm \
  ghcr.io/tokenring-ai/one:cli \
  http://host.docker.internal:3000
```

### Building Custom Image

```dockerfile
FROM ghcr.io/tokenring-ai/one:server

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    libpq-dev \
    mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Add custom configuration
COPY .tokenring/one-config.mjs /root/.tokenring/one-config.mjs

EXPOSE 80
```

### Docker Compose Setup

```yaml
services:
  tokenring-one:
    image: ghcr.io/tokenring-ai/one:server
    container_name: tokenring-one
    ports:
      - "3000:80"
    volumes:
      - ./your-project:/repo:rw
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TR_ADMIN_PASSWORD=${TR_ADMIN_PASSWORD}
    command:
      - --listen
      - 0.0.0.0
      - --port
      - "80"
      - --projectDirectory
      - /repo
```

## Development

### Building the Project

```bash
bun install
bun run check:tsc          # type-check
# Backend tests live under plugin/* and backend/
bun test

# Backend daemon (serves frontend/dist on port 14008)
bun run run:one

# CLI that can launch that backend binary path
bun run run:cli

# CLI connected to an already-running backend on :14008
bun run run:cli-remote

# Release build of the native CLI
bun run package:cli
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run check:tsc` | Type-check the monorepo |
| `bun run run:one` | Start the backend daemon from source (`backend/tokenring.ts`) |
| `bun run run:cli` | Start the CLI; launches the backend via `TOKENRING_ONE_BINARY` |
| `bun run run:cli-remote` | Start the CLI against `ws://0.0.0.0:14008` |
| `bun run package:cli` | Release-build the native CLI |
| `bun run package:one:frontend` | Build web frontend assets |
| `bun run package:one:docker` | Build full / server / cli Docker images |
| `bun test` | Run Bun tests |

### Package Ecosystem Overview

The TokenRing One ecosystem consists of specialized packages organized into functional categories. For a complete list of dependencies, see the package.json file.

#### Core Foundation

- **app**: Application framework and service management
- **agent**: Central orchestrator for AI agents
- **utility**: Shared utilities and helper functions

#### AI and Language Models

- **ai-client**: Unified AI client interface
- **chat**: AI chat configuration and tool management

#### Storage and Database

- **database**: Abstract database layer
- **mysql**: MySQL integration
- **drizzle-storage**: Multi-database ORM support
- **checkpoint**: Agent state persistence
- **queue**: App-level work queue dispatching to typed agents
- **memory**: Memory management and attention storage

#### Development Tools

- **testing**: Agent testing framework
- **git**: Version control integration
- **javascript**: JavaScript tooling
- **codebase**: Codebase context injection
- **code-watch**: File modification detection
- **file-index**: Semantic file search
- **scripting**: Scripting language
- **tasks**: Workflow orchestration

#### Web and External Services

- **websearch**: Web search abstraction
- **serper**: Google search provider
- **scraperapi**: Web scraping service
- **chrome**: Browser automation
- **aws**: AWS cloud services
- **s3**: S3 filesystem and CDN providers
- **docker**: Container management
- **kubernetes**: K8s integration
- **sandbox**: Execution environment
- **mcp**: Protocol extensions
- **web-host**: Web hosting service

#### Communication and Collaboration

- **bot**: Bots that span messaging platforms, with per-conversation agents
- **slack**: Slack transport for bots
- **telegram**: Telegram transport for bots
- **feedback**: Human feedback tools

#### Audio and Media

- **audio**: Audio processing framework
- **linux-audio**: Linux audio implementation

#### UI and Frontend

- **cli/**: Native terminal client (`@tokenring-ai/one-cli`)
- **frontend/**: React web interface (`@tokenring-ai/one-frontend`)
- **backend/**: Daemon entry point (`backend/tokenring.ts`, `@tokenring-ai/one-backend`)

#### Filesystem and Storage

- **filesystem**: Abstract filesystem interface
- **local-filesystem**: Local filesystem implementation
- **posix-system**: POSIX system utilities

#### Thinking and Workflow

- **thinking**: Advanced reasoning and planning
- **workflow**: Workflow engine for complex tasks
- **scheduler**: Task scheduling and automation
- **vault**: Secure storage

#### Research

- **research**: Research tools and capabilities

#### Terminal

- **terminal**: Terminal service with session management

#### RPC

- **rpc**: Remote procedure call infrastructure

#### Additional Packages

- **acp**: AI Code Protocol integration
- **lifecycle**: Agent lifecycle hooks and management
- **metrics**: Metrics tracking and monitoring
- **skills**: Skills management and registration

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding standards
4. Add tests for new functionality
5. Run `bun run biome` to format code
6. Update documentation as needed
7. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Use consistent naming conventions
- Write comprehensive tests
- Document all public APIs
- Respect semantic versioning
- Keep packages focused and modular

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Ready to supercharge your coding workflow with AI? Explore the complete TokenRing ecosystem and transform your development experience!**
