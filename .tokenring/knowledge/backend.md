# Backend Knowledge Repository

This file maintains knowledge about backend systems, business logic, and server-side functionality in the TokenRing project.

## Discovered Backend Systems

### Project Overview
- **Project**: TokenRing AI - Multi-agent orchestration platform
- **Architecture**: Server-side business logic supporting AI agent workflows
- **Key Backend Packages**: 
  - @tokenring-ai/agent - Core agent orchestration
  - @tokenring-ai/database - Database service layer
  - @tokenring-ai/mysql - MySQL-specific implementations
  - @tokenring-ai/queue - Task queue management
  - @tokenring-ai/checkpoint - Persistence and state management
  - @tokenring-ai/tasks - Task planning and execution
  - @tokenring-ai/utility - Shared utilities
  - @tokenring-ai/app - Base application framework
  - @tokenring-ai/ai-client - Multi-provider AI integration
  - @tokenring-ai/chat - Chat interface management
  - @tokenring-ai/filesystem - Filesystem abstraction
  - @tokenring-ai/memory - Short-term memory management
  - @tokenring-ai/drizzle-storage - Multi-database ORM storage
  - @tokenring-ai/web-host - Bun-based web server (replaced Fastify)

## Backend Architecture Patterns

### 1. Agent-Centric Service Layer
- **Pattern**: Central orchestrator with pluggable services
- **Implementation**: Agent team manages services via registries
- **Integration**: Services automatically register tools/commands with agents
- **Benefits**: Loose coupling, modularity, easy extension

**Core Implementation**:
```typescript
// AgentTeam as central orchestrator
class AgentTeam {
  // Shared registries
  packages: KeyedRegistry<TokenRingPackage>
  services: KeyedRegistry<TokenRingService>
  chatCommands: KeyedRegistry<TokenRingChatCommand>
  tools: KeyedRegistry<TokenRingToolDefinition>
  hooks: KeyedRegistry<HookConfig>
  
  // Service management
  addPackages(packages: TokenRingPackage[]): void
  requireServiceByType<T>(serviceType: abstract new (...args: any[]) => T): T
}
```

### 2. Plugin-Based Architecture
- **Pattern**: Self-contained packages with plugin exports
- **Structure**: Each package exports `TokenRingPlugin` with tools/commands/services
- **Registration**: Automatic integration via `agentTeam.registerPackages()`
- **Configuration**: Schema-based config validation and provider selection

**Plugin Interface**:
```typescript
interface TokenRingPlugin {
  name: string;
  version: string;
  description: string;
  install?(app: TokenRingApp): void; // Synchronous setup
  start?(app: TokenRingApp): Promise<void> | void; // Async initialization
}
```

### 3. Event-Driven Communication
- **Pattern**: EventEmitter-based inter-component communication
- **Hooks**: Lifecycle hooks for extending agent behavior
- **State Management**: Immutable state mutations with `agent.mutateState()`
- **Context Injection**: Dynamic context generation for agent awareness

**Event System**:
```typescript
// Agent events
interface AgentEventEnvelope {
  type: 'output.chat' | 'output.system' | 'state.busy' | 'human.request'
  data: any
}

// Event streaming
agent.events(signal: AbortSignal): AsyncGenerator<AgentEventEnvelope>
```

### 4. Service Registry Pattern
- **Pattern**: Centralized service registry with dependency injection
- **Implementation**: KeyedRegistry with type-safe service retrieval
- **Lifecycle**: Start/stop methods for service lifecycle management
- **Integration**: Automatic service attachment to agents

**Service Interface**:
```typescript
interface TokenRingService {
  name: string;
  description: string;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  attach?(agent: Agent): Promise<void> | void;
  detach?(agent: Agent): Promise<void> | void;
  getContextItems?(agent: Agent): AsyncGenerator<ContextItem>;
}
```

### 5. Multi-Provider Abstraction
- **Pattern**: Provider registry with intelligent selection
- **Implementation**: Abstract interfaces with multiple concrete implementations
- **Selection**: Capability-based provider selection
- **Fallback**: Automatic fallback mechanisms

**Provider Interface**:
```typescript
interface AIProvider {
  getChatClient(modelName: string): Promise<ChatClient>;
  getImageGenerationClient(modelName: string): Promise<ImageGenerationClient>;
  getCapabilities(): ModelCapabilities;
  getPricing(): ProviderPricing;
}

class ModelRegistry {
  private providers = new Map<string, AIProvider>();
  
  async getFirstOnlineClientByRequirements(requirements: ModelRequirements) {
    // Intelligent provider selection based on capabilities, cost, and availability
  }
}
```

## Core Backend Services

### 1. Web Host Service (@tokenring-ai/web-host) - Bun Server

**Architecture Pattern**: Bun Native Web Server with Router Abstraction

**Service Implementation**:
```typescript
class WebHostService implements TokenRingService {
  readonly name = "WebHostService";
  description = "Bun web host for serving resources and APIs";

  private router = new Router();
  private server: any;
  
  resources = new KeyedRegistry<WebResource>();
  registerResource = this.resources.register;

  async start(signal: AbortSignal) {
    // Register authentication if configured
    if (this.config.auth) {
      registerAuth(this.router, this.config.auth);
    }

    // Register all resources
    for (const resource of this.resources.getAllItemValues()) {
      await resource.register(this.router);
    }

    // Build Bun.serve fetch handler
    const fetchHandler = this.buildFetchHandler();
    
    // Build WebSocket handlers
    const websocketHandlers = this.buildWebSocketHandlers();

    // Start Bun server
    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      fetch: fetchHandler,
      websocket: websocketHandlers
    });

    this.app.serviceOutput(this, `Web Host listening at ${this.getURL()}`);
  }

  async stop() {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }
}
```

**Router Interface**:
```typescript
interface BunRouter {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  ws(path: string, handler: WebSocketHandler): void;
  static(prefix: string, root: string, options?: StaticOptions): void;
  fallback(handler: RouteHandler): void;
}
```

**Resource Pattern**:
```typescript
interface WebResource {
  register(router: BunRouter): Promise<void>;
}

class JsonRpcResource implements WebResource {
  async register(router: BunRouter): Promise<void> {
    router.post(this.jsonRpcEndpoint.path, async (request, response) => {
      const body = await request.json();
      // Handle JSON-RPC request
      return response.json({jsonrpc: "2.0", id, result});
    });
  }
}
```

**WebSocket Support**:
```typescript
router.ws(path, {
  open(ws: BunWebSocket) {
    // WebSocket opened
  },
  close(ws: BunWebSocket) {
    // WebSocket closed
  },
  message(ws: BunWebSocket, message: string | Buffer) {
    // Message received
    ws.send(JSON.stringify({response: "data"}));
  }
});
```

**Authentication**:
```typescript
// Auth check function
function checkAuth(request: BunRequest, config: ParsedAuthConfig): string | null {
  const auth = request.headers.get("authorization");
  
  if (auth?.startsWith("Bearer ")) {
    const token = auth.substring(7);
    // Validate token
  } else if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.substring(6), "base64").toString();
    // Validate credentials
  }
  
  return username;
}

// Usage in fetch handler
if (authConfig) {
  const username = checkAuth(bunRequest, authConfig);
  if (!username) {
    return unauthorizedResponse(bunResponse);
  }
}
```

**Key Features**:
- Native Bun.serve integration for optimal performance
- Router abstraction for resource-based routing
- WebSocket support via Bun's native WebSocket
- Static file serving with Bun.file()
- SPA routing support for single-page applications
- JSON-RPC 2.0 protocol support
- Basic and Bearer token authentication
- Type-safe request/response handling
- No external dependencies (removed Fastify, @fastify/websocket, @fastify/static, ws)

**Migration from Fastify to Bun**:
- Replaced `fastify` package with `Bun.serve`
- Replaced `@fastify/websocket` with Bun's native WebSocket
- Replaced `@fastify/static` with `Bun.file()` for static serving
- Replaced `ws` package with Bun's WebSocket implementation
- Converted FastifyInstance interface to BunRouter interface
- Updated all resource implementations to use new router pattern
- Simplified architecture with fewer dependencies

### 2. Database Service Layer (@tokenring-ai/database)

**Architecture Pattern**: Abstract Provider Pattern

**Service Implementation**:
```typescript
class DatabaseService implements TokenRingService {
  private databases = new KeyedRegistry<DatabaseProvider>()
  
  registerDatabase = this.databases.register
  getDatabaseByName = this.databases.getItemByName
  getAvailableDatabases(): string[]
  
  async getContextItems(agent: Agent): AsyncGenerator<ContextItem> {
    yield {
      type: 'database-info',
      content: `Available databases: ${this.getAvailableDatabases().join(', ')}`
    }
  }
}
```

**Abstract Provider Interface**:
```typescript
abstract class DatabaseProvider {
  abstract executeSql(sqlQuery: string): Promise<ExecuteSqlResult>
  abstract showSchema(): Promise<Record<string, string>>
}
```

**Key Features**:
- Multiple database provider registration
- Unified SQL execution interface
- Schema inspection capabilities
- Type-safe result handling
- Configuration-based provider setup
- Human confirmation for write operations

**Tool Integration**:
```typescript
const executeSql = new TokenRingTool({
  name: 'database/executeSql',
  inputSchema: z.object({
    databaseName: z.string().optional(),
    sqlQuery: z.string()
  }),
  execute: async (args, agent) => {
    const db = args.databaseName 
      ? databaseService.getDatabaseByName(args.databaseName)
      : databaseService.getAvailableDatabases()[0]
    
    const result = await db.executeSql(args.sqlQuery)
    return JSON.stringify(result, null, 2)
  }
})
```

### 3. MySQL Provider (@tokenring-ai/mysql)

**Architecture Pattern**: Concrete Implementation with Connection Pooling

**Provider Implementation**:
```typescript
class MySQLProvider extends DatabaseProvider {
  private pool: Pool
  
  constructor(props: MySQLResourceProps) {
    super({ allowWrites: props.allowWrites ?? false })
    this.pool = createPool({
      host: props.host,
      port: props.port ?? 3306,
      user: props.user,
      password: props.password,
      database: props.databaseName,
      waitForConnections: true,
      connectionLimit: props.connectionLimit ?? 10,
      queueLimit: 0
    })
  }
  
  async executeSql(sqlQuery: string): Promise<ExecuteSqlResult> {
    const [rows, fields] = await this.pool.execute(sqlQuery)
    return {
      rows: rows as RowDataPacket[],
      fields: fields.map(f => f.name)
    }
  }
  
  async showSchema(): Promise<Record<string, string>> {
    const schema: Record<string, string> = {}
    
    const [tables] = await this.pool.execute('SHOW TABLES;')
    for (const tableRow of tables as RowDataPacket[]) {
      const tableName = Object.values(tableRow)[0] as string
      const [createTableRows] = await this.pool.execute(
        `SHOW CREATE TABLE \`${tableName}\`;`
      )
      const createTable = createTableRows[0]['Create Table']
      schema[tableName] = createTable
    }
    return schema
  }
}
```

### 4. Queue Management System (@tokenring-ai/queue)

**Architecture Pattern**: FIFO Queue with State Preservation

**Service Implementation**:
```typescript
class WorkQueueService implements TokenRingService {
  maxSize?: number
  
  async attach(agent: Agent): Promise<void> {
    agent.initializeState(WorkQueueState, { maxSize: this.maxSize })
  }
  
  enqueue(item: QueueItem, agent: Agent): boolean {
    return agent.mutateState(WorkQueueState, state => {
      if (state.queue.length >= state.maxSize) return false
      state.queue.push(item)
      return true
    })
  }
  
  dequeue(agent: Agent): QueueItem | undefined {
    return agent.mutateState(WorkQueueState, state => {
      return state.queue.shift()
    })
  }
  
  startWork(agent: Agent): void {
    agent.mutateState(WorkQueueState, state => {
      state.isProcessing = true
      state.currentItem = null
    })
  }
}
```

**State Management**:
```typescript
class WorkQueueState implements StateSlice {
  name = 'WorkQueueState'
  queue: QueueItem[] = []
  isProcessing = false
  currentItem: QueueItem | null = null
  maxSize?: number
  
  serialize() { return this }
  deserialize(data: any) { Object.assign(this, data) }
  reset(what: ResetWhat[]) { /* Reset logic */ }
}
```

**Command Integration**:
```typescript
const queueCommand: TokenRingChatCommand = {
  description: '/queue <command> - Manage a queue of chat prompts',
  execute: async (remainder, agent) => {
    const [command, ...args] = remainder.split(' ')
    
    switch (command) {
      case 'add':
        return await addToQueue(args.join(' '), agent)
      case 'list':
        return await listQueue(agent)
      case 'start':
        return await startQueue(agent)
      // ... other commands
    }
  }
}
```

### 5. Checkpoint/Persistence System (@tokenring-ai/checkpoint)

**Architecture Pattern**: Provider-Based State Persistence

**Service Implementation**:
```typescript
class AgentCheckpointService implements TokenRingService {
  private providers = new KeyedRegistryWithSingleSelection<AgentCheckpointProvider>()
  private defaultProvider?: string
  
  async saveAgentCheckpoint(name: string, agent: Agent): Promise<string> {
    const provider = this.getActiveProvider()
    const checkpoint = agent.generateCheckpoint()
    const namedCheckpoint: NamedAgentCheckpoint = {
      ...checkpoint,
      name
    }
    return await provider.storeCheckpoint(namedCheckpoint)
  }
  
  async restoreAgentCheckpoint(id: string, agent: Agent): Promise<void> {
    const provider = this.getActiveProvider()
    const checkpoint = await provider.retrieveCheckpoint(id)
    if (checkpoint) {
      agent.restoreCheckpoint(checkpoint)
    }
  }
  
  async listCheckpoints(): Promise<AgentCheckpointListItem[]> {
    const provider = this.getActiveProvider()
    return await provider.listCheckpoints()
  }
}
```

**Provider Interface**:
```typescript
interface AgentCheckpointProvider {
  storeCheckpoint(data: NamedAgentCheckpoint): Promise<string>
  retrieveCheckpoint(id: string): Promise<StoredAgentCheckpoint | null>
  listCheckpoints(): Promise<AgentCheckpointListItem[]>
}
```

**Hook-Based Auto-Checkpointing**:
```typescript
const autoCheckpoint: HookConfig = {
  name: '@tokenring-ai/checkpoint/autoCheckpoint',
  description: 'Automatically creates checkpoints after agent input',
  async afterAgentInputComplete(agent: Agent, ...args) {
    const checkpointService = agent.requireServiceByType(AgentCheckpointService)
    const message = args[0]?.message || 'Auto-checkpoint'
    await checkpointService.saveAgentCheckpoint(message, agent)
  }
}
```

### 6. Task Planning & Execution (@tokenring-ai/tasks)

**Architecture Pattern**: Multi-Agent Workflow Orchestration

**Service Implementation**:
```typescript
class TaskService implements TokenRingService {
  addTask(task: Omit<Task, 'id' | 'status'>, agent: Agent): string {
    const taskWithId: Task = {
      ...task,
      id: generateId(),
      status: 'pending'
    }
    
    agent.mutateState(TaskState, state => {
      state.tasks.push(taskWithId)
    })
    
    return taskWithId.id
  }
  
  async executeTasks(taskIds: string[], agent: Agent): Promise<string[]> {
    const results: string[] = []
    
    for (const taskId of taskIds) {
      const task = this.getTaskById(taskId, agent)
      if (task.status === 'pending') {
        this.updateTaskStatus(taskId, 'running', undefined, agent)
        
        try {
          const result = await this.executeTask(task, agent)
          this.updateTaskStatus(taskId, 'completed', result, agent)
          results.push(result)
        } catch (error) {
          this.updateTaskStatus(taskId, 'failed', error.message, agent)
        }
      }
    }
    
    return results
  }
  
  private async executeTask(task: Task, agent: Agent): Promise<string> {
    const subAgent = await agent.createSubAgent(task.agentType)
    await subAgent.handleInput({ message: task.message })
    
    // Capture output
    const output = await new Promise<string>((resolve) => {
      subAgent.events().subscribe(event => {
        if (event.type === 'output.chat') {
          resolve(event.data.content)
        }
      })
    })
    
    await agentTeam.deleteAgent(subAgent)
    return output
  }
}
```

**Task Structure**:
```typescript
interface Task {
  id: string
  name: string
  agentType: string  // Specialized agent assignment
  message: string    // One paragraph description
  context: string    // Detailed execution instructions
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
}
```

### 7. Application Framework (@tokenring-ai/app)

**Architecture Pattern**: Base Application with Service Management

**Core Application**:
```typescript
class TokenRingApp {
  private services = new KeyedRegistry<TokenRingService>()
  private pluginManager: PluginManager
  private stateManager: StateManager
  
  constructor(config: any, defaultConfig?: any) {
    this.pluginManager = new PluginManager()
    this.stateManager = new StateManager()
  }
  
  requireService<T>(serviceType: abstract new (...args: any[]) => T): T {
    return this.services.getByType(serviceType)
  }
  
  addServices(...services: TokenRingService[]): void {
    for (const service of services) {
      this.services.register(service.name, service)
      if (service.start) {
        service.start()
      }
    }
  }
  
  getConfigSlice<T extends { parse: (any: any) => any }>(
    key: string, 
    schema: T
  ): z.infer<T> {
    const config = this.config[key]
    return schema.parse(config)
  }
}
```

### 8. AI Client Integration (@tokenring-ai/ai-client)

**Architecture Pattern**: Multi-Provider Abstraction with Intelligent Selection

**Provider Registry**:
```typescript
class ModelRegistry {
  private providers = new Map<string, AIProvider>()
  
  async getFirstOnlineClientByRequirements(requirements: ModelRequirements) {
    // Sort providers by cost, capabilities, and availability
    const sortedProviders = this.sortProvidersByRequirements(requirements)
    
    for (const provider of sortedProviders) {
      try {
        const client = await provider.getChatClient(requirements.modelName)
        if (await client.isAvailable()) {
          return client
        }
      } catch (error) {
        continue
      }
    }
    
    throw new Error('No available providers')
  }
  
  private sortProvidersByRequirements(requirements: ModelRequirements): AIProvider[] {
    // Sort by: cost optimization, capability match, availability
  }
}
```

**Unified Interface**:
```typescript
interface ChatClient {
  sendMessage(message: string): Promise<string>
  streamMessage(message: string): AsyncGenerator<string>
  getUsage(): ProviderUsage
}

interface ImageGenerationClient {
  generateImage(prompt: string): Promise<ImageResult>
  getCapabilities(): ImageCapabilities
}
```

### 9. Chat Management (@tokenring-ai/chat)

**Architecture Pattern**: Interface Management with Tool Integration

**Chat Service**:
```typescript
class ChatService implements TokenRingService {
  private activeTools = new Set<string>()
  private toolRegistry = new Map<string, TokenRingToolDefinition>()
  
  async handleInput(input: string, agent: Agent): Promise<void> {
    // Parse commands vs chat
    if (input.startsWith('/')) {
      await this.handleCommand(input, agent)
    } else {
      await this.handleChat(input, agent)
    }
  }
  
  private async handleChat(message: string, agent: Agent): Promise<void> {
    const context = await this.buildContext(agent)
    const response = await this.aiClient.generate(message, context)
    
    // Update agent state
    agent.addToHistory(message, response)
    
    // Emit output events
    agent.emit('output.chat', response)
  }
  
  async executeTool(toolName: string, args: any, agent: Agent): Promise<any> {
    const tool = this.toolRegistry.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`)
    }
    
    // Validate and execute
    const validatedArgs = tool.inputSchema.parse(args)
    return await tool.execute(validatedArgs, agent)
  }
}
```

### 10. Filesystem Abstraction (@tokenring-ai/filesystem)

**Architecture Pattern**: Provider Pattern with Virtual Filesystem

**File System Service**:
```typescript
class FileSystemService implements TokenRingService {
  private providers = new KeyedRegistryWithSingleSelection<FileSystemProvider>()
  
  async attach(agent: Agent): Promise<void> {
    agent.initializeState(FileSystemState, {
      selectedFiles: new Set(),
      dirty: false
    })
  }
  
  async writeFile(path: string, content: string | Buffer): Promise<boolean> {
    const provider = this.getActiveProvider()
    return await provider.writeFile(path, content)
  }
  
  async getDirectoryTree(path: string, options?: DirectoryTreeOptions) {
    const provider = this.getActiveProvider()
    async for (const item of provider.getDirectoryTree(path, options)) {
      yield item
    }
  }
  
  async glob(pattern: string, options?: GlobOptions): Promise<string[]> {
    const provider = this.getActiveProvider()
    return await provider.glob(pattern, options)
  }
}
```

**Tool Integration**:
```typescript
const fileModify = new TokenRingTool({
  name: 'file_write',
  inputSchema: z.object({
    path: z.string(),
    action: z.enum(['write', 'append', 'delete', 'rename', 'adjust']),
    content: z.string().optional(),
    permissions: z.string().optional(),
    toPath: z.string().optional()
  }),
  execute: async (args, agent) => {
    const fs = agent.requireServiceByType(FileSystemService)
    
    switch (args.action) {
      case 'write':
        return await fs.writeFile(args.path, args.content!)
      case 'append':
        return await fs.appendFile(args.path, args.content!)
      case 'delete':
        return await fs.deleteFile(args.path)
      case 'rename':
        return await fs.rename(args.path, args.toPath!)
      case 'adjust':
        return await fs.chmod(args.path, parseInt(args.permissions!, 8))
    }
  }
})
```

### 11. Memory Management (@tokenring-ai/memory)

**Architecture Pattern**: Session-Based Short-Term Memory

**Memory Service**:
```typescript
class ShortTermMemoryService implements TokenRingService {
  name = "ShortTermMemoryService"
  description = "Provides Short Term Memory functionality"
  
  async attach(agent: Agent): Promise<void> {
    agent.initializeState(MemoryState, { memories: [] })
  }
  
  addMemory(memory: string, agent: Agent): void {
    agent.mutateState(MemoryState, state => {
      state.memories.push(memory)
    })
  }
  
  async *getContextItems(agent: Agent): AsyncGenerator<ContextItem> {
    const state = agent.getState(MemoryState)
    
    for (const memory of state.memories) {
      yield {
        type: 'memory',
        content: `Memory: ${memory}`,
        priority: 'background'
      }
    }
  }
}
```

**State Management**:
```typescript
class MemoryState implements StateSlice {
  name = 'MemoryState'
  memories: string[] = []
  persistToSubAgents = true
  
  reset(what: ResetWhat[]): void {
    if (what.includes('memory') || what.includes('chat')) {
      this.memories = []
    }
  }
  
  serialize(): object {
    return { memories: this.memories }
  }
  
  deserialize(data: any): void {
    this.memories = data.memories || []
  }
}
```

### 12. Drizzle ORM Storage (@tokenring-ai/drizzle-storage)

**Architecture Pattern**: Multi-Database ORM with Type Safety

**Storage Factory**:
```typescript
function createSQLiteStorage(config: SQLiteConfig): AgentCheckpointProvider {
  return new DrizzleAgentStateStorage({
    dialect: 'sqlite',
    schema: agentStateSchema,
    migrations: sqliteMigrations,
    connection: {
      url: config.databasePath
    }
  })
}

function createMySQLStorage(config: MySQLConfig): AgentCheckpointProvider {
  return new DrizzleAgentStateStorage({
    dialect: 'mysql',
    schema: agentStateSchema,
    migrations: mysqlMigrations,
    connection: {
      url: config.connectionString,
      pool: { min: 0, max: 10 }
    }
  })
}
```

**ORM Integration**:
```typescript
class DrizzleAgentStateStorage implements AgentCheckpointProvider {
  constructor(private config: DrizzleConfig) {
    this.db = drizzle(config.connection, {
      schema: config.schema,
      migrations: config.migrations
    })
  }
  
  async storeCheckpoint(checkpoint: NamedAgentCheckpoint): Promise<string> {
    const [id] = await this.db.insert(agentStateTable).values({
      agentId: checkpoint.agentId,
      name: checkpoint.name,
      state: JSON.stringify(checkpoint.state),
      createdAt: checkpoint.createdAt
    }).returning({ id: agentStateTable.id })
    
    return id
  }
  
  async retrieveCheckpoint(id: string): Promise<StoredAgentCheckpoint | null> {
    const result = await this.db.select().from(agentStateTable)
      .where(eq(agentStateTable.id, id))
      .limit(1)
    
    return result[0] || null
  }
}
```

## Business Logic Implementation

### Business Logic Engineer Agent
**Specialization**: Complex workflow implementation and rules engines

**Core Capabilities**:
- Workflow engine implementation
- Business rules creation
- Approval system design
- Automation pipeline building
- Domain logic handling

**Implementation Pattern**:
```typescript
class BusinessLogicEngineerAgent {
  async processWorkflow(workflow: Workflow, context: any): Promise<any> {
    const rules = this.parseBusinessRules(workflow.rules)
    
    for (const rule of rules) {
      const result = await this.executeRule(rule, context)
      if (result.requiresApproval) {
        const approval = await this.requestApproval(result, context)
        if (!approval) {
          throw new Error('Workflow approval denied')
        }
      }
    }
    
    return this.compileResults(workflow.output)
  }
}
```

### Database Designer Agent
**Specialization**: Data modeling and storage architecture

**Core Capabilities**:
- Schema design and normalization
- Index strategy optimization
- Migration management
- Query performance optimization
- ORM configuration

**Implementation Pattern**:
```typescript
class DatabaseDesignerAgent {
  async designSchema(requirements: SchemaRequirements): Promise<DatabaseSchema> {
    const entities = this.identifyEntities(requirements)
    const relationships = this.mapRelationships(entities)
    const normalized = this.normalizeSchema(entities, relationships)
    const indexes = this.optimizeIndexes(normalized)
    
    return {
      tables: normalized,
      indexes: indexes,
      constraints: this.defineConstraints(normalized)
    }
  }
}
```

## Data Processing Patterns

### 1. Schema Inspection Pattern
```typescript
// MySQL implementation
async showSchema(): Promise<Record<string, string>> {
  const [tables] = await connection.execute('SHOW TABLES;')
  const schema: Record<string, string> = {}
  
  for (const tableRow of tables as RowDataPacket[]) {
    const tableName = Object.values(tableRow)[0] as string
    const [createTableRows] = await connection.execute(
      `SHOW CREATE TABLE \`${tableName}\`;`
    )
    schema[tableName] = createTableRows[0]['Create Table']
  }
  
  return schema
}
```

### 2. Connection Pooling Pattern
```typescript
// MySQL connection management
this.pool = createPool({
  host: host,
  port: port,
  user: user,
  password: password,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: connectionLimit,
  queueLimit: 0
})

// Usage with automatic cleanup
async executeQuery(sql: string): Promise<any> {
  const connection = await this.pool.getConnection()
  try {
    const [rows] = await connection.execute(sql)
    return rows
  } finally {
    connection.release()
  }
}
```

### 3. State Management Pattern
```typescript
// Agent state mutations with immutability
agent.mutateState(WorkQueueState, (state: WorkQueueState) => {
  state.queue.push(item)
  state.isProcessing = true
  return state
})

// Checkpoint generation and restoration
const checkpoint = agent.generateCheckpoint()
// ... later ...
agent.restoreCheckpoint(checkpoint)
```

### 4. Async Generator Pattern
```typescript
// Context item generation
async *getContextItems(agent: Agent): AsyncGenerator<ContextItem> {
  const memories = agent.getState(MemoryState).memories
  
  for (const memory of memories) {
    yield {
      type: 'memory',
      content: `Remember: ${memory}`,
      priority: 'background'
    }
  }
  
  const files = agent.getState(FileSystemState).selectedFiles
  for (const file of files) {
    yield {
      type: 'file',
      content: await fs.getFile(file),
      priority: 'high'
    }
  }
}
```

## Service Integration Patterns

### 1. Plugin Registration Pattern
```typescript
// Automatic service registration
const databasePlugin = new TokenRingPlugin({
  name: 'database',
  version: '0.1.0',
  description: 'Database service layer',
  install: (app: TokenRingApp) => {
    app.addServices(new DatabaseService())
  }
})

app.pluginManager.installPlugins([databasePlugin], app)
```

### 2. Context Injection Pattern
```typescript
// Dynamic context provision for agents
async getContextItems(agent: Agent): AsyncGenerator<ContextItem> {
  yield {
    type: 'database-info',
    content: `Available databases: ${this.getAvailableDatabases().join(', ')}`
  }
  
  yield {
    type: 'queue-status',
    content: `Queue size: ${this.size(agent)}, processing: ${this.started(agent)}`
  }
}
```

### 3. Tool Integration Pattern
```typescript
// Schema-based tool definition with validation
const executeSql = new TokenRingTool({
  name: 'database/executeSql',
  description: 'Execute SQL query on database',
  inputSchema: z.object({
    databaseName: z.string().optional(),
    sqlQuery: z.string()
  }),
  execute: async (args, agent) => {
    // Validation is automatic via Zod
    const db = args.databaseName 
      ? databaseService.getDatabaseByName(args.databaseName)
      : databaseService.getDefaultDatabase()
    
    const result = await db.executeSql(args.sqlQuery)
    return JSON.stringify(result, null, 2)
  }
})
```

### 4. Global Function Registration Pattern
```typescript
// Scripting system integration
class ScriptingIntegration {
  static registerGlobalFunctions(agent: Agent) {
    const memoryService = agent.requireServiceByType(ShortTermMemoryService)
    
    agent.registerGlobalFunction('addMemory', (memory: string) => {
      memoryService.addMemory(memory, agent)
      return `Added memory: ${memory.substring(0, 50)}...`
    })
    
    const fs = agent.requireServiceByType(FileSystemService)
    agent.registerGlobalFunction('createFile', (path: string, content: string) => {
      return fs.writeFile(path, content)
    })
  }
}
```

## Middleware Patterns

### 1. Hook-Based Middleware
```typescript
// Auto-checkpointing middleware
const autoCheckpoint: HookConfig = {
  name: 'autoCheckpoint',
  description: 'Automatic checkpoint creation',
  async afterAgentInputComplete(agent: Agent, input) {
    const checkpointService = agent.requireServiceByType(AgentCheckpointService)
    await checkpointService.saveAgentCheckpoint(
      input.message, 
      agent
    )
  }
}
```

### 2. Validation Middleware
```typescript
// Input validation with Zod schemas
const validateInput = (schema: z.ZodSchema) => (input: any) => {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new ValidationError(result.error)
  }
  return result.data
}
```

### 3. Error Handling Middleware
```typescript
// Comprehensive error handling
const withErrorHandling = (operation: () => Promise<any>) => {
  return async () => {
    try {
      return await operation()
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(`Validation failed: ${error.message}`)
      } else if (error instanceof DatabaseError) {
        throw new Error(`Database error: ${error.message}`)
      } else {
        throw new Error(`Operation failed: ${error.message}`)
      }
    }
  }
}
```

## Workflow Management

### 1. Sequential Task Processing
```typescript
// Queue-based workflow with state preservation
const processWorkflow = async (agent: Agent) => {
  queueService.startWork(agent)
  
  while (!queueService.isEmpty(agent)) {
    const item = queueService.dequeue(agent)
    queueService.setCurrentItem(item, agent)
    
    try {
      await agent.handleInput(item.input)
      queueService.setCurrentItem(null, agent)
    } catch (error) {
      agent.errorMessage(`Failed to process item: ${error.message}`)
      // Restore to checkpoint if needed
      const checkpoint = queueService.getInitialCheckpoint(agent)
      if (checkpoint) {
        await agent.restoreCheckpoint(checkpoint)
      }
    }
  }
  
  queueService.stopWork(agent)
}
```

### 2. Multi-Agent Coordination
```typescript
// Task dispatch to specialized agents
const executeTask = async (task: Task, parentAgent: Agent) => {
  const subAgent = await parentAgent.createSubAgent(task.agentType)
  
  try {
    await subAgent.handleInput({
      message: task.message,
      context: task.context
    })
    
    const output = await new Promise<string>((resolve) => {
      subAgent.events().subscribe(event => {
        if (event.type === 'output.chat') {
          resolve(event.data.content)
        }
      })
    })
    
    return output
  } finally {
    await agentTeam.deleteAgent(subAgent)
  }
}
```

### 3. Human-in-the-Loop Workflow
```typescript
// Human approval workflow
const requestApproval = async (task: Task, agent: Agent): Promise<boolean> => {
  const approval = await agent.askHuman({
    type: 'askForConfirmation',
    message: `Approve task: ${task.name}?\n\n${task.message}\n\n${task.context}`
  })
  
  return approval
}
```

## Performance & Scalability Patterns

### 1. Connection Pooling
- Efficient database connection management
- Configurable pool limits
- Automatic connection lifecycle

**MySQL Pool Configuration**:
```typescript
this.pool = createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.databaseName,
  waitForConnections: true,
  connectionLimit: config.connectionLimit || 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
})
```

### 2. Memory Management
- Bounded queue sizes
- Lazy loading of resources
- Garbage collection friendly patterns

**Queue Size Limiting**:
```typescript
class WorkQueueState {
  maxSize?: number
  
  enqueue(item: QueueItem): boolean {
    if (this.maxSize && this.queue.length >= this.maxSize) {
      return false // Queue full
    }
    this.queue.push(item)
    return true
  }
}
```

### 3. Async Processing
- Non-blocking operations
- Promise-based APIs
- Parallel task execution with limits

**Parallel Task Execution**:
```typescript
async executeTasks(taskIds: string[], agent: Agent, maxConcurrency: number = 3): Promise<string[]> {
  const chunks = this.chunkArray(taskIds, maxConcurrency)
  const results: string[] = []
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(id => this.executeTask(id, agent))
    )
    results.push(...chunkResults)
  }
  
  return results
}
```

### 4. Caching Patterns
```typescript
// Provider capability caching
class CapabilityCache {
  private cache = new Map<string, ModelCapabilities>()
  
  async getCapabilities(provider: AIProvider, modelName: string): Promise<ModelCapabilities> {
    const key = `${provider.name}:${modelName}`
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }
    
    const capabilities = await provider.getCapabilities(modelName)
    this.cache.set(key, capabilities)
    return capabilities
  }
}
```

## Error Handling Patterns

### 1. Graceful Degradation
```typescript
try {
  const result = await executeQuery(sql)
  return result
} catch (error) {
  agent.errorMessage(`Database error: ${error.message}`)
  return null // Return null instead of throwing
}
```

### 2. State Recovery
```typescript
// Checkpoint restoration on failure
try {
  await processWorkflow(agent)
} catch (error) {
  agent.errorMessage(`Workflow failed: ${error.message}`)
  
  // Restore to last known good state
  const lastCheckpoint = this.getLatestCheckpoint(agent)
  if (lastCheckpoint) {
    await agent.restoreCheckpoint(lastCheckpoint)
    agent.infoMessage('Restored to last checkpoint')
  }
}
```

### 3. Validation-First Design
```typescript
// Input validation before processing
const validateTask = (task: Task) => {
  if (!task.agentType || !task.message) {
    throw new Error('Invalid task: missing required fields')
  }
  
  if (!this.isValidAgentType(task.agentType)) {
    throw new Error(`Invalid agent type: ${task.agentType}`)
  }
}
```

### 4. Retry Mechanisms
```typescript
// Exponential backoff retry
async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw error
      }
      
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
```

## Best Practices Discovered

1. **Service Interfaces**: Always implement `TokenRingService` for consistency
2. **State Management**: Use `agent.mutateState()` for immutable state updates
3. **Error Handling**: Provide meaningful error messages and graceful degradation
4. **Configuration**: Support schema-based configuration validation
5. **Plugin Design**: Self-contained packages with clear exports
6. **Type Safety**: Full TypeScript coverage with proper interfaces
7. **Documentation**: Comprehensive README with usage examples
8. **Testing**: Unit tests for core functionality
9. **Provider Abstraction**: Abstract interfaces with multiple implementations
10. **Event-Driven Architecture**: Use events for loose coupling
11. **Native Runtime Features**: Leverage Bun's built-in capabilities when possible (e.g., Bun.serve, Bun.file)
12. **Dependency Minimization**: Reduce external dependencies by using runtime-native features

## Integration with AI Agents

### 1. Tool Integration
- Automatic tool registration with agents
- Schema validation for tool inputs
- Context-aware tool execution

**Tool Registration**:
```typescript
class ToolRegistry {
  private tools = new Map<string, TokenRingToolDefinition>()
  
  registerTool(tool: TokenRingToolDefinition) {
    this.tools.set(tool.name, tool)
  }
  
  async executeTool(name: string, args: any, agent: Agent): Promise<any> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }
    
    // Validate input against schema
    const validatedArgs = tool.inputSchema.parse(args)
    
    // Execute with agent context
    return await tool.execute(validatedArgs, agent)
  }
}
```

### 2. Command Integration
- Chat command system for interactive management
- Subcommand patterns for complex operations
- Help system integration

**Command Processing**:
```typescript
class CommandProcessor {
  async processCommand(input: string, agent: Agent): Promise<string> {
    const [command, ...args] = input.split(' ')
    
    switch (command) {
      case '/database':
        return await this.handleDatabaseCommand(args, agent)
      case '/queue':
        return await this.handleQueueCommand(args, agent)
      case '/checkpoint':
        return await this.handleCheckpointCommand(args, agent)
      case '/memory':
        return await this.handleMemoryCommand(args, agent)
      default:
        return 'Unknown command'
    }
  }
}
```

### 3. Service Discovery
- Dynamic service lookup via `agent.requireServiceByType()`
- Type-safe service retrieval
- Lazy service initialization

**Service Discovery**:
```typescript
class Agent {
  requireServiceByType<T>(serviceType: abstract new (...args: any[]) => T): T {
    const service = this.agentTeam.getServiceByType(serviceType)
    if (!service) {
      throw new Error(`Service not found: ${serviceType.name}`)
    }
    return service
  }
  
  getServiceByType<T>(serviceType: abstract new (...args: any[]) => T): T | undefined {
    return this.agentTeam.getServiceByType(serviceType)
  }
}
```

## Monitoring & Observability

### 1. Logging Patterns
```typescript
// Structured logging with different levels
agent.infoMessage(`Queue size: ${queueService.size(agent)}`)
agent.errorMessage(`Failed to process task: ${error.message}`)
agent.successLine(`Task completed successfully`)
agent.warningMessage(`Using deprecated feature`)
```

### 2. State Inspection
```typescript
// Debug state access
const state = agent.getState(WorkQueueState)
console.log(`Queue state: ${state.queue.length} items, processing: ${state.isProcessing}`)

// Checkpoint inspection
const checkpoints = await checkpointService.listCheckpoints()
console.log(`Available checkpoints: ${checkpoints.length}`)
```

### 3. Performance Tracking
```typescript
// Execution timing
const start = Date.now()
await processTask(task)
const duration = Date.now() - start
agent.infoMessage(`Task completed in ${duration}ms`)

// Memory usage tracking
const memoryUsage = process.memoryUsage()
agent.infoMessage(`Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`)

// Provider usage tracking
const usage = await aiClient.getUsage()
agent.infoMessage(`Tokens used: ${usage.totalTokens}, Cost: $${usage.totalCost}`)
```

### 4. Health Monitoring
```typescript
// Service health checks
class HealthChecker {
  async checkDatabaseHealth(db: DatabaseProvider): Promise<HealthStatus> {
    try {
      const start = Date.now()
      await db.executeSql('SELECT 1')
      const latency = Date.now() - start
      
      return {
        status: 'healthy',
        latency: latency,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      }
    }
  }
}
```

## Configuration Management

### 1. Schema-Based Configuration
```typescript
// Zod-based configuration validation
const DatabaseConfigSchema = z.object({
  host: z.string(),
  port: z.number().default(3306),
  user: z.string(),
  password: z.string(),
  databaseName: z.string(),
  connectionLimit: z.number().default(10),
  allowWrites: z.boolean().default(false)
})

const config = app.getConfigSlice('database', DatabaseConfigSchema)
```

### 2. Environment Variable Integration
```typescript
// Environment-based configuration
const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  databaseName: process.env.MYSQL_DATABASE,
  connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT) || 10
}
```

### 3. Runtime Configuration Updates
```typescript
// Dynamic configuration updates
class ConfigManager {
  updateConfig(key: string, value: any) {
    this.config[key] = value
    this.notifyConfigChange(key, value)
  }
  
  private notifyConfigChange(key: string, value: any) {
    // Notify affected services
    for (const service of this.services) {
      if (service.onConfigChange) {
        service.onConfigChange(key, value)
      }
    }
  }
}
```

### 4. Configuration Hot Reloading
```typescript
// Hot reload configuration
class ConfigWatcher {
  private configPath: string
  private watchHandle?: FSWatcher
  
  watch(configPath: string, callback: (config: any) => void) {
    this.configPath = configPath
    this.watchHandle = watch(configPath, () => {
      try {
        const newConfig = JSON.parse(readFileSync(configPath))
        callback(newConfig)
      } catch (error) {
        console.error('Failed to reload config:', error)
      }
    })
  }
  
  stop() {
    if (this.watchHandle) {
      this.watchHandle.close()
    }
  }
}
```

## Testing Patterns

### 1. Unit Testing
```typescript
// Service unit tests
describe('DatabaseService', () => {
  let service: DatabaseService
  let mockProvider: jest.Mocked<DatabaseProvider>
  
  beforeEach(() => {
    service = new DatabaseService()
    mockProvider = {
      executeSql: jest.fn(),
      showSchema: jest.fn()
    }
    service.registerDatabase('test', mockProvider)
  })
  
  it('should execute SQL queries', async () => {
    mockProvider.executeSql.mockResolvedValue({
      rows: [{ id: 1 }],
      fields: ['id']
    })
    
    const result = await service.getDatabaseByName('test').executeSql('SELECT 1')
    expect(result.rows).toEqual([{ id: 1 }])
  })
})
```

### 2. Integration Testing
```typescript
// Agent integration tests
describe('Agent Integration', () => {
  let agent: Agent
  let agentTeam: AgentTeam
  
  beforeEach(async () => {
    agentTeam = new AgentTeam()
    await agentTeam.addPackages([databasePlugin, memoryPlugin])
    agent = await agentTeam.createAgent('test-agent')
  })
  
  it('should handle tool execution', async () => {
    await agent.handleInput({ message: '/memory add test memory' })
    
    const memoryService = agent.requireServiceByType(ShortTermMemoryService)
    const memories = agent.getState(MemoryState).memories
    
    expect(memories).toContain('test memory')
  })
})
```

### 3. Mock Service Patterns
```typescript
// Mock services for testing
class MockDatabaseProvider extends DatabaseProvider {
  private queries: Array<{ sql: string, result: any }> = []
  
  async executeSql(sqlQuery: string): Promise<ExecuteSqlResult> {
    const match = this.queries.find(q => q.sql === sqlQuery)
    if (!match) {
      throw new Error(`Mock query not found: ${sqlQuery}`)
    }
    return match.result
  }
  
  addMockQuery(sql: string, result: ExecuteSqlResult) {
    this.queries.push({ sql, result })
  }
}
```

This knowledge repository will be continuously updated as new backend patterns and implementations are discovered in the TokenRing AI ecosystem.
