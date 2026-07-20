# TokenRing AI Implementation Guide

## Practical Implementation Examples and Patterns

This guide provides concrete code examples and implementation patterns for working with the TokenRing AI ecosystem.

## Table of Contents

1. [Plugin Architecture Overview](#plugin-architecture-overview)
2. [Creating Custom Packages](#creating-custom-packages)
3. [Implementing Services](#implementing-services)
4. [Creating Tools](#creating-tools)
5. [Developing Commands](#developing-commands)
6. [Implementing Context Handlers](#implementing-context-handlers)
7. [State Management Patterns](#state-management-patterns)
8. [Configuration and Schema Validation](#configuration-and-schema-validation)
9. [Integration Patterns](#integration-patterns)
10. [Testing Implementations](#testing-implementations)
11. [Error Handling Patterns](#error-handling-patterns)

## Plugin Architecture Overview

The TokenRing AI ecosystem uses a **plugin-based architecture** where each package is a self-contained plugin that registers its capabilities with the main application.

### Plugin Structure

```typescript
// pkg/my-package/plugin.ts
import {TokenRingPlugin} from "@tokenring-ai/app";
import packageJSON from "./package.json" with {type: "json"};
import {z} from "zod";

const packageConfigSchema = z.object({
  myPackage: z.object({
    option1: z.string().optional(),
    option2: z.number().default(10),
  }).optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    // Plugin installation logic
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Plugin Installation Flow

```typescript
// Plugin installation happens in this order:
install(app, config) {
  // 1. Wait for service dependencies
  app.waitForService(ServiceName, (service) => {
    // 2. Register components with services
  });
  
  // 3. Add service instances
  app.addServices(new MyService());
  
  // 4. Register RPC resources
  app.waitForService(WebHostService, (webHostService) => {
    webHostService.registerResource("My RPC endpoint", new JsonRpcResource(app, myRPC));
  });
}
```

## Creating Custom Packages

### Package Structure

```
pkg/my-package/
├── plugin.ts           # Main plugin entry point
├── index.ts            # Public exports
├── package.json        # Package metadata
├── tools.ts            # Tool definitions
├── commands.ts         # Chat command definitions
├── contextHandlers.ts  # Context provider definitions
├── MyService.ts        # Service implementation
└── schema.ts           # Zod schema definitions
```

### Basic Package Example

```typescript
// pkg/my-package/plugin.ts
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {ScriptingService} from "@tokenring-ai/scripting";
import {ScriptingThis} from "@tokenring-ai/scripting/ScriptingService";
import {WebHostService} from "@tokenring-ai/web-host";
import JsonRpcResource from "@tokenring-ai/web-host/JsonRpcResource";
import {z} from "zod";

import chatCommands from "./commands.ts";
import contextHandlers from "./contextHandlers.ts";
import MyService from "./MyService.ts";
import packageJSON from "./package.json" with {type: "json"};
import myRPC from "./rpc/myRPC.ts";
import {MyConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  myPackage: MyConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.myPackage) {
      // Register scripting functions
      app.waitForService(ScriptingService, (scriptingService: ScriptingService) => {
        scriptingService.registerFunction("myFunction", {
          type: 'native',
          params: ['param1', 'param2'],
          async execute(this: ScriptingThis, param1: string, param2: number): Promise<string> {
            await this.agent.requireServiceByType(MyService).doSomething(param1, param2, this.agent);
            return `Result: ${param1}`;
          }
        });
      });

      // Register tools and context handlers
      app.waitForService(ChatService, (chatService: ChatService) => {
        chatService.addTools(packageJSON.name, tools);
        chatService.registerContextHandlers(contextHandlers);
      });

      // Register chat commands
      app.waitForService(AgentCommandService, (agentCommandService: AgentCommandService) =>
        agentCommandService.addAgentCommands(chatCommands)
      );

      // Add services
      app.addServices(new MyService(config.myPackage));

      // Register RPC endpoint
      app.waitForService(WebHostService, (webHostService: WebHostService) => {
        webHostService.registerResource("My RPC endpoint", new JsonRpcResource(app, myRPC));
      });
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Package Configuration

```json
{
  "name": "@tokenring-ai/my-package",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./*": "./*.ts"
  },
  "dependencies": {
    "@tokenring-ai/agent": "^0.2.0",
    "@tokenring-ai/app": "^0.2.0",
    "@tokenring-ai/chat": "^0.2.0",
    "@tokenring-ai/scripting": "^0.2.0",
    "@tokenring-ai/web-host": "^0.2.0",
    "zod": "^4.1.13"
  }
}
```

### Index File

```typescript
// pkg/my-package/index.ts
export { default as MyService } from "./MyService.ts";
export { default } from "./plugin.ts";
```

## Implementing Services

### Service Implementation

```typescript
// pkg/my-package/MyService.ts
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingService} from "@tokenring-ai/app/types";
import {z} from "zod";
import {MyServiceConfigSchema} from "./schema.ts";

export default class MyService implements TokenRingService {
  name = "MyService";
  description = "Custom service for my package";
  
  constructor(private options: z.output<typeof MyServiceConfigSchema>) {}

  attach(agent: Agent): void {
    // Initialize agent-specific state
    agent.initializeState(MyServiceState, {});
  }
  
  async doSomething(param1: string, param2: number, agent: Agent): Promise<void> {
    // Service implementation
    const state = agent.getState(MyServiceState);
    // ... perform operations
  }
}
```

### Service State Slice

```typescript
// pkg/my-package/state/myServiceState.ts
export interface MyServiceState {
  data: Map<string, any>;
  lastUpdated: number | null;
}

export class MyServiceState implements MyServiceState {
  name = 'myService';
  data = new Map<string, any>();
  lastUpdated: number | null = null;
  
  reset(what: ResetWhat[]): void {
    if (what.includes('chat')) {
      this.data.clear();
    }
  }
  
  serialize(): object {
    return {
      data: Object.fromEntries(this.data),
      lastUpdated: this.lastUpdated,
    };
  }
  
  deserialize(obj: any): void {
    this.data = new Map(Object.entries(obj.data || {}));
    this.lastUpdated = obj.lastUpdated || null;
  }
}
```

## Creating Tools

### Tool Definition

```typescript
// pkg/my-package/tools/myTool.ts
import {z} from "zod";

const myToolSchema = z.object({
  action: z.enum(['create', 'read', 'update', 'delete']),
  path: z.string(),
  content: z.string().optional(),
});

const myTool = {
  description: "Perform CRUD operations on my resource",
  inputSchema: myToolSchema,
  execute: async (input: z.infer<typeof myToolSchema>, agent: Agent) => {
    // Tool implementation
    switch (input.action) {
      case 'create':
        return { success: true, message: `Created ${input.path}` };
      case 'read':
        return { content: "file content", path: input.path };
      case 'update':
        return { success: true, message: `Updated ${input.path}` };
      case 'delete':
        return { success: true, message: `Deleted ${input.path}` };
    }
  }
};

export default myTool;
```

### Tools Index

```typescript
// pkg/my-package/tools.ts
import myTool from "./tools/myTool.ts";
import anotherTool from "./tools/anotherTool.ts";

export default {
  myTool,
  anotherTool,
};
```

## Developing Commands

### Command Implementation

```typescript
// pkg/my-package/commands/myCommand.ts
const myCommand = {
  description: "My custom command",
  execute: async (remainder: string, agent: Agent) => {
    const args = remainder.split(' ').filter(Boolean);
    const subcommand = args[0];
    
    switch (subcommand) {
      case 'action1':
        await handleAction1(args.slice(1), agent);
        break;
      case 'action2':
        await handleAction2(args.slice(1), agent);
        break;
      default:
        await agent.events.chatOutput(
          "Unknown command. Use /my-command help for usage."
        );
    }
  },
  help: () => [
    "My Command - Description of what this command does",
    "",
    "Usage:",
    "  /my-command action1 <args>   - Description of action1",
    "  /my-command action2 <args>   - Description of action2",
    "  /my-command help             - Show this help",
  ]
};

async function handleAction1(args: string[], agent: Agent): Promise<void> {
  // Implementation
  await agent.events.chatOutput(`Action 1 executed with: ${args.join(' ')}`);
}

export default myCommand;
```

### Commands Index

```typescript
// pkg/my-package/commands.ts
import myCommand from "./commands/myCommand.ts";
import anotherCommand from "./commands/anotherCommand.ts";

export default {
  myCommand,
  anotherCommand,
};
```

## Implementing Context Handlers

### Context Handler Implementation

```typescript
// pkg/my-package/contextHandlers/myHandler.ts
import {ContextItem} from "@tokenring-ai/chat/schema";

const myHandler = {
  description: "Provides context about my resource",
  getContextItems: async function*(agent: Agent): AsyncGenerator<ContextItem> {
    const state = agent.getState(MyServiceState);
    
    for (const [key, value] of state.data) {
      yield {
        content: `Resource ${key}: ${JSON.stringify(value)}`,
        metadata: {
          source: 'my-handler',
          key,
          timestamp: state.lastUpdated,
        }
      };
    }
  }
};

export default myHandler;
```

### Context Handlers Index

```typescript
// pkg/my-package/contextHandlers.ts
import myHandler from "./contextHandlers/myHandler.ts";
import anotherHandler from "./contextHandlers/anotherHandler.ts";

export default {
  'my-handler': myHandler,
  'another-handler': anotherHandler,
} as Record<string, ContextHandler>;
```

## State Management Patterns

### State Slice Pattern

```typescript
import {StateSlice, ResetWhat} from "@tokenring-ai/agent";

export interface MyState {
  items: Map<string, Item>;
  selectedItems: Set<string>;
  filter: string | null;
}

export class MyState implements MyState {
  name = 'myState';
  items = new Map<string, Item>();
  selectedItems = new Set<string>();
  filter: string | null = null;
  
  reset(what: ResetWhat[]): void {
    if (what.includes('chat')) {
      this.selectedItems.clear();
      this.filter = null;
    }
    if (what.includes('memory')) {
      this.items.clear();
    }
  }
  
  serialize(): object {
    return {
      items: Object.fromEntries(this.items),
      selectedItems: Array.from(this.selectedItems),
      filter: this.filter,
    };
  }
  
  deserialize(obj: any): void {
    this.items = new Map(Object.entries(obj.items || {}));
    this.selectedItems = new Set(obj.selectedItems || []);
    this.filter = obj.filter || null;
  }
}
```

### State Mutation Pattern

```typescript
// In service implementation
async function updateItem(id: string, updates: Partial<Item>, agent: Agent): Promise<void> {
  agent.mutateState(MyState, (state: MyState) => {
    const existing = state.items.get(id);
    if (existing) {
      state.items.set(id, { ...existing, ...updates });
    }
  });
}

async function selectItem(id: string, agent: Agent): Promise<void> {
  agent.mutateState(MyState, (state: MyState) => {
    state.selectedItems.add(id);
  });
}

// Get state snapshot
const state = agent.getState(MyState);
```

## Configuration and Schema Validation

### Zod Schema Definition

```typescript
// pkg/my-package/schema.ts
import z from "zod";

export const MyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxItems: z.number().min(1).max(100).default(50),
  options: z.object({
    option1: z.string().default("default"),
    option2: z.number().default(0),
  }).default({}),
}).default({});

export const MyAgentConfigSchema = z.object({
  mode: z.enum(['read', 'write', 'both']).default('both'),
  autoSelect: z.boolean().default(false),
}).default({});
```

### Package Config Schema

```typescript
// In plugin.ts
const packageConfigSchema = z.object({
  myPackage: MyConfigSchema.optional(),
});
```

### Config Usage

```typescript
// In service
constructor(private options: z.output<typeof MyConfigSchema>) {
  // Options are validated and typed
  this.maxItems = options.maxItems;
}
```

## Integration Patterns

### Multi-Service Integration

```typescript
async function integrateServices(agent: Agent): Promise<void> {
  const fsService = agent.requireServiceByType(FileSystemService);
  const aiService = agent.requireServiceByType(AIService);
  const myService = agent.requireServiceByType(MyService);
  
  // Use services together
  const fileContent = await fsService.readTextFile("data.json", agent);
  const analyzed = await aiService.analyze(fileContent, agent);
  await myService.process(analyzed, agent);
}
```

### RPC Integration

```typescript
// pkg/my-package/rpc/myRPC.ts
const myRPC = {
  myMethod: {
    description: "RPC method description",
    params: z.object({
      param1: z.string(),
      param2: z.number().optional(),
    }),
    execute: async (params: { param1: string; param2?: number }, app: App) => {
      const agent = app.getCurrentAgent();
      return await agent.requireServiceByType(MyService).handleRPC(params, agent);
    }
  }
};

export default myRPC;
```

### Plugin Installation Pattern

```typescript
// Complete installation pattern
install(app, config) {
  if (!config.myPackage) return;
  
  // 1. Wait for ScriptingService
  app.waitForService(ScriptingService, (scriptingService) => {
    scriptingService.registerFunction("myFunction", {
      type: 'native',
      params: ['param1', 'param2'],
      execute: async function(this: ScriptingThis, param1: string, param2: number) {
        return await this.agent.requireServiceByType(MyService).process(param1, param2, this.agent);
      }
    });
  });

  // 2. Wait for ChatService
  app.waitForService(ChatService, (chatService) => {
    chatService.addTools(packageJSON.name, tools);
    chatService.registerContextHandlers(contextHandlers);
  });

  // 3. Wait for AgentCommandService
  app.waitForService(AgentCommandService, (agentCommandService) =>
    agentCommandService.addAgentCommands(chatCommands)
  );

  // 4. Add service instances
  app.addServices(new MyService(config.myPackage));

  // 5. Wait for WebHostService
  app.waitForService(WebHostService, (webHostService) => {
    webHostService.registerResource("My RPC endpoint", new JsonRpcResource(app, myRPC));
  });
}
```

## Testing Implementations

### Service Testing

```typescript
describe("MyService", () => {
  let service: MyService;
  let mockAgent: MockAgent;
  
  beforeEach(() => {
    service = new MyService({ maxItems: 10 });
    mockAgent = createMockAgent();
  });
  
  it("should initialize state correctly", () => {
    service.attach(mockAgent);
    expect(mockAgent.getState(MyState)).toBeDefined();
  });
  
  it("should process items within limits", async () => {
    const result = await service.process("test-item", mockAgent);
    expect(result).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe("MyPackage Integration", () => {
  it("should install and work correctly", async () => {
    const app = createTestApp();
    const plugin = await import("./plugin.ts");
    
    plugin.default.install(app, { myPackage: { maxItems: 10 } });
    
    const agent = app.createAgent();
    const myService = agent.requireServiceByType(MyService);
    
    expect(myService).toBeDefined();
  });
});
```

## Error Handling Patterns

### Service Error Handling

```typescript
class MyService implements TokenRingService {
  async riskyOperation(param: string, agent: Agent): Promise<Result> {
    try {
      // Perform operation
      return await this.performOperation(param, agent);
    } catch (error) {
      await agent.events.chatOutput(`Error: ${error.message}`);
      throw error;
    }
  }
}
```

### Validation Error Handling

```typescript
function validateInput(input: unknown, schema: z.ZodSchema): input is z.infer<typeof schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  return true;
}
```

## Conclusion

This implementation guide provides practical patterns and examples for working with the TokenRing AI ecosystem. Key takeaways:

1. **Plugin Architecture**: Use the `install(app, config)` pattern for all packages
2. **Service Pattern**: Implement `TokenRingService` with proper `attach()` method
3. **Tool Pattern**: Export tools as a module with named exports
4. **Command Pattern**: Export commands with `description`, `execute`, and `help`
5. **Context Handler Pattern**: Implement `getContextItems` as async generator
6. **State Management**: Use state slices with `serialize()` and `deserialize()`
7. **Configuration**: Use Zod schemas for type-safe configuration validation
8. **Integration**: Use `app.waitForService()` for service dependencies

These patterns ensure maintainable, reliable, and extensible code within the TokenRing AI ecosystem.
