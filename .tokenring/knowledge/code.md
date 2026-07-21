# TokenRing AI Monorepo Knowledge Base

## Overview

The TokenRing AI monorepo is a comprehensive TypeScript ecosystem containing 50+ packages organized around a modular, agent-centric architecture. It is centered on a single application, **TokenRing One** (backend) — a unified AI assistant that brings coding, content creation, research, publishing, and workflow automation together. TokenRing One merged the former **TokenRing Coder** (AI-powered development assistant) and **TokenRing Writer** (content creation platform) into one product. Built as a monorepo using Bun, it provides pluggable packages under the `@tokenring-ai/*` scope for modular AI agent functionality.

## Table of Contents

1. [Monorepo Structure](#monorepo-structure)
2. [Core Architecture Patterns](#core-architecture-patterns)
3. [Agent System](#agent-system)
4. [Custom Agents](#custom-agents)
5. [Agent Command Registration](#agent-command-registration)
6. [Package Categories](#package-categories)
7. [Development Workflows](#development-workflows)
8. [Testing Framework](#testing-framework)
9. [Integration Patterns](#integration-patterns)
10. [Context Management](#context-management)
11. [State Management](#state-management)
12. [Frontend Applications](#frontend-applications)
13. [Development Guidelines](#development-guidelines)

## Monorepo Structure

```
tokenring/
├── app/                    # Applications
│   └── one/               # TokenRing One (unified AI assistant: coding, content, research, automation)
├── pkg/                   # Packages (50+ specialized packages)
│   ├── agent/            # Core agent system
│   ├── ai-client/        # AI integration with multi-provider support
│   ├── filesystem/       # Abstract filesystem interface
│   ├── git/              # Git operations with auto-commit
│   ├── testing/          # Agent testing framework
│   ├── codebase/         # Codebase context injection
│   ├── queue/            # Task queuing with checkpoints
│   ├── memory/           # Short-term memory storage
│   ├── app/              # TokenRingApp framework (@tokenring-ai/app)
│   └── [40+ more packages]
├── frontend/              # Frontend applications
│   ├── chat/             # Web-based chat interface for agent interaction
│   └── electron/         # Electron-based desktop application
├── design/               # Architecture design documents
├── deps/                 # External dependencies
├── docker/              # Docker configurations
├── docs/                # Documentation
└── .tokenring/          # Configuration directory
    ├── agents/          # Custom agent configurations
    │   ├── index.ts     # Exports all custom agents
    │   └── *.ts         # Individual agent configs
    ├── knowledge/       # Knowledge base files
    ├── workflows/       # Workflow definitions
    └── skills/          # Skill definitions
```

### Package Structure Patterns

Each package follows a consistent structure:

```
pkg/package-name/
├── index.ts              # Main entry point
├── README.md             # Package documentation
├── package.json          # Package metadata
├── tsconfig.json         # TypeScript configuration
├── src/                  # Source code (if present)
├── tools/                # AI tools
├── commands/             # Chat commands
├── hooks/                # Lifecycle hooks
├── state/                # State slices
└── test/                 # Test files
```

## Core Architecture Patterns

### 1. Agent-Centric Design

The entire ecosystem revolves around **agents** that can execute commands, use tools, run hooks, maintain state, and communicate through asynchronous events.

**Key Components:**
- **AgentTeam**: Central orchestrator managing agents, packages, and shared registries
- **Agent**: Individual AI agent with state management, event emission, and command processing
- **Services**: Shared functionality registered with agents
- **Tools**: Executable capabilities that agents can use
- **Commands**: Interactive slash commands for agent interaction
- **Hooks**: Lifecycle automation points

### 2. Service Registration Pattern

All packages implement the `TokenRingService` interface and register themselves with the agent system:

```typescript
class PackageService implements TokenRingService {
  name = "package-service";
  description = "Service description";
  
  async attach(agent: Agent): Promise<void> {
    // Register tools
    agent.tools.register("tool-name", toolDefinition);
    
    // Register commands
    agent.commands.register("command-name", commandDefinition);
    
    // Add context providers
    agent.contextProviders.add(this);
  }
}
```

### 3. Registry-Based Architecture

The system uses typed registries for managing components:

```typescript
// AgentTeam registries
- packages: TokenRing packages
- services: Shared services (typed registry)
- chatCommands: Chat commands
- tools: Available tools
- hooks: Lifecycle hooks
```

### 4. Event-Driven Communication

Agents communicate via an event system:

```typescript
// Agent events
agent.events(signal).forEach(event => {
  switch (event.type) {
    case 'output.chat':
      console.log('Chat:', event.data.content);
      break;
    case 'state.busy':
      console.log('Agent busy:', event.data.message);
      break;
    case 'human.request':
      handleHumanInput(event.data);
      break;
  }
});
```

## Agent System

### Agent Types

#### Interactive Agents
- Direct user interaction
- Real-time event streaming
- Human input requests

#### Background Agents
- Autonomous operation
- Task queue processing
- Monitoring and automation

### Agent Configuration

```typescript
const agentConfig: AgentConfig = {
  name: "specialistAgent",
  description: "Specialized development agent",
  category: "development",
  debug: false,
  headless: false,
  callable: true,
  idleTimeout: 0,
  maxRunTime: 0,
  minimumRunning: 0,
  subAgent: {},
  enabledHooks: [],
  todos: {},
  command: {  // Optional: Register agent as a callable command
    enabled: true,
    name: "specialist",  // Custom command name (defaults to agentType)
    description: "Run the specialist agent",
  }
};
```

### Core Agent Methods

```typescript
// State Management
agent.initializeState(MyStateSlice, {});
agent.mutateState(MyStateSlice, state => state.update());
const checkpoint = agent.generateCheckpoint();

// Event Handling
for await (const event of agent.events(signal)) {
  // Handle events
}

// Input Processing
agent.handleInput({ message: "Your request" });

// Human Interaction
await agent.askHuman(request);
agent.sendHumanResponse(sequence, response);
```

## Custom Agents

### Overview

TokenRing One supports custom agents defined in the `.tokenring/agents/` directory. These agents are loaded dynamically and made available alongside the built-in agents under the `agents.user` configuration key.

### Directory Structure

```
.tokenring/agents/
├── index.ts           # Exports all custom agents
├── package-builder.ts # Package Builder agent
└── [agent-name].ts   # Additional custom agents
```

### Creating Custom Agents

1. **Create Agent Configuration File**

```typescript
// .tokenring/agents/my-agent.ts
import {AgentConfig} from "@tokenring-ai/agent/schema";
import {ChatAgentConfig} from "@tokenring-ai/chat/schema";
import {FileSystemAgentConfig} from "@tokenring-ai/filesystem/schema";

export default {
  agentType: "my-agent",
  displayName: "My Agent",
  description: "Description of what this agent does",
  category: "Development",
  chat: {
    context: {
      initial: [
        {type: "task-plan"},
        {type: "tool-context"},
        {type: "current-message"},
      ],
    },
    systemPrompt: "You are an expert in your domain...",
    enabledTools: ["todo", "file_*", "terminal_*"],
  },
  filesystem: {
    selectedFiles: ['.tokenring/knowledge/some-file.md']
  }
} satisfies AgentConfig & ChatAgentConfig & FileSystemAgentConfig;
```

2. **Export in Index File**

```typescript
// .tokenring/agents/index.ts
import myAgent from "./my-agent.ts";
import packageBuilderAgent from "./package-builder.ts";

export default [
  myAgent,
  packageBuilderAgent,
] as const;
```

3. **Automatic Loading**

The TokenRing One application automatically loads custom agents from `.tokenring/agents/index.ts` and adds them to the configuration under `agents.user`.

### Package Builder Agent

The **Package Builder** agent (`package-builder`) is a specialized agent for creating TokenRing AI packages.

**Capabilities:**
- Creates complete package structures following TokenRing patterns
- Implements `TokenRingService` interfaces
- Registers tools and commands
- Writes comprehensive tests
- Generates documentation
- Follows package development standards

**Usage:**
```
Call this agent to build TokenRing AI packages. Provide package requirements, functionality goals, or existing package specs.
```

**Reference Files:**
- `.tokenring/knowledge/package-development.md` - Package development guide
- `pkg/template/` - Package template for reference

### Built-in Agents

Built-in agents are defined in `backend/src/agents/` and include:

**Interactive Agents:**
- `code` - Interactive coding assistant
- `plan` - Planning and task management
- `swarm` - Multi-agent coordination
- `research` - Research and information gathering
- `leader` - Team leader agent

**Specialized Agents:**
- **Development**: `backend-design`, `frontend-design`, `api-designer`, `database-design`, `full-stack-developer`
- **Engineering**: `auth-design`, `business-logic-engineer`, `data-engineer`, `integration-engineer`
- **Planning**: `system-architect`, `product-manager`, `product-design-engineer`
- **Quality**: `code-quality-engineer`, `security-review`, `performance-engineer`, `devops-engineer`, `test-engineer`
- **Design & Documentation**: `ui-ux-designer`, `documentation-engineer`, `accessibility-engineer`, `seo-engineer`

## Agent Command Registration

Agents can be registered as callable commands via the `command` configuration:

```typescript
const agentConfig: AgentConfig = {
  agentType: "specialist",
  // ... other config
  command: {
    enabled: true,
    name: "specialist",  // Command name (defaults to agentType)
    description: "Run the specialist agent",
    background: false,
    forwardChatOutput: true,
  }
};
```

## Package Categories

### Core Foundation (7 packages)

- **@tokenring-ai/agent**: Central orchestrator for AI agents
- **@tokenring-ai/ai-client**: Unified AI client with multi-provider support
- **@tokenring-ai/utility**: Shared utilities and helpers
- **@tokenring-ai/filesystem**: Abstract filesystem interface
- **@tokenring-ai/memory**: Short-term memory and attention storage
- **@tokenring-ai/queue**: Task queuing with checkpoint preservation
- **@tokenring-ai/checkpoint**: Agent state persistence abstraction

### Storage & Database (7 packages)

- **@tokenring-ai/database**: Abstract database layer
- **@tokenring-ai/mysql**: MySQL integration
- **@tokenring-ai/sqlite-storage**: SQLite for checkpoints
- **@tokenring-ai/s3**: AWS S3 integration
- **@tokenring-ai/cdn**: Abstract CDN service
- **@tokenring-ai/checkpoint**: Agent state persistence
- **@tokenring-ai/drizzle-storage**: Multi-database ORM

### Development Tools (10 packages)

- **@tokenring-ai/testing**: Agent testing framework with auto-repair
- **@tokenring-ai/git**: Git operations with auto-commit
- **@tokenring-ai/javascript**: ESLint, package management
- **@tokenring-ai/codebase**: Codebase context injection
- **@tokenring-ai/code-watch**: AI comment-triggered modifications
- **@tokenring-ai/file-index**: Semantic file search with Tree-sitter
- **@tokenring-ai/iterables**: Batch processing with /foreach command
- **@tokenring-ai/scripting**: Scripting language with variables and functions
- **@tokenring-ai/tasks**: Multi-agent workflow orchestration
- **@tokenring-ai/memory**: Context memory management

### Web & External Services (11 packages)

- **@tokenring-ai/websearch**: Abstract web search interface
- **@tokenring-ai/serper**: Google search via Serper.dev
- **@tokenring-ai/scraperapi**: Web scraping and SERP results
- **@tokenring-ai/chrome**: Puppeteer browser automation
- **@tokenring-ai/wikipedia**: Wikipedia API integration
- **@tokenring-ai/aws**: AWS STS/S3 clients
- **@tokenring-ai/docker**: Docker container management
- **@tokenring-ai/kubernetes**: Kubernetes resource discovery
- **@tokenring-ai/sandbox**: Abstract sandbox interface
- **@tokenring-ai/mcp**: Model Context Protocol client
- **@tokenring-ai/research**: Research tools and workflows

### Communication & Publishing (8 packages)

- **@tokenring-ai/slack**: Slack bot integration
- **@tokenring-ai/telegram**: Telegram bot integration
- **@tokenring-ai/feedback**: Human feedback tools
- **@tokenring-ai/blog**: Blog abstraction layer
- **@tokenring-ai/ghost-io**: Ghost.io publishing integration
- **@tokenring-ai/wordpress**: WordPress publishing integration
- **@tokenring-ai/newsrpm**: NewsRPM article management
- **@tokenring-ai/reddit**: Reddit integration

### Audio & Media (2 packages)

- **@tokenring-ai/audio**: Abstract audio framework
- **@tokenring-ai/linux-audio**: Linux audio implementation with naudiodon2

### UI & Frontend (5 packages)

- **@tokenring-ai/cli**: REPL service with interactive prompts
- **@tokenring-ai/cli-ink**: React Ink-based CLI interface
- **@tokenring-ai/web-host**: Fastify-based web server

## Frontend Applications

### Chat Frontend

Located at `frontend/chat/`, this is a React-based web interface for interacting with AI agents.

#### Architecture

**Key Technologies:**
- React with TypeScript
- React Router for navigation
- Framer Motion for animations
- react-icons for icons
- React Markdown for content rendering

**RPC Communication:**
The frontend communicates with the backend via an RPC client defined in `frontend/chat/src/rpc.ts`:
- `agentRPCClient`: Agent management and interaction
- `workflowRPCClient`: Workflow spawning and control
- Custom hooks for data fetching: `useAgent`, `useAgentList`, `useAgentEventState`, etc.

## Integration Patterns

### Service Integration

```typescript
class ServiceIntegration {
  async attach(agent: Agent): Promise<void> {
    // Access other services
    const fsService = agent.requireServiceByType(FileSystemService);
    const aiService = agent.requireServiceByType(AIService);
    
    // Register with agent team
    agent.team.addService(this);
  }
}
```

### Tool Integration

```typescript
const toolDefinition = {
  name: "custom-tool",
  description: "Custom tool description",
  inputSchema: z.object({
    param1: z.string(),
    param2: z.number()
  }),
  execute: async (input, agent) => {
    // Tool implementation
  }
};
```

### Command Integration

```typescript
const commandDefinition = {
  description: "Custom command description",
  execute: async (remainder: string, agent) => {
    // Command implementation
  },
  help: () => "Command usage information"
};
```

## Provider Pattern

The **Provider Pattern** is a core architectural strategy used across TokenRing AI packages (e.g., `@tokenring-ai/blog`, `@tokenring-ai/ai-client`, `@tokenring-ai/websearch`) to support multiple external platforms through a unified interface.

### Overview
A Provider abstracts platform-specific logic (API calls, data normalization, filtering) away from the Service layer. This allows the Agent to interact with different backends (e.g., Ghost vs. WordPress, or OpenAI vs. Anthropic) using the same commands and tools.

### 1. The Provider Interface
Every provider must implement a common interface. This ensures that the Service can delegate tasks without knowing which specific platform is active.

```typescript
interface SomeProvider {
  name: string;
  description: string;

  // Lifecycle hook to register state or tools
  attach(agent: Agent): void;

  // Data Operations
  fetchItems(agent: Agent, filter: TFilter): Promise<T[]>;
  getItem(agent: Agent, id: string): Promise<T>;
  
  // State Management
  getCurrent(agent: Agent): T | null;
}
```


### 2. Implementation Pattern
Providers are responsible for two main tasks: **Normalizing** external data into internal types and **Filtering/Sorting** results.

```typescript
class CustomPlatformProvider implements SomeProvider {
  async fetchItems(agent: Agent, filter: FilterOptions): Promise<CommonType[]> {
    // 1. Fetch raw data from external API
    const rawData = await this.api.getData();

    // 2. Normalize to common interface
    let items = rawData.map(item => this.normalize(item));

    // 3. Apply platform-agnostic filtering logic
    if (filter.keyword) {
      const search = filter.keyword.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(search));
    }

    // 4. Standardize sorting (e.g., most recent first)
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  private normalize(raw: any): CommonType {
     // Map external fields to internal fields
     return { id: raw.uuid, title: raw.heading, ... };
  }
}
```


### 3. Service Delegation
The `Service` acts as the orchestrator. It maintains a registry of available providers and delegates agent requests to the currently active one.

```typescript
class UnifiedService implements TokenRingService {
  private providers: Record<string, DataProvider> = {};
  private activeProvider: string = 'default';

  async attach(agent: Agent) {
    // Register the service and its providers
    agent.services.register(this.name, this);
  }

  async getItems(agent: Agent, filter: FilterOptions) {
    const provider = this.providers[this.activeProvider];
    return await provider.fetchItems(agent, filter);
  }
}
```


### Key Principles
*   **State Isolation**: Providers should store implementation-specific state (like "current selected post" or "session tokens") in the agent's state slices via `agent.mutateState()`.
*   **Thin Services**: The Service layer should contain minimal logic, focusing primarily on routing calls to the active provider.

## State Management

### State Slices

State slices are the core mechanism for managing persistent, serializable state in TokenRing applications. Both agents and the TokenRingApp use state slices.

```typescript
// Agent state slice
class CustomState extends AgentStateSlice<typeof serializationSchema> {
  data: any[] = [];
  
  constructor(initialConfig: Config) {
    super("CustomState", serializationSchema);
  }
  
  serialize(): z.output<typeof serializationSchema> {
    return { data: this.data };
  }
  
  deserialize(data: z.output<typeof serializationSchema>): void {
    this.data = data.data || [];
  }
}

// App state slice (pkg/app/state/)
class AppLogsState extends AppStateSlice<typeof serializationSchema> {
  logs: LogEntry[] = [];
  
  constructor() {
    super("AppLogsState", serializationSchema);
  }
  
  addLog(level: "info" | "error", message: string): void {
    this.logs.push({ timestamp: Date.now(), level, message });
  }
}
```

### Usage Pattern

```typescript
// Initialize state
agent.initializeState(CustomState, initialConfig);
// or for app
app.stateManager.initializeState(AppLogsState, {});

// Mutate state
agent.mutateState(CustomState, state => {
  state.data.push(newItem);
});
// or for app
app.stateManager.mutateState(AppLogsState, state => {
  state.addLog("info", "Message");
});

// Get state
const state = agent.getState(CustomState);
// or for app
const logs = app.logs; // getter returns logs array

// Serialize to checkpoint
const checkpoint = agent.generateCheckpoint();
// or for app
const checkpoint = app.generateStateCheckpoint();

// Restore from checkpoint
agent.restoreState(checkpoint.state);
// or for app
app.restoreState(checkpoint.state);
```

### Key Differences: Agent vs App State

| Feature | Agent State | App State |
|---------|-------------|-----------|
| Base Class | `AgentStateSlice` | `AppStateSlice` |
| Manager | `agent.stateManager` | `app.stateManager` |
| Use Case | Agent-specific data | Application-wide data |
| Example | Chat history, todos | Logs, session info |

## TokenRingApp Logging

The `@tokenring-ai/app` package provides persistent logging through `AppLogsState`:

```typescript
const app = new TokenRingApp(config);

// Log messages (service name is automatically prepended)
app.serviceOutput(service, 'Info message');
app.serviceError(service, 'Error message');

// Access logs
const logs = app.logs; // Array of LogEntry

// Logs persist in checkpoints
const checkpoint = app.generateStateCheckpoint();
// checkpoint.AppLogsState.logs contains all entries

// Restore logs
app.restoreState(checkpoint.state);
```

### Log Entry Structure

```typescript
interface LogEntry {
  timestamp: number;    // Unix timestamp in milliseconds
  level: "info" | "error";
  message: string;      // Formatted with [serviceName] prefix
}
```

## Key Architectural Principles

### 1. Modularity
- Each package is self-contained with clear interfaces
- Minimal dependencies between packages
- Plugin architecture for extensibility

### 2. Agent-Centric
- All functionality exposed through agents
- Uniform interface across packages
- Event-driven communication

### 3. Type Safety
- Full TypeScript coverage with strict mode
- Zod schema validation for runtime type checking
- Comprehensive type definitions

### 4. Event-Driven
- Async generator patterns for events
- Decoupled component communication
- Reactive architecture

### 5. Pluggable
- Multiple provider support (AI, storage, etc.)
- Swap implementations without code changes
- Configuration-driven behavior

### 6. Testable
- Comprehensive testing framework
- Auto-repair capabilities
- Mock-friendly design

## Development Guidelines

### Code Style
- Consistent naming conventions
- Comprehensive error handling
- Async/await patterns throughout
- Proper resource cleanup
- ES modules architecture (`"type": "module"`)

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Naming Conventions
- **Packages**: `@tokenring-ai/{name}` with kebab-case naming
- **Services**: `{Name}Service` suffix for service classes
- **Tools**: `{Action}` format (e.g., `commitTool`, `rollbackTool`)
- **Commands**: Lowercase with forward slash prefix (e.g., `/git`, `/test`)
- **Agents**: CamelCase descriptive names (e.g., `teamLeader`, `contentWriter`)
- **Frontend Components**: PascalCase (e.g., `ChatPage`, `Sidebar`)
- **Frontend Hooks**: `use` prefix (e.g., `useAgent`, `useAgentEventState`)

### Testing Strategy
- Unit tests for individual components
- Integration tests for service interactions
- End-to-end tests for workflows
- Auto-repair for test failures
- Bun test testing framework (built-in)

### Documentation
- README files for each package
- TypeScript interfaces for APIs
- Usage examples and patterns
- Architecture decision records

## Cross-Package Interactions

The ecosystem is agent-centric: `@tokenring-ai/agent` is the hub, registering tools/commands/services from other packages via registries. Key interactions include:

### Agent Workflow
- Agent uses `@tokenring-ai/ai-client` for LLM calls
- Uses `@tokenring-ai/filesystem` for file operations
- Uses `@tokenring-ai/memory` for context
- Uses `@tokenring-ai/queue` for batching

### Dev Pipeline
- `@tokenring-ai/code-watch` detects changes
- Triggers agent with `@tokenring-ai/javascript` (ESLint)
- Runs `@tokenring-ai/testing` (tests)
- Auto-commits via `@tokenring-ai/git` if passing

### Search/Integrations
- `@tokenring-ai/websearch` with providers
- `@tokenring-ai/file-index` searches codebase internally
- Results fed to agent context

### Infra/Storage
- `@tokenring-ai/sandbox` via `@tokenring-ai/docker` for execution
- `@tokenring-ai/database` with `@tokenring-ai/mysql` for queries
- `@tokenring-ai/aws` for cloud operations
- `@tokenring-ai/checkpoint` with `@tokenring-ai/sqlite-storage` for persistence

### UI Flow
- `@tokenring-ai/cli` runs REPL with `@tokenring-ai/inquirer-*` prompts
- `@tokenring-ai/feedback` for human reviews
- Frontend communicates via RPC to backend agents

### Workflow Automation
- `@tokenring-ai/scripting` enables reusable command sequences
- `@tokenring-ai/tasks` orchestrates multi-agent workflows
- `@tokenring-ai/iterables` provides batch processing

### AI Client ↔ Vault Integration

- `@tokenring-ai/ai-client` depends on `@tokenring-ai/vault` for secure API key storage
- Provider API keys are stored in vault with key format: `ai-provider.<providerCode>` (e.g., `ai-provider.openai`)
- The `/ai auth` command allows users to store provider API keys in the vault interactively
- Auto-configuration resolves missing API keys from vault when the vault is unlocked at startup
- Vault keys are mapped in `providerAuthInfo` export from `providers.ts`

This knowledge base serves as a reference for understanding and extending the TokenRing AI ecosystem.
