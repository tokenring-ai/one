# TokenRing AI Package Development Guide

## Overview

This guide provides comprehensive standards and patterns for developing packages in the TokenRing AI monorepo. All packages follow a consistent architecture centered around the `TokenRingService` interface and plugin system.

## Package Structure

### Standard Layout

```
pkg/package-name/
├── index.ts                    # Main entry point (exports)
├── package.json                # Package metadata and dependencies
├── README.md                   # Package documentation
├── tsconfig.json              # TypeScript configuration
├── plugin.ts                  # TokenRing plugin implementation
├── [ServiceName].ts           # Core service implementation
├── [ServiceName]Service.ts    # Alternative service naming
├── tools.ts                   # Tool exports
├── tools/
│   ├── [toolName].ts         # Individual tool implementations
│   └── [toolName]Tool.ts     # Alternative tool naming
├── commands.ts               # Chat command exports
├── commands/
│   └── [commandName]/
│       ├── index.ts          # Command dispatcher
│       ├── subcommand1.ts    # Subcommand implementations
│       └── subcommand2.ts
├── hooks.ts                  # Hook exports (optional)
├── hooks/
│   └── [hookName].ts        # Hook implementations
├── state/
│   └── [StateName].ts       # State slice implementations
├── schema.ts                 # Zod schema definitions (optional)
├── test/
│   ├── [ServiceName].test.ts
│   ├── commands.test.ts
│   ├── tools.test.ts
│   └── integration.test.ts
└── docs/
    └── design.md            # Design documentation
```

## Core Architecture Patterns

### 1. TokenRingService Interface

All packages implement the `TokenRingService` interface:

```typescript
import type {TokenRingService} from "@tokenring-ai/app";
import type {Agent} from "@tokenring-ai/agent";

class PackageService implements TokenRingService {
  name = "package-service";
  description = "Describes what this service does";

  async attach(agent: Agent): Promise<void> {
    // Register tools
    agent.tools.register("tool-name", toolDefinition);

    // Register commands
    agent.commands.register("command-name", commandDefinition);

    // Register hooks (optional)
    agent.hooks.register("hook-name", hookDefinition);

    // Add context providers (optional)
    agent.contextProviders.add(this);
  }

  async detach(agent: Agent): Promise<void> {
    // Cleanup logic if needed
  }
}
```

**Service Constructor Pattern:**
Services typically accept configuration options in their constructor:

```typescript
export default class PackageService implements TokenRingService {
  readonly name = "PackageService";
  description = "Provides package functionality";

  constructor(readonly options: z.output<typeof PackageConfigSchema>) {
    // Initialize from config
  }

  attach(agent: Agent): void {
    // Merge service defaults with agent-specific config
    const config = deepMerge(this.options.agentDefaults, 
      agent.getAgentConfigSlice('packageName', PackageAgentConfigSchema));
    
    // Initialize state if needed
    agent.initializeState(PackageState, config);
  }
}
```

### 2. Plugin Pattern

Packages expose a plugin function for automatic integration:

```typescript
import type {TokenRingAppConfig} from "@tokenring-ai/app";
import {PackageService} from "./PackageService";
import packageJSON from './package.json' with {type: 'json'};

const packageConfigSchema = z.object({
  packageName: PackageConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (!config.packageName) return;
    
    // Register services
    app.addServices(new PackageService(config.packageName));
    
    // Register tools (wait for ChatService if needed)
    app.waitForService(ChatService, chatService => {
      chatService.addTools(tools);
    });
    
    // Register commands
    app.waitForService(AgentCommandService, agentCommandService => {
      agentCommandService.addAgentCommands(commands);
    });
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

**Service Registration Patterns:**
- Direct registration: `app.addServices(new Service())`
- Conditional registration: Check config before adding
- Ordered registration: Use `waitForService` for dependencies

### 3. Tool Definition Pattern

Tools follow a consistent schema using Zod:

```typescript
import {z} from "zod";
import type {Agent} from "@tokenring-ai/agent";
import type {TokenRingToolDefinition, TokenRingToolJSONResult} from "@tokenring-ai/chat/schema";

// Export tool name for consistent messaging
const name = "package_toolName";
const displayName = "Package/toolName";

async function execute(
  input: z.output<typeof inputSchema>,
  agent: Agent
): Promise<TokenRingToolJSONResult<ReturnType>> {
  // Get required services
  const service = agent.requireServiceByType(ServiceName);
  
  // Log tool execution
  agent.infoMessage(`[${name}] Starting operation...`);
  
  // Execute logic
  const result = await performOperation(input);
  
  return {
    type: "json",
    data: result
  };
}

const description = "Clear description of what this tool does" as const;

const inputSchema = z.object({
  param1: z.string().describe("Description of param1"),
  param2: z.number().describe("Description of param2"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
```

**Tool Best Practices:**
- Always use `agent.requireServiceByType()` to get services
- Log execution with `agent.infoMessage([${name}] ...)`
- Return structured JSON responses
- Handle errors gracefully with descriptive messages
- Use `as const` for description to maintain type safety

### 4. Command Pattern

Commands use a slash-prefixed naming convention:

```typescript
import type {TokenRingAgentCommand, AgentCommandInputSchema, AgentCommandInputType} from "@tokenring-ai/agent/types";

const inputSchema = {
  args: {},
  remainder: {
    name: "resources",
    description: "Space-separated resource names",
    required: true,
  }
} as const satisfies AgentCommandInputSchema;

async function execute({remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const service = agent.requireServiceByType(ServiceName);
  const result = await service.performAction(remainder.split(" "), agent);
  return `Operation complete: ${result}`;
}

export default {
  name: "command-name",
  description: "Command description with usage information",
  inputSchema,
  execute,
  help: `Detailed help information

## Example

/command-name arg1 arg2
/command-name --flag value

Description:
  Multiple lines of detailed help
`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
```

**Command Naming:**
- Use space-separated subcommands: `/package enable resource`
- Keep command names lowercase
- Group related commands in subdirectories

**Input Schema Patterns:**
- Empty schema: `{} as const` for commands with no args
- Args with remainder: Use `remainder` for variable input
- Required fields: Mark with `required: true`

### 5. State Management Pattern

State slices provide persistent, serializable state per-agent:

```typescript
import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";

const serializationSchema = z.object({
  items: z.array(z.string()).default([]),
  counter: z.number(),
}).prefault({}); // Use prefault for optional fields

export class PackageState extends AgentStateSlice<typeof serializationSchema> {
  items: string[] = [];
  counter: number = 0;

  constructor(readonly initialConfig: z.output<typeof ConfigSchema>) {
    super("PackageState", serializationSchema);
    // Initialize from config
    this.items = initialConfig.items || [];
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      items: this.items,
      counter: this.counter,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.items = data.items || [];
    this.counter = data.counter || 0;
  }

  // Helper methods for state manipulation
  addItem(item: string): void {
    this.items.push(item);
  }

  show(): string[] {
    return [
      `Items: ${this.items.join(", ")}`,
      `Counter: ${this.counter}`,
    ];
  }
}
```

**State Usage in Service:**
```typescript
attach(agent: Agent): void {
  const config = deepMerge(this.options.agentDefaults, 
    agent.getAgentConfigSlice('packageName', PackageAgentConfigSchema));
  
  agent.initializeState(PackageState, config);
}

// Read state
const state = agent.getState(PackageState);
const items = state.items;

// Modify state
agent.mutateState(PackageState, (state) => {
  state.items.push("new item");
});
```

**State Schema Patterns:**
- Use `.prefault({})` for optional fields with defaults
- Use `.default()` for required fields with defaults
- Always implement `serialize()` and `deserialize()`
- Include a `show()` method for debugging

### 6. Registry Pattern

For managing collections of items:

```typescript
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";

interface Resource {
  name: string;
  execute(): Promise<void>;
}

export default class PackageService implements TokenRingService {
  readonly name = "PackageService";
  private resourceRegistry = new KeyedRegistry<Resource>();

  registerResource = this.resourceRegistry.register;
  getResourceByName = this.resourceRegistry.requireItemByName;
  getAvailableResources = this.resourceRegistry.getAllItemNames;

  attach(agent: Agent): void {
    // Register default resources
    this.registerResource("resource1", new Resource1());
    this.registerResource("resource2", new Resource2());
  }
}
```

**Registry Methods:**
- `register(name, item)`: Register an item
- `requireItemByName(name)`: Get item or throw
- `getItemByName(name)`: Get item or undefined
- `getAllItemNames()`: Get all registered names

### 7. Provider Pattern

For packages supporting multiple platforms/providers:

```typescript
interface Provider {
  name: string;
  displayName: string;
  attach(agent: Agent): void;
  execute(input: string): Promise<any>;
}

class PlatformAProvider implements Provider {
  name = "platform-a";
  displayName = "Platform A";
  async attach(agent: Agent): Promise<void> { /* ... */ }
  async execute(input: string): Promise<any> { /* ... */ }
}

export default class PackageService implements TokenRingService {
  readonly name = "PackageService";
  private providerRegistry = new KeyedRegistry<Provider>();

  registerProvider = this.providerRegistry.register;
  requireProviderByName = this.providerRegistry.requireItemByName;
  getAvailableProviders = this.providerRegistry.getAllItemNames;

  constructor(private options: z.output<typeof ConfigSchema>) {
    // Register default providers
    this.registerProvider("platform-a", new PlatformAProvider());
    this.registerProvider("platform-b", new PlatformBProvider());
  }

  attach(agent: Agent): void {
    const config = deepMerge(this.options.agentDefaults, 
      agent.getAgentConfigSlice('packageName', PackageAgentConfigSchema));
    
    agent.initializeState(PackageState, config);
    
    // Set active provider
    const providerName = config.provider ?? this.options.defaultProvider;
    const provider = this.providerRegistry.getItemByName(providerName);
    creationContext.items.push(`Provider: ${provider?.displayName}`);
  }

  requireActiveProvider(agent: Agent): Provider {
    const { providerName } = agent.getState(PackageState);
    if (!providerName) throw new Error("No provider configured");
    return this.providerRegistry.requireItemByName(providerName);
  }
}
```

### 8. Configuration Schema Pattern

Use Zod for type-safe configuration:

```typescript
import {z} from "zod";

// Agent-specific config (can be overridden per-agent)
export const PackageAgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  items: z.array(z.string()).default([]),
}).prefault({});

// Service-level config (global defaults)
export const PackageConfigSchema = z.object({
  agentDefaults: z.object({
    enabled: z.boolean().default(true),
    items: z.array(z.string()).default([]),
  }).prefault({}),
  // Other service-level options
  providers: z.record(z.string(), z.any()),
});

export type PackageConfig = z.output<typeof PackageConfigSchema>;
```

**Schema Patterns:**
- Use `.prefault({})` for optional objects
- Use `.default(value)` for required fields with defaults
- Separate agent config from service config
- Export types for type safety

## Package Development Workflow

### 1. Initialize Package

```bash
# Create package directory
mkdir -p pkg/package-name/{tools,commands,state,test,docs}

# Initialize package.json
cat > pkg/package-name/package.json << 'EOF'
{
  "name": "@tokenring-ai/package-name",
  "version": "0.1.0",
  "type": "module",
  "main": "index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "@tokenring-ai/agent": "workspace:*",
    "@tokenring-ai/app": "workspace:*",
    "@tokenring-ai/utility": "workspace:*",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "vitest": "^4.1.0",
    "typescript": "^5.9.3"
  }
}
EOF

# Create .gitignore (copy from existing package)
cp pkg/template/.gitignore pkg/package-name/.gitignore
```

### 2. Create Schema Definitions

```typescript
// pkg/package-name/schema.ts
import {z} from "zod";

export const PackageAgentConfigSchema = z.object({
  // Agent-specific options
}).prefault({});

export const PackageConfigSchema = z.object({
  agentDefaults: z.object({
    // Default values for agents
  }).prefault({}),
  // Service-level options
});
```

### 3. Create State Management (if needed)

```typescript
// pkg/package-name/state/packageState.ts
import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";
import {PackageConfigSchema} from "../schema.ts";

const serializationSchema = z.object({
  // State fields
}).prefault({});

export class PackageState extends AgentStateSlice<typeof serializationSchema> {
  // State properties

  constructor(readonly initialConfig: z.output<typeof PackageConfigSchema>) {
    super("PackageState", serializationSchema);
  }

  serialize(): z.output<typeof serializationSchema> {
    // Return serializable state
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    // Restore state from serialized data
  }

  show(): string[] {
    // Return debug information
  }
}
```

### 4. Create Service Implementation

```typescript
// pkg/package-name/PackageService.ts
import {Agent} from "@tokenring-ai/agent";
import type {TokenRingService} from "@tokenring-ai/app/types";
import deepMerge from "@tokenring-ai/utility/object/deepMerge";
import {z} from "zod";
import {PackageConfigSchema, PackageAgentConfigSchema} from "./schema.ts";
import {PackageState} from "./state/packageState.ts";

export default class PackageService implements TokenRingService {
  readonly name = "PackageService";
  description = "Provides package functionality";

  constructor(readonly options: z.output<typeof PackageConfigSchema>) {}

  attach(agent: Agent): void {
    const config = deepMerge(this.options.agentDefaults, 
      agent.getAgentConfigSlice('packageName', PackageAgentConfigSchema));
    
    agent.initializeState(PackageState, config);
  }

  // Service methods
  performAction(param: string, agent: Agent): void {
    agent.mutateState(PackageState, (state) => {
      // Modify state
    });
  }
}
```

### 5. Create Tools

```typescript
// pkg/package-name/tools/toolName.ts
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingToolDefinition} from "@tokenring-ai/chat/schema";
import {z} from "zod";
import PackageService from "../PackageService.ts";

const name = "package_toolName";
const displayName = "Package/toolName";

async function execute(
  input: z.output<typeof inputSchema>,
  agent: Agent
) {
  const service = agent.requireServiceByType(PackageService);
  
  agent.infoMessage(`[${name}] Executing...`);
  
  const result = await service.performAction(input.param);
  
  return {
    type: "json" as const,
    data: result
  };
}

const description = "Tool description" as const;

const inputSchema = z.object({
  param: z.string().describe("Parameter description"),
});

export default {
  name, displayName, description, inputSchema, execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
```

```typescript
// pkg/package-name/tools.ts
import tool1 from "./tools/tool1.ts";
import tool2 from "./tools/tool2.ts";

export default {
  tool1,
  tool2,
};

// Export individual tools for direct import
export {tool1};
export {tool2};
```

### 6. Create Commands

```typescript
// pkg/package-name/commands/package/action.ts
import type {TokenRingAgentCommand, AgentCommandInputSchema, AgentCommandInputType} from "@tokenring-ai/agent/types";
import PackageService from "../../PackageService.ts";

const inputSchema = {
  remainder: {
    name: "args",
    description: "Arguments",
    required: true,
  }
} as const satisfies AgentCommandInputSchema;

async function execute({remainder, agent}: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  const service = agent.requireServiceByType(PackageService);
  const result = await service.performAction(remainder);
  return `Result: ${result}`;
}

export default {
  name: "package action",
  description: "Action description",
  inputSchema,
  execute,
  help: `Detailed help

## Example

/package action arg1 arg2
`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
```

```typescript
// pkg/package-name/commands.ts
import action from './commands/package/action.ts';
import list from './commands/package/list.ts';

export default [action, list];
```

### 7. Create Plugin

```typescript
// pkg/package-name/plugin.ts
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {z} from "zod";
import commands from "./commands.ts";
import packageJSON from "./package.json" with {type: "json"};
import PackageService from "./PackageService.ts";
import {PackageConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  packageName: PackageConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (!config.packageName) return;
    
    // Add services
    app.addServices(new PackageService(config.packageName));
    
    // Register tools
    app.waitForService(ChatService, chatService => {
      chatService.addTools(tools);
    });
    
    // Register commands
    app.waitForService(AgentCommandService, agentCommandService => {
      agentCommandService.addAgentCommands(commands);
    });
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### 8. Create Entry Point

```typescript
// pkg/package-name/index.ts
export {default as PackageService} from "./PackageService.ts";
export {default as packagePlugin} from "./plugin.ts";
export * from "./tools.ts";
export * from "./commands.ts";
export * from "./state/packageState.ts";
export * from "./schema.ts";
```

### 9. Write Tests

```typescript
// pkg/package-name/test/PackageService.test.ts
import {describe, it, expect, beforeEach} from "vitest";
import {PackageService} from "../PackageService";
import {createMockAgent} from "@tokenring-ai/testing";

describe("PackageService", () => {
  let service: PackageService;
  let agent: any;

  beforeEach(() => {
    service = new PackageService({});
    agent = createMockAgent();
  });

  it("should attach to agent", async () => {
    await service.attach(agent);
    expect(agent.initializeState).toHaveBeenCalled();
  });

  it("should perform action", async () => {
    await service.attach(agent);
    const result = service.performAction("test", agent);
    expect(result).toBe(expected);
  });
});
```

### 10. Create Documentation

```markdown
# @tokenring-ai/package-name

Brief description of the package.

## Overview

Detailed overview of functionality.

## Installation

```bash
bun add @tokenring-ai/package-name
```

## Usage

```typescript
import {PackageService} from "@tokenring-ai/package-name";

const service = new PackageService();
```

## Configuration

### Service Configuration

```typescript
{
  packageName: {
    agentDefaults: {
      // Default values
    },
    // Service-level options
  }
}
```

## API Reference

### PackageService

Methods and properties.

## Tools

- `package/toolName`: Tool description

## Commands

- `/package action`: Action description

## Testing

```bash
bun run test
```

## License

MIT
```

## Package Naming Conventions

### Package Names
- Scope: `@tokenring-ai/`
- Name: kebab-case (e.g., `package-name`, `code-quality`)
- Category prefix: Optional (e.g., `dev-package-name`, `web-package-name`)

### Service Names
- Suffix: `Service` (e.g., `PackageService`, `TemplateService`)
- Name: PascalCase, descriptive

### Tool Names
- Format: kebab-case (e.g., `package-tool`, `create-resource`)
- Display: PascalCase with slash (e.g., `Package/createTool`)
- Internal: `package_toolName` (e.g., `docker_dockerRun`)

### Command Names
- Format: lowercase with space (e.g., `package action`, `queue start`)
- Full command: `/package action` (with slash prefix in usage)
- Subcommands: Space-separated (e.g., `/terminal provider select`)

### State Names
- Suffix: `State` (e.g., `PackageState`, `TemplateState`)
- Name: PascalCase, descriptive

### File Names
- Services: PascalCase (e.g., `PackageService.ts`)
- Tools: kebab-case (e.g., `toolName.ts`)
- Commands: kebab-case in subdirectories (e.g., `commands/package/action.ts`)
- Tests: camelCase with `.test.ts` (e.g., `packageService.test.ts`)
- Schemas: `schema.ts`
- State: PascalCase in `state/` directory (e.g., `state/packageState.ts`)

## Dependencies

### Required Dependencies
- `@tokenring-ai/agent`: Core agent system
- `@tokenring-ai/app`: Application framework
- `@tokenring-ai/utility`: Shared utilities
- `zod`: Schema validation

### Optional Dependencies
- `@tokenring-ai/ai-client`: AI integration
- `@tokenring-ai/filesystem`: File operations
- `@tokenring-ai/chat`: Chat service
- `@tokenring-ai/database`: Database operations
- `@tokenring-ai/testing`: Testing utilities
- `@tokenring-ai/terminal`: Terminal execution
- `@tokenring-ai/sandbox`: Sandbox execution

### Version Management
- Use workspace protocol: `"workspace:*"`
- Match TokenRing core versions: `0.2.0`
- External dependencies: Specific versions with `^`

## Testing Standards

### Test Structure

```typescript
import {describe, it, expect, beforeEach, afterEach} from "vitest";
import {MockAgent} from "@tokenring-ai/testing";

describe("PackageName", () => {
  let agent: MockAgent;

  beforeEach(() => {
    agent = new MockAgent();
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it("should do something", async () => {
    // Test implementation
    const result = await performAction();
    expect(result).toBe(expected);
  });
});
```

### Test Coverage Areas
- Service attach/detach
- Tool registration and execution
- Command registration and execution
- State management
- Integration with other services
- Error handling

### Running Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test:watch

# Specific test file
bun run test package.test.ts

# With coverage
bun run test --coverage
```

## Common Patterns

### Command Input Schema Patterns

**No Arguments:**
```typescript
const inputSchema = {} as const satisfies AgentCommandInputSchema;
```

**With Remainder:**
```typescript
const inputSchema = {
  remainder: {
    name: "resources",
    description: "Space-separated resource names",
    required: true,
  }
} as const satisfies AgentCommandInputSchema;
```

**With Args:**
```typescript
const inputSchema = {
  args: {
    name: {
      type: "string",
      description: "Name of resource",
      required: true,
    }
  }
} as const satisfies AgentCommandInputSchema;
```

### State Management Patterns

**Multiple State Slices:**
```typescript
attach(agent: Agent): void {
  agent.initializeState(TaskState, config);
  agent.initializeState(ExecutionState, config);
}
```

**State with Complex Types:**
```typescript
const serializationSchema = z.object({
  queue: z.array(z.object({
    checkpoint: z.any(),
    name: z.string(),
    input: z.string()
  })),
  started: z.boolean(),
  currentItem: z.any().nullable(),
});

export class QueueState extends AgentStateSlice<typeof serializationSchema> {
  queue: QueueItem[] = [];
  started = false;
  currentItem: QueueItem | null = null;
  // ...
}
```

**State with Maps/Sets:**
```typescript
export class TaskState extends AgentStateSlice<typeof serializationSchema> {
  tasks: Map<string, Task> = new Map();
  history: Map<string, HistoryEntry[]> = new Map();
  
  serialize(): z.output<typeof serializationSchema> {
    return {
      tasks: Array.from(this.tasks.entries()),
      history: Array.from(this.history.entries()),
    };
  }
  
  deserialize(data: z.output<typeof serializationSchema>): void {
    this.tasks = new Map(data.tasks);
    this.history = new Map(data.history);
  }
}
```

### Service-to-Service Communication

**Waiting for Services:**
```typescript
// In plugin.ts
app.waitForService(ChatService, chatService => {
  chatService.addTools(tools);
});

app.waitForService(AgentCommandService, agentCommandService => {
  agentCommandService.addAgentCommands(commands);
});
```

**Requiring Services in Tools/Commands:**
```typescript
const service = agent.requireServiceByType(ServiceName);
```

### Error Handling

**In Tools:**
```typescript
async function execute(input, agent) {
  try {
    const result = await performAction(input);
    return {type: "json", data: result};
  } catch (err) {
    throw new Error(`[toolName] ${err.message}`);
  }
}
```

**In Commands:**
```typescript
import {CommandFailedError} from "@tokenring-ai/agent/AgentError";

async function execute({agent}) {
  if (!condition) {
    throw new CommandFailedError("Error message");
  }
  return "Success";
}
```

### Background Tasks

**Running Background Tasks:**
```typescript
attach(agent: Agent): void {
  if (config.autoStart) {
    this.runBackgroundTask(agent);
  }
}

runBackgroundTask(agent: Agent): void {
  agent.runBackgroundTask(async (signal) => {
    try {
      while (!signal.aborted) {
        // Do work
        await doWork();
        await setTimeout(1000);
      }
    } finally {
      // Cleanup
    }
  });
}
```

**Subscribing to State Changes:**
```typescript
async watchTasks(agent: Agent, signal: AbortSignal) {
  for await (const state of agent.subscribeStateAsync(TaskState, signal)) {
    // React to state changes
  }
}
```

## Package Categories

### Core Foundation
- Agent orchestration
- AI client integration
- Utility functions
- Filesystem abstraction
- Memory management
- Queue processing
- Checkpoint persistence

### Storage & Database
- Abstract database layer
- Specific database implementations
- ORM integration
- CDN services
- Storage providers

### Development Tools
- Testing frameworks
- Git operations
- Code analysis
- Codebase context
- File indexing
- Scripting languages
- Task orchestration

### Web & External Services
- Web search
- Scraping
- Browser automation
- API integrations
- Cloud services
- Container management

### Communication & Publishing
- Messaging platforms
- Publishing platforms
- Feedback systems
- Blog integrations

### Audio & Media
- Audio processing
- Media handling

### UI & Frontend
- CLI interfaces
- Web servers
- Desktop applications

## Best Practices

### 1. Keep Services Thin
- Services should delegate to providers
- Minimal logic in service layer
- Focus on orchestration

### 2. Error Handling
- Use descriptive error messages
- Include context in errors
- Handle edge cases gracefully
- Use `CommandFailedError` for commands

### 3. Type Safety
- Use strict TypeScript
- Define Zod schemas for validation
- Type all function parameters and returns
- Use `as const` for schemas

### 4. Documentation
- Write comprehensive README
- Include usage examples
- Document all public APIs
- Add inline comments for complex logic

### 5. Testing
- Write tests alongside code
- Test error conditions
- Use mock agents for isolation
- Aim for high coverage

### 6. Performance
- Avoid unnecessary async operations
- Cache expensive computations
- Use streaming for large data
- Minimize memory footprint

### 7. Security
- Validate all inputs
- Sanitize user-provided data
- Use parameterized queries
- Handle secrets securely

### 8. Configuration
- Provide sensible defaults
- Allow per-agent overrides
- Use Zod for validation
- Document all options

## Migration Guide

### From Old to New Pattern

**Old Pattern:**
```javascript
// JavaScript, no types
// Direct file system access
// No plugin system
// Manual service registration
```

**New Pattern:**
```typescript
// TypeScript with strict mode
// Abstract filesystem interface
// Plugin-based registration
// Automatic service attachment
```

### Breaking Changes Protocol

1. Deprecate old API with warnings
2. Provide migration guide
3. Support both APIs for one major version
4. Remove deprecated API in next major version
5. Update all documentation

## Troubleshooting

### Common Issues

**Service not attaching:**
- Check service name uniqueness
- Verify agent has required dependencies
- Check attach method returns Promise

**Tools not registering:**
- Verify tool schema is valid Zod schema
- Check tool name doesn't conflict
- Ensure execute function is async
- Verify tool is exported from tools.ts

**Commands not working:**
- Verify command name format (`/command-name`)
- Check help text is provided
- Ensure execute function handles empty remainder
- Verify command is exported from commands.ts

**State not persisting:**
- Verify serialization schema is valid
- Check state slice name is unique
- Ensure checkpoint storage is configured
- Implement serialize/deserialize correctly

**Configuration not merging:**
- Use `deepMerge` from utility
- Ensure schemas have proper defaults
- Check `prefault` usage for optional fields

## Resources

- [TokenRing AI Knowledge Base](./code.md)
- [Agent Documentation](../agent/README.md)
- [App Framework Documentation](../app/README.md)
- [Testing Guide](./testing.md)
- [Architecture Patterns](./architecture.md)

## Example Packages

Reference these packages for specific patterns:

- **@tokenring-ai/database**: Abstract database layer with provider pattern
- **@tokenring-ai/codebase**: Context provider with state management
- **@tokenring-ai/docker**: Container management with tools
- **@tokenring-ai/terminal**: Interactive terminal sessions
- **@tokenring-ai/queue**: Work queue with state persistence
- **@tokenring-ai/scheduler**: Background task scheduling
