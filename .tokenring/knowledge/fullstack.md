# Full Stack Knowledge Repository

This file maintains knowledge about full-stack features, integrations, and end-to-end functionality in the TokenRing project.

## Project Overview
TokenRing AI - A comprehensive AI development platform with 45 specialized packages under @tokenring-ai/* scope, centered on **TokenRing One** (backend), a single unified agent for coding, content creation, research, and automation, with modular, agent-centric architecture. TokenRing One unified the former TokenRing Coder (development) and TokenRing Writer (content creation) apps into one product.

## Core Architecture Patterns

### 1. Agent-Centric Full-Stack Orchestration
- **Central Orchestrator**: @tokenring-ai/agent acts as the central orchestrator for all full-stack operations
- **Specialized Agents**: Full-stack developer, integration engineer, frontend designer, documentation engineer
- **End-to-End Workflow**: Single agent can implement complete frontend/backend features from requirements to deployment
- **Context Injection**: Agents receive context from filesystem, databases, memory, and other services

```typescript
// Full-stack development workflow
const agent = await team.createAgent('fullstack-developer');
await agent.handleInput({
  message: `Build a complete user authentication system with:
  - React frontend with login/register forms
  - Node.js/Express backend with JWT authentication
  - MySQL database with user table and migration
  - Protected routes and middleware
  - Integration tests for all components
  - Deployment configuration`
});

// Agent orchestrates: 
// - Frontend: React components, routing, state management
// - Backend: API endpoints, middleware, authentication
// - Database: Schema design, migrations, queries
// - Testing: Unit tests, integration tests
// - Documentation: API docs, user guides
```

### 2. Plugin-Based Integration Architecture

#### Frontend Integration Pattern
```typescript
// WebTerminal app initialization
const app = new TokenRingApp(defaultChatConfig);
const pluginManager = new PluginManager(app);
await pluginManager.installPlugins([
  AgentPackage,        // Core orchestration
  AIClientPackage,     // AI provider integration  
  DatabasePackage,     // Database abstraction
  FilesystemPackage,   // File operations
  ChatPackage,         // Real-time communication
  CheckpointPackage,   // State persistence
  MemoryPackage,       // Context management
  MCPPackage,          // Protocol integration
  QueuePackage,        // Task batching
  ScriptingPackage,    // Code execution
  TestingPackage,      // Validation
]);

// React context for service access
<TokenRingAppProvider app={app}>
  <App />
</TokenRingAppProvider>
```

#### Backend Service Registration
```typescript
// Service registry pattern
class PluginManager {
  async installPlugins(plugins: TokenRingPackage[]) {
    for (const plugin of plugins) {
      const services = plugin.getServices();
      this.app.registerServices(services);
      
      const tools = plugin.getTools();
      this.app.registerTools(tools);
      
      const commands = plugin.getCommands();
      this.app.registerCommands(commands);
    }
  }
}
```

### 3. Real-Time Frontend-Backend Communication

#### WebSocket API Pattern
```typescript
// WebSocket-based real-time communication
const socket = new WebSocket('ws://localhost:3000/agent');

// Agent communication flow
socket.onmessage = (event) => {
  const response = JSON.parse(event.data);
  // Handle agent response in real-time
  if (response.type === 'agent-response') {
    updateUI(response.content);
  } else if (response.type === 'tool-execution') {
    showToolResult(response.result);
  }
};
```

#### React Context Integration
```typescript
// Context provider for service access
export function TokenRingAppProvider({ app, children }) {
  return (
    <AgentTeamContext.Provider value={app}>
      {children}
    </AgentTeamContext.Provider>
  );
}

export function useAgentManager() {
  return useApp()?.requireService(AgentManager);
}
```

### 4. Context Injection and State Management

#### Multi-Source Context Injection
```typescript
// Context flows to agents from multiple sources
const contextItems = await getContextItems(input, chatConfig, params, agent);

// Available context sources:
const availableDatabases = [
  'myPostgres',
  'mySQLite', 
  'production-db'
];

const availableAgents = [
  'Frontend Engineer: Implement user interfaces...',
  'Integration Engineer: API integrations...',
  'Full-Stack Developer: Complete implementations...'
];
```

#### State Persistence Pattern
```typescript
// Checkpoint system for state persistence
class CheckpointService {
  async saveCheckpoint(agent: Agent, state: any) {
    await this.db.save(`checkpoint:${agent.id}`, state);
  }
  
  async loadCheckpoint(agentId: string) {
    return await this.db.load(`checkpoint:${agentId}`);
  }
}
```

### 5. Database Integration Patterns

#### Abstract Database Provider
```typescript
// Database abstraction layer
export default async function * getContextItems(
  input: string, 
  chatConfig: ChatConfig, 
  params: {}, 
  agent: Agent
): AsyncGenerator<ContextItem> {
  const databaseService = agent.requireServiceByType(DatabaseService);
  const available = databaseService['databases'].getAllItemNames();
  
  yield {
    role: "user",
    content: `/* These are the databases available for the database tool */:\n` +
             available.map((name) => `- ${name}`).join("\n"),
  };
}
```

#### Multi-Database Support
```typescript
// Support for SQLite, PostgreSQL, MySQL
const databaseProviders = {
  sqlite: new SQLiteProvider(),
  postgresql: new PostgreSQLProvider(),
  mysql: new MySQLProvider()
};

// Agent can use: database/executeSql tool with any provider
```

### 6. Frontend Development Patterns

#### React Component Architecture
```typescript
// Frontend engineer agent configuration
export default {
  name: "Frontend Engineer",
  description: "Implement user interfaces, interactive components...",
  category: "Development",
  chat: {
    systemPrompt: "You are an expert frontend engineer...",
    enabledTools: ["@tokenring-ai/filesystem/*"],
    context: {
      initial: [
        {type: "task-plan"},
        {type: "tool-context"},
        {type: "search-files"},
        {type: "selected-files"},
        {type: "current-message"},
      ],
    }
  }
}
```

#### State Management Integration
```typescript
// Focus management in React components
const {isFocused} = useFocus({
  autoFocus: true,
  isActive: !disabled,
});

// Tab navigation and keyboard handling
useEffect(() => {
  if (focusNext) {
    focusManager.focusNext();
  }
}, [focusNext]);
```

### 7. Full-Stack Development Workflows

#### End-to-End Feature Implementation
```typescript
// Complete feature development workflow
const workflow = {
  // 1. Planning phase
  planning: "Analyze requirements and create implementation plan",
  
  // 2. Frontend implementation
  frontend: {
    components: "React components with TypeScript",
    routing: "React Router integration",
    state: "State management (Redux/Zustand)",
    styling: "CSS-in-JS or CSS modules",
    testing: "Jest + React Testing Library"
  },
  
  // 3. Backend implementation
  backend: {
    api: "Express.js/Node.js API endpoints",
    auth: "JWT authentication middleware",
    validation: "Input validation and sanitization",
    database: "Database operations with ORM",
    testing: "Unit and integration tests"
  },
  
  // 4. Integration
  integration: {
    apis: "REST/GraphQL API integration",
    websockets: "Real-time communication",
    webhooks: "External service integration",
    deployment: "CI/CD pipeline setup"
  }
};
```

#### Multi-Agent Coordination
```typescript
// Specialized agents work together
const agentTeam = {
  "Frontend Engineer": {
    focus: "UI components, responsive design, state management",
    tools: ["@tokenring-ai/filesystem/*"]
  },
  "Backend Developer": {
    focus: "API endpoints, database design, authentication",
    tools: ["@tokenring-ai/database/*", "@tokenring-ai/filesystem/*"]
  },
  "Integration Engineer": {
    focus: "Third-party APIs, webhooks, external services",
    tools: ["@tokenring-ai/websearch/*", "@tokenring-ai/filesystem/*"]
  },
  "Full-Stack Developer": {
    focus: "End-to-end implementation and coordination",
    tools: ["@tokenring-ai/*"]
  }
};
```

## Integration Technologies

### Frontend Stack
- **React**: Primary UI framework with TypeScript
- **Context API**: State management and service access
- **WebSocket**: Real-time communication with agents
- **Modern Web APIs**: File system access, audio processing
- **Testing**: Jest, React Testing Library, integration tests

### Backend Stack  
- **Node.js**: Runtime environment for agents and services
- **TypeScript**: Type-safe development across all packages
- **Plugin Architecture**: Dynamic service and tool registration
- **Database Abstraction**: Multiple database providers (SQLite, PostgreSQL, MySQL)
- **Queue System**: Task batching and checkpoint preservation
- **Checkpoint Service**: State persistence across sessions

### Real-Time Communication
- **WebSocket Protocol**: Bidirectional agent communication
- **Event-Driven Architecture**: Agent events and responses
- **Structured Message Protocol**: JSON-based message formats
- **Auto-Reconnection**: Robust connection management

### AI Integration
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, Cerebras
- **Model Selection**: Automatic provider selection based on capabilities
- **Cost Tracking**: Usage analytics and cost calculation
- **Streaming Responses**: Real-time AI response streaming

## Cross-Package Integration

### Development Workflow Integration
```typescript
// Code change detection → agent triggering → testing → git commit
@tokenring-ai/code-watch (file changes) 
→ @tokenring-ai/agent (triggers agent) 
→ @tokenring-ai/javascript (ESLint) + @tokenring-ai/testing (run tests) 
→ @tokenring-ai/git (auto-commit if passing)
```

### Data Flow Patterns
```typescript
// Agent requests → AI reasoning → tool execution → state persistence
@tokenring-ai/agent (request) 
→ @tokenring-ai/ai-client (LLM reasoning) 
→ @tokenring-ai/filesystem + @tokenring-ai/database (tool execution) 
→ @tokenring-ai/checkpoint (state persistence)
```

### Search Integration Flow
```typescript
// Web search → content processing → agent context
@tokenring-ai/websearch (with @tokenring-ai/serper/@tokenring-ai/scraperapi) 
→ @tokenring-ai/agent (processes results) 
→ @tokenring-ai/memory (stores in context)
```

## Full-Stack Development Patterns

### 1. Plugin-Based Architecture Pattern
- **Modular Integration**: Each package is a self-contained plugin
- **Service Registration**: Clear service contracts and dependency injection
- **Tool Registration**: Standardized tool interfaces with Zod validation
- **Command Integration**: Slash command pattern with help system

### 2. Agent-Centric Orchestration Pattern
- **Central Hub**: @tokenring-ai/agent manages all tools, commands, and services
- **Specialized Agents**: Different agents for different aspects of full-stack development
- **Context Injection**: Agents receive context from memories, filesystems, databases
- **Multi-Agent Coordination**: Agents work together on complex full-stack features

### 3. Real-Time Communication Pattern
- **WebSocket API**: Real-time bidirectional agent communication
- **React Context**: Service access and state management across components
- **Event-Driven**: Agent events and responses flow through WebSocket to frontend
- **Structured Protocol**: JSON-based message protocol for agent communication

### 4. Provider Abstraction Pattern
- **Database Abstraction**: DatabaseProvider interface enables multiple DB backends
- **Filesystem Abstraction**: FileSystemProvider for local, S3, and other storage
- **AI Provider Abstraction**: Multi-provider AI client with unified interface
- **Service Provider Pattern**: Abstract interfaces with concrete implementations

### 5. Context Injection Pattern
- **Multiple Context Sources**: Memory, filesystem, database, web search, etc.
- **Context Handlers**: Available databases handler shows available resources
- **Context Compaction**: Automatic summarization when conversations grow long
- **Persistent Context**: Checkpoint system maintains context across sessions

## Context Injection Approaches

### Approach 1: Registry-Based Context Providers
```typescript
interface ContextProvider {
  name: string;
  priority: number;
  position: "system" | "prior" | "current";
  enabled: boolean;
  getContext(agent: Agent): Promise<ContextItem[]>;
  estimateTokens?(agent: Agent): Promise<number>;
}

// Usage
const contextRegistry = agent.requireServiceByType(ContextRegistry);
contextRegistry.register({
  name: "rag/semantic-search",
  priority: 5,
  position: "prior",
  enabled: true,
  getContext: async (agent) => {
    // RAG implementation
  }
});
```

### Approach 2: Pipeline-Based Context Assembly
```typescript
const pipeline = new ContextPipelineBuilder()
  .collect(new SystemPromptCollector())
  .collect(new PriorMessagesCollector())
  .collect(new RAGCollector(vectorDB))
  .enrich(new RelevanceScorer())
  .filter(new DuplicateFilter())
  .filter(new TokenBudgetFilter(maxTokens: 100000))
  .transform(new MessageFormatter())
  .validate(new TokenLimitValidator())
  .build();
```

### Approach 3: Declarative Context Configuration
```typescript
const contextQuery: ContextQuery = {
  sources: [
    { type: "system-prompt" },
    { type: "conversation-history", params: { last: 10 } },
    { 
      type: "rag", 
      selector: "semantic-search",
      params: { limit: 5, threshold: 0.7 }
    }
  ],
  constraints: {
    maxTokens: 100000,
    deduplicate: true
  }
};
```

## Frontend-Backend Integration Examples

### Complete Feature Implementation
```typescript
// Full-stack feature implementation
const agent = await team.createAgent('fullstack-developer');
await agent.handleInput({
  message: `Implement user authentication with:
  - React frontend with login/register forms
  - Node.js/Express backend with JWT authentication
  - MySQL database with user table
  - Protected routes and middleware
  - Integration tests for all components`
});
```

### Database Integration
```typescript
// Database operations
const dbService = agent.requireService(DatabaseService);
await dbService.registerDatabase('users', new MySQLProvider({
  connectionString: process.env.DB_URL
}));

// Agent can now use: database/executeSql tool
```

### Real-time Communication
```typescript
// WebSocket agent communication
const socket = new WebSocket('ws://localhost:3000/agent');
socket.onmessage = (event) => {
  const response = JSON.parse(event.data);
  // Handle agent response in real-time
};
```

## Key Integration Technologies

### AI & Language Models
- **Vercel AI SDK**: Core AI integration layer
- **Multiple Providers**: OpenAI, Anthropic, Google, Groq, Cerebras, DeepSeek, xAI
- **Model Selection**: Automatic capability-based selection
- **Cost Tracking**: Detailed usage analytics and cost calculation

### Real-time Communication
- **WebSocket**: Real-time agent communication
- **React Context**: State management across components
- **Event-Driven**: Agent event propagation

### Storage & Database
- **Multiple Backends**: SQLite, MySQL, PostgreSQL via Drizzle ORM
- **Abstract Layer**: Provider pattern for database integration
- **Checkpoint System**: Agent state persistence across sessions
- **Queue System**: Task batching with checkpoint preservation

## Development Integration Patterns

### Testing Integration
- **Auto-Repair**: Testing service with automatic fix capabilities
- **Git Integration**: Auto-commit on test success
- **Code Quality**: ESLint integration with auto-fix

### File System Integration
- **Abstract Operations**: Read/write/search/patch operations
- **Multiple Backends**: Local filesystem, S3, cloud storage
- **Watching**: File change detection and agent triggering
- **Ignore Patterns**: Gitignore-compatible filtering

## Communication Platform Integration

### Multi-Platform Support
- **Slack Integration**: Bot functionality and workspace management
- **Telegram Integration**: Chat management and messaging
- **WebSocket API**: Browser client integration
- **Human Feedback**: File reviews and UI component previews

## Cloud & Infrastructure Integration

### Container & Cloud Services
- **Docker Integration**: Container management and sandbox execution
- **AWS Integration**: STS/S3 clients with authentication
- **Kubernetes**: Resource discovery and management
- **Sandbox Environment**: Isolated execution for security

## Advanced Integration Patterns

### MCP Protocol Integration
- **Model Context Protocol**: External server connectivity
- **Tool Registration**: Automatic tool registration from MCP servers
- **Resource Access**: Dynamic resource access through protocol

### Audio Processing Pipeline
- **Abstract Audio Framework**: Platform-independent audio operations
- **Linux Implementation**: naudiodon2 for recording/playback
- **Speech Integration**: Text-to-speech and transcription workflows

### Multi-Database Support
- **Drizzle ORM**: SQLite, MySQL, PostgreSQL integration
- **Migration Management**: Schema versioning and migration
- **Connection Pooling**: Efficient database connection management

## Specialized Agent Patterns

### Frontend Engineer Agent
```typescript
{
  name: "Frontend Engineer",
  description: "Implement user interfaces, interactive components...",
  focus: "React/Vue components, responsive layouts, state management",
  tools: ["@tokenring-ai/filesystem/*"],
  context: {
    initial: [
      {type: "task-plan"},
      {type: "tool-context"},
      {type: "search-files"},
      {type: "selected-files"},
      {type: "current-message"},
    ]
  }
}
```

### Integration Engineer Agent
```typescript
{
  name: "Integration Engineer",
  description: "Implement third-party integrations, APIs, webhooks...",
  focus: "OAuth flows, webhook handlers, API clients, data sync",
  tools: ["@tokenring-ai/websearch/*", "@tokenring-ai/filesystem/*"],
  context: {
    initial: [
      {type: "task-plan"},
      {type: "tool-context"},
      {type: "search-files"},
      {type: "selected-files"},
      {type: "current-message"},
    ]
  }
}
```

### Documentation Engineer Agent
```typescript
{
  name: "Documentation Engineer",
  description: "Create comprehensive technical documentation...",
  focus: "Code documentation, API references, tutorials",
  tools: ["@tokenring-ai/filesystem/*"],
  context: {
    initial: [
      {type: "task-plan"},
      {type: "tool-context"},
      {type: "search-files"},
      {type: "selected-files"},
      {type: "current-message"},
    ]
  }
}
```

## Full-Stack Development Workflow

### End-to-End Implementation Process
1. **Requirements Analysis**: Agent analyzes full-stack requirements
2. **Architecture Planning**: Agent designs system architecture
3. **Frontend Implementation**: React components, routing, state management
4. **Backend Implementation**: API endpoints, middleware, business logic
5. **Database Design**: Schema design, migrations, queries
6. **Integration**: Third-party APIs, webhooks, external services
7. **Testing**: Unit tests, integration tests, end-to-end tests
8. **Documentation**: API docs, user guides, deployment guides
9. **Deployment**: CI/CD pipeline setup, environment configuration

### Quality Assurance
- **Code Quality**: ESLint, TypeScript, automated code review
- **Testing**: Comprehensive test coverage with automatic repair
- **Security**: Input validation, authentication, authorization
- **Performance**: Optimization, caching, monitoring
- **Documentation**: Comprehensive docs with real examples

## Knowledge Repository Management

### Agent Knowledge Maintenance
```typescript
// Each agent maintains knowledge repositories
const agentKnowledge = {
  fullstack: {
    file: ".tokenring/knowledge/fullstack.md",
    focus: "Full-stack architecture, patterns, integrations"
  },
  frontend: {
    file: ".tokenring/knowledge/frontend.md", 
    focus: "UI components, state management, React patterns"
  },
  integrations: {
    file: ".tokenring/knowledge/integrations.md",
    focus: "API integrations, webhooks, external services"
  },
  documentation: {
    file: ".tokenring/knowledge/documentation.md",
    focus: "Documentation patterns, style guides, structures"
  }
};
```

## Focus Areas for Future Integration

1. **Enhanced Workflow Orchestration**: Multi-agent task coordination patterns
2. **Real-time Collaboration**: WebSocket-based multi-user workflows  
3. **Cloud-Native Integration**: Enhanced cloud service integrations
4. **Performance Optimization**: Caching and performance patterns
5. **Security Patterns**: Authentication and authorization workflows
6. **Monitoring & Observability**: Agent performance and system health patterns

## Lessons Learned

### Architecture Principles
- **Agent-Centric Design**: Central orchestrator pattern enables complex workflows
- **Plugin Architecture**: Modular design enables easy extension and testing
- **Provider Abstraction**: Interface-based design enables flexibility
- **Real-Time Communication**: WebSocket enables responsive user experience
- **Context Injection**: Rich context enables intelligent agent responses

### Implementation Best Practices
- **Type Safety**: TypeScript throughout prevents runtime errors
- **Service Registration**: Dependency injection enables loose coupling
- **Structured Protocols**: JSON-based protocols enable clear communication
- **State Management**: Checkpoint system enables persistence
- **Error Handling**: Comprehensive error handling enables robustness

### Developer Experience
- **Progressive Disclosure**: Multiple complexity levels serve different users
- **Real-Time Feedback**: WebSocket enables immediate response
- **Comprehensive Tools**: Rich tool set enables complex operations
- **Documentation**: Extensive docs enable quick onboarding
- **Testing**: Automated testing enables confident development

## TokenRing Integration Summary

The TokenRing AI monorepo demonstrates sophisticated full-stack development through:

1. **Agent-Centric Orchestration**: Central agent system coordinates all full-stack operations
2. **Plugin-Based Architecture**: Modular packages integrate through standard interfaces
3. **Real-Time Communication**: WebSocket enables responsive agent interaction
4. **Context Injection**: Multiple approaches enable intelligent context management
5. **Multi-Agent Coordination**: Specialized agents work together on complex features
6. **Provider Abstraction**: Database, filesystem, and AI providers enable flexibility
7. **Comprehensive Tooling**: Rich tool set enables complex full-stack operations
8. **Quality Assurance**: Testing, documentation, and code quality systems ensure reliability

This architecture enables developers to build complex full-stack applications through intelligent agent coordination, real-time communication, and comprehensive integration patterns. The system demonstrates how modern AI-powered development tools can successfully orchestrate frontend, backend, database, and external service integration through sophisticated agent-centric patterns.