---
description: Repository Information Overview
alwaysApply: true
---

# TokenRing One Information

## Summary

TokenRing One is a local-first, multi-agent workspace that bundles five purpose-built apps — coding, canvas, documents, media, and research — into a single product. Same agents, same ecosystem, same configuration across every surface. It provides a chat interface where users can ask questions, issue commands, and interact with source code and content, leveraging AI to assist with code edits, refactors, testing, research, writing, publishing, and more.

## Structure

- **src/**: Main application source code and entry point
- **pkg/**: Modular packages organized as a monorepo workspace
- **docker/**: Docker configuration for containerized deployment
- **.github/**: GitHub workflows and CI/CD configuration
- **.tokenring/**: Configuration directory for the application

## Language & Runtime

**Language**: TypeScript/JavaScript
**Version**: ES2022 target
**Build System**: TypeScript compiler (tsc)
**Package Manager**: Bun

## Dependencies

**Main Dependencies**:

- Multiple internal packages (@tokenring-ai/*)
- @inquirer/prompts: Interactive command-line interface
- commander: Command-line argument parsing

**Development Dependencies**:

- @biomejs/biome: Code formatting and linting
- vitest: Testing framework
- husky: Git hooks management

## Build & Installation

```bash
# Initialize git submodules
git submodule update --init --recursive

# Install dependencies
bun install

# Build the project
bun run build

# Run the application
bun src/tokenring.js --source ./path-to-codebase
```

## Docker

**Dockerfile**: packaging/docker/one/Dockerfile
**Base Image**: debian:trixie
**Configuration**: Ships the prebuilt TokenRing One binary, frontend, and runtime deps (git, libportaudio2)
**Build Command**:

```bash
# After preparing packaging/docker/one/dist/ with the platform binary and frontend
docker build -t tokenring-ai/one:latest -f packaging/docker/one/Dockerfile packaging/docker/one
```

**Run Command**:

```bash
docker run -ti --net host -v ./:/repo:rw tokenring-ai/one:latest
```

## Testing

**Framework**: Vitest
**Test Location**: pkg/*/test directories
**Configuration**: Individual vitest.config.js/ts files in package directories
**Run Command**:

```bash
bun run test
```

## Project Architecture

The project follows a modular architecture with a monorepo structure:

- **Core Application**: Entry point in src/tokenring.ts
- **Package Modules**: Functionality split into specialized packages in pkg/
- **Registry System**: Services, tools, and resources registered at runtime
- **Plugin Support**: Extensible design with plugin capabilities
- **Data Persistence**: SQLite database for chat history and session storage
