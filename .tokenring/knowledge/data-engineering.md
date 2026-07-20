# Data Engineering Knowledge Repository

This file maintains knowledge about data migrations, ETL pipelines, and data processing systems in the TokenRing project.

## Discovered Data Systems

### Core Architecture

TokenRing AI follows a **modular, agent-centric data architecture** where data processing systems are exposed to AI agents through tools and services. The ecosystem is built around 50+ specialized packages with data engineering capabilities.

### Database Abstraction Layer

#### @tokenring-ai/database Package
- **Abstract Database Provider Pattern**: Provides `DatabaseProvider` base class for implementing database-specific functionality
- **Multi-Database Support**: Enables agents to work with multiple databases simultaneously through a registry system
- **Core Services**:
  - `DatabaseService`: Central manager for database providers with registration/retrieval
  - Tools: `database/executeSql`, `database/showSchema`
  - Context injection for available databases

#### Database Provider Interface

```typescript
interface DatabaseProviderOptions {
  allowWrites?: boolean;
}

interface ExecuteSqlResult {
  rows: Record<string, string | number | null>[];
  fields: string[];
}

abstract class DatabaseProvider {
  allowWrites: boolean;
  
  abstract async executeSql(sqlQuery: string): Promise<ExecuteSqlResult>;
  abstract async showSchema(): Promise<Record<string, string>>;
}
```

#### Database Service Implementation

```typescript
class DatabaseService implements TokenRingService {
  name = "DatabaseService";
  description = "Database service";
  databases = new KeyedRegistry<DatabaseProvider>();

  registerDatabase = this.databases.register;
  getDatabaseByName = this.databases.getItemByName;
  getAvailableDatabases = this.databases.getAllItemNames;
}
```

#### Database Provider Implementations

**@tokenring-ai/mysql**:
- **Connection Pooling**: Efficient connection management using `mysql2` with configurable limits
- **SQL Execution**: Execute raw SQL queries with proper result handling
- **Schema Inspection**: Retrieve CREATE TABLE statements for all database tables
- **Plugin Integration**: Automatically registers providers based on configuration

```typescript
class MySQLProvider extends DatabaseProvider {
  private pool!: Pool;
  
  async executeSql(sqlQuery: string): Promise<ExecuteSqlResult> {
    const connection = await this.pool.getConnection();
    const [rows, fields] = await connection.execute(sqlQuery);
    return {
      rows: rows as RowDataPacket[],
      fields: fields.map(f => f.name)
    };
  }
  
  async showSchema(): Promise<Record<string, string>> {
    const [tables] = await connection.execute('SHOW TABLES;');
    const schema: Record<string, string> = {};
    
    for (const tableRow of tables as RowDataPacket[]) {
      const tableName = Object.values(tableRow)[0];
      const [createTableRows] = await connection.execute(
        `SHOW CREATE TABLE \`${tableName}\`;`
      );
      schema[tableName] = createTableRows[0]['Create Table'];
    }
    return schema;
  }
}
```

**@tokenring-ai/drizzle-storage**:
- **Modern ORM**: Drizzle ORM for multi-database support (SQLite, MySQL, PostgreSQL)
- **Migration Management**: Automatic migration application on initialization
- **Type Safety**: Full TypeScript coverage with schema validation
- **Storage Integration**: Checkpoint provider implementation

```typescript
// Drizzle schema definition
export const agentState = mysqlTable("AgentState", {
  id: bigint("id", {mode: "number"}).primaryKey().autoincrement(),
  agentId: mysqlText("agentId").notNull(),
  name: mysqlText("name").notNull(),
  state: mysqlText("state").notNull(),
  createdAt: bigint("createdAt", {mode: "number"}).notNull(),
});

// Migration application
migrateMysql(db, {migrationsFolder: join(import.meta.dirname, "migrations")});
```

### Context Injection Architecture

TokenRing implements three distinct approaches for context management:

#### Approach 1: Registry-Based Context Providers
- **Centralized Registry**: Explicit provider registration system
- **Priority Management**: Provider prioritization with explicit positioning
- **Selective Enabling**: Enable/disable providers per agent
- **Token Estimation**: Providers can estimate token usage
- **Metadata Tracking**: Track source and relevance of context

```typescript
interface ContextProvider {
  name: string;
  priority: number;
  position: "system" | "prior" | "current";
  enabled: boolean;
  getContext(agent: Agent): Promise<ContextItem[]>;
  estimateTokens?(agent: Agent): Promise<number>;
}
```

#### Approach 2: Pipeline-Based Context Assembly
- **Multi-Stage Pipeline**: Context flows through processing stages
- **Composable Stages**: Mix and match processors for different scenarios
- **Observable Flow**: Track context transformation through pipeline
- **Flexible Configuration**: Dynamic pipeline assembly

```typescript
interface ContextPipeline {
  stages: ContextStage[];
  execute(input: ContextInput, agent: Agent): Promise<ContextOutput>;
}

interface ContextStage {
  name: string;
  process(context: ContextData, agent: Agent): Promise<ContextData>;
}
```

#### Approach 3: Declarative Context Configuration
- **Declarative Query Language**: Specify context requirements upfront
- **Source Resolution**: Automatic context gathering based on query
- **Constraint Application**: Apply constraints like maxTokens, deduplication
- **Transformation Pipeline**: Apply transformations to resolved context

```typescript
interface ContextQuery {
  sources: ContextSource[];
  constraints?: ContextConstraints;
  transformations?: ContextTransformation[];
}

interface ContextSource {
  type: string;
  selector?: string;
  params?: Record<string, any>;
  position?: "system" | "prior" | "current";
}
```

### State Management & Persistence

#### Checkpoint System (@tokenring-ai/checkpoint)
- **Agent State Persistence**: Complete agent state snapshots including tools, hooks, chat history, and custom state
- **Multi-Provider Architecture**: Pluggable storage backends (memory, database, file-based)
- **Interactive Management**: Tree-based UI for browsing and restoring checkpoints
- **Auto-Checkpointing**: Automatic checkpoint creation after agent operations
- **Commands**: `/checkpoint` and `/history` for checkpoint management

**Checkpoint Storage Interface:**
```typescript
interface AgentCheckpointProvider {
  storeCheckpoint(data: NamedAgentCheckpoint): Promise<string>;
  retrieveCheckpoint(id: string): Promise<StoredAgentCheckpoint | null>;
  listCheckpoints(): Promise<AgentCheckpointListItem[]>;
}

interface NamedAgentCheckpoint extends AgentCheckpointData {
  name: string;
}

interface StoredAgentCheckpoint extends NamedAgentCheckpoint {
  id: string;
}
```

**Checkpoint Management:**
```typescript
class AgentCheckpointService implements TokenRingService {
  async saveAgentCheckpoint(name: string, agent: Agent): Promise<string> {
    return await this.checkpointProviders.getActiveItem().storeCheckpoint({
      name,
      ...agent.generateCheckpoint(),
    });
  }
  
  async restoreAgentCheckpoint(id: string, agent: Agent): Promise<void> {
    const checkpoint = await this.checkpointProviders.getActiveItem().retrieveCheckpoint(id);
    agent.restoreState(checkpoint.state);
  }
}
```

#### Queue System (@tokenring-ai/queue)
- **FIFO Work Queue**: Sequential processing with optional size limits
- **State Preservation**: Integrates with checkpoint system for pause/resume functionality
- **Interactive Management**: `/queue` command for queue operations
- **Programmatic Tools**: `addTaskToQueue` for programmatic task enqueuing

**Queue Implementation:**
```typescript
class WorkQueueService implements TokenRingService {
  async enqueue(item: QueueItem, agent: Agent): boolean {
    return agent.mutateState(WorkQueueState, (state: WorkQueueState) => {
      if (this.maxSize && state.queue.length >= this.maxSize) {
        return false;
      }
      state.queue.push(item);
      return true;
    });
  }
  
  async dequeue(agent: Agent): QueueItem | undefined {
    return agent.mutateState(WorkQueueState, (state: WorkQueueState) => {
      return state.queue.shift();
    });
  }
}
```

**Queue Item Structure:**
```typescript
type QueueItem = {
  checkpoint: AgentCheckpointData;
  name: string;
  input: string;
};
```

### Codebase Management & Analysis

#### CodeBaseService Implementation
- **Multi-Resource Registry**: Manages different types of codebase resources
- **Language Detection**: Automatic language detection from file extensions
- **Code Parsing**: Uses code-chopper for parsing and chunking code
- **Repo Mapping**: Generates structured repo maps from code analysis

```typescript
class CodeBaseService implements TokenRingService {
  resourceRegistry = new KeyedRegistryWithMultipleSelection<FileMatchResource>();
  
  async generateRepoMap(
    files: Set<string>,
    fileSystem: FileSystemService,
    agent: Agent,
  ): Promise<string | null>
}
```

#### Supported Languages
- JavaScript/TypeScript (.js, .jsx, .ts, .tsx)
- Python (.py)
- C/C++ (.c, .cpp, .h, .hpp)
- Rust (.rs)
- Go (.go)
- Java (.java)
- Ruby (.rb)
- Bash/Shell (.sh, .bash)

### Storage Implementations

#### Browser Agent Storage (@tokenring-ai/browser-storage)
- **Client-Side Storage**: Uses localStorage for persistent agent state storage
- **Browser-Specific**: Designed for web applications requiring local persistence
- **Namespace Isolation**: Supports multiple agents with proper separation
- **Plugin Integration**: Seamless integration with TokenRing application framework
- **Storage Limitations**: ~5MB per origin, tied to specific browser session

#### Filesystem & Storage Abstraction

**@tokenring-ai/filesystem**:
- **Abstract Interface**: Unified API for file operations across different backends
- **Provider Pattern**: `FileSystemProvider` for implementing different storage backends
- **Agent Integration**: File selection, memory injection, and chat integration
- **Tools**: file_write, file_search, file_patch, shell_bash
- **Commands**: `/file`, `/foreach` for batch processing

**@tokenring-ai/local-filesystem**:
- **Root-scoped access**: All operations confined to base directories
- **Security boundaries**: Path validation to prevent directory traversal
- **File watching**: Real-time file monitoring with chokidar
- **Shell command execution**: Safe shell command execution with execa
- **Ignore filter support**: .gitignore and .aiignore pattern matching

```typescript
// Integration test pattern
describe("LocalFileSystemService Integration Tests", () => {
  it("should create, read, and delete a file", async () => {
    const filePath = "test.txt";
    const content = "Hello, World!";
    
    await service.writeFile(filePath, content);
    expect(await service.exists(filePath)).toBe(true);
    
    const readContent = await service.getFile(filePath);
    expect(readContent).toBe(content);
    
    await service.deleteFile(filePath);
    expect(await service.exists(filePath)).toBe(false);
  });
});
```

**@tokenring-ai/s3**:
- S3 as virtual filesystem through `S3FileSystemProvider`
- CDN functionality through `S3CDNProvider`
- AWS SDK integration with connection pooling
- Path normalization and directory simulation
- Upload/management capabilities for content delivery

### Data Processing Patterns

#### ETL and Pipeline Architecture
- **Context Injection Pipeline**: Multi-stage processing for context assembly
- **Data Flow Patterns**: Stage-based processors (collectors, enrichers, filters, transformers, validators)
- **RAG Integration**: Vector database integration for semantic search
- **Token Budget Management**: Automatic trimming and optimization

#### Batch Processing
- **Iterables System**: Named iterables for batch processing operations
- **Glob-based Processing**: Pattern matching for file processing
- **Workflow Orchestration**: Multi-agent task coordination through @tokenring-ai/tasks

### Web Scraping & Data Extraction

#### ScraperAPI Integration (@tokenring-ai/scraperapi)
- **Web Scraping Service**: Raw HTML extraction from arbitrary pages
- **Google SERP Integration**: Structured search result extraction
- **Google News Integration**: Structured news result extraction
- **Rate Limiting**: Built-in retry logic and backoff for 429/5xx responses
- **Multiple Output Formats**: JSON and CSV output support
- **Chat Commands**: `/scraper url`, `/scraper serp`, `/scraper news` for CLI interaction

### Data Validation & Type Safety

#### Schema Validation
- **Zod Integration**: Runtime type validation throughout the system
- **Database Schemas**: Type-safe database operations with Drizzle ORM
- **Configuration Validation**: Type-safe configuration loading
- **API Validation**: Input/output validation for all tools and services

#### Type Safety Patterns
- **TypeScript First**: Full type coverage across all data systems
- **Generic Providers**: Type-safe provider interfaces
- **Runtime Type Checking**: Validation at boundaries

### Integration Patterns

#### Agent Integration
- **Tool Registration**: All data operations exposed as agent tools
- **Service Registry**: Centralized service management and dependency injection
- **Context Awareness**: Data systems understand agent context and state

#### Cross-Package Integration
- **Registry Patterns**: Keyed registries for provider management
- **Plugin Architecture**: Seamless integration through TokenRingPlugin interface
- **Event-Driven**: EventEmitter-based communication between components

### Migration Strategies

#### Database Migrations
- **Codebase-First**: Schema defined in TypeScript, migrations generated
- **Multi-Database**: Same schema applied across SQLite, MySQL, PostgreSQL
- **Runtime Application**: Automatic migration application on initialization
- **Version Tracking**: Drizzle maintains migration history

**Drizzle Migration Example:**
```typescript
// drizzle.config.ts
export default defineConfig({
  schema: "./schema.ts",
  out: "./migrations",
  dialect: "mysql",
});

// Schema definition
export const agentState = mysqlTable("AgentState", {
  id: bigint("id", {mode: "number"}).primaryKey().autoincrement(),
  agentId: mysqlText("agentId").notNull(),
  name: mysqlText("name").notNull(),
  state: mysqlText("state").notNull(),
  createdAt: bigint("createdAt", {mode: "number"}).notNull(),
});

// Auto migration
migrateMysql(db, {migrationsFolder: join(import.meta.dirname, "migrations")});
```

#### Data Migration Tools
- **Schema Inspection**: Tools for analyzing existing database structures
- **Data Transformation**: ETL patterns for data migration workflows
- **Validation**: Schema validation during migration processes

### Performance & Scalability

#### Connection Management
- **Connection Pooling**: Efficient database connections (MySQL, PostgreSQL)
- **Resource Management**: Automatic cleanup and resource disposal
- **Batch Operations**: Optimized bulk data processing

**MySQL Connection Pooling:**
```typescript
class MySQLProvider extends DatabaseProvider {
  private pool!: Pool;
  
  constructor(props: MySQLResourceProps) {
    this.pool = createPool({
      host: props.host,
      port: props.port,
      user: props.user,
      password: props.password,
      database: props.databaseName,
      waitForConnections: true,
      connectionLimit: props.connectionLimit ?? 10,
      queueLimit: 0
    });
  }
}
```

#### Storage Optimization
- **Caching**: In-memory caching for frequently accessed data
- **Lazy Loading**: On-demand resource loading
- **Compression**: Efficient storage patterns

### Security & Compliance

#### Access Control
- **Root Scoping**: All filesystem operations confined to base directories
- **Database Permissions**: Provider-level read/write permission control
- **Credential Management**: Secure credential handling and storage

#### Data Safety
- **Atomic Operations**: Transaction-safe database operations
- **Backup Integration**: Checkpoint-based backup and recovery
- **Audit Trails**: Complete operation logging through checkpoint system

### Docker Integration

#### Container Management
- **Docker Service**: Integration with Docker daemon for container operations
- **TLS Configuration**: Secure Docker communication with TLS certificates
- **Timeout Management**: Configurable timeout handling for container operations
- **Host Configuration**: Support for custom Docker hosts

```typescript
interface StartContainerResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  containers: string[];
}

// Docker command construction with TLS
let dockerCmd = "docker";
if (dockerService.getHost() !== "unix:///var/run/docker.sock") {
  dockerCmd += ` -H ${shellEscape(dockerService.getHost())}`;
}
```

### Testing Infrastructure

#### Integration Testing
- **Database Integration Tests**: Full database lifecycle testing with real containers
- **Filesystem Integration Tests**: Comprehensive file operation testing
- **Mock Registry Patterns**: Service dependency mocking for unit testing
- **Error Scenario Testing**: Comprehensive error handling validation

#### Test Patterns
```typescript
describe("Integration Flow Tests", () => {
  it("should handle the complete success flow", async () => {
    const mockResult = {
      ok: true,
      exitCode: 0,
      stdout: "integration test output",
      stderr: "",
    };
    
    mockExecuteCommand.mockResolvedValue(mockResult);
    
    const result = await execute({
      command: "git status",
      projectDirectory: "src",
    }, registry);
    
    expect(result).toEqual(mockResult);
  });
  
  it("should handle timeout scenarios", async () => {
    // Test timeout handling
  });
  
  it("should handle error scenarios gracefully", async () => {
    // Test error handling
  });
});
```

### Agent Context Handlers

#### Available Databases Context
```typescript
export default async function* getContextItems(
  input: string, 
  chatConfig: ChatConfig, 
  params: {}, 
  agent: Agent
): AsyncGenerator<ContextItem> {
  const databaseService = agent.requireServiceByType(DatabaseService);
  const available = databaseService['databases'].getAllItemNames();
  
  if (available.length === 0) return;
  
  yield {
    role: "user",
    content: "/* These are the databases available for the database tool */:\n" +
      available.map((name) => `- ${name}`).join("\n"),
  };
}
```

#### Available Agents Context
```typescript
export default async function* getContextItems(
  input: string, 
  chatConfig: ChatConfig, 
  params: {}, 
  agent: Agent
): AsyncGenerator<ContextItem> {
  const agentManager = agent.requireServiceByType(AgentManager);
  const agentTypes = agentManager.getAgentConfigs();
  
  yield {
    role: "user",
    content: '/* The following agents are available for use with agent & task planning tools */\n' +
      Object.entries(agentTypes)
        .filter(([name, config]) => config.callable)
        .map(([name, config]) => `- ${name}: ${config.description}`)
        .join("\n"),
  };
}
```

### Database Tools

#### Execute SQL Tool
```typescript
const name = "database/executeSql";

async function execute(
  {databaseName, sqlQuery}: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<string | object> {
  const databaseService = agent.requireServiceByType(DatabaseService);
  const databaseResource = databaseService.getDatabaseByName(databaseName);
  
  if (!sqlQuery.trim().startsWith("SELECT")) {
    const approved = await agent.askHuman({
      type: "askForConfirmation",
      message: `Execute SQL write operation on database '${databaseName}'?\n\nQuery: ${sqlQuery}`,
    });
    
    if (!approved) {
      throw new Error("User did not approve the SQL query that was provided.");
    }
  }
  
  return databaseResource.executeSql(sqlQuery);
}
```

#### Show Schema Tool
```typescript
const name = "database/showSchema";

async function execute(
  {databaseName}: z.infer<typeof inputSchema>,
  agent: Agent
): Promise<Record<string, any> | string> {
  const databaseService = agent.requireServiceByType(DatabaseService);
  const databaseResource = databaseService.getDatabaseByName(databaseName);
  
  return databaseResource.showSchema();
}
```

### Best Practices Discovered

1. **Provider Pattern**: Consistent abstraction layer for all data systems
2. **Type Safety**: Full TypeScript coverage with runtime validation
3. **Plugin Architecture**: Seamless integration through standardized interfaces
4. **State Management**: Comprehensive state persistence and recovery
5. **Error Handling**: Graceful degradation and detailed error reporting
6. **Testing**: Comprehensive test coverage with real database containers
7. **Documentation**: Detailed documentation with usage examples
8. **Configuration**: Type-safe configuration with validation
9. **Browser Integration**: Client-side storage for web applications
10. **Web Data Extraction**: Comprehensive web scraping and search capabilities

### Key Design Principles

1. **Modularity**: Each package is self-contained with clear interfaces
2. **Agent-Centric**: All functionality exposed through agent tools and commands
3. **Pluggable**: Services can be swapped (different AI providers, databases)
4. **Type-Safe**: Full TypeScript with Zod validation
5. **Event-Driven**: EventEmitter-based communication between components
6. **Registry-Based**: Centralized service and context provider management
7. **Pipeline-Oriented**: Multi-stage processing for context and data flows
8. **Browser-Ready**: Full client-side storage and processing capabilities

### Cross-Platform Data Solutions

#### Desktop Applications
- Local filesystem with full security boundaries
- SQLite for lightweight database needs
- Complete tool integration for development workflows

#### Web Applications
- Browser-based storage with localStorage
- Client-side data processing
- Web scraping and search capabilities

#### Cloud-Native
- S3 storage and CDN integration
- MySQL and PostgreSQL for production databases
- AWS service integration

### Data Engineering Workflows

1. **Development Workflow**:
   - Local filesystem → SQLite storage → checkpointing
   - Git integration → testing → auto-commit workflows

2. **Content Creation Workflow**:
   - Web scraping → content extraction → AI processing
   - Multi-agent coordination → publishing workflows

3. **Research Workflow**:
   - Web search → data extraction → analysis
   - Multiple database sources → ETL processing

4. **Analytics Workflow**:
   - Data collection → checkpoint tracking → performance metrics
   - Multiple storage backends → unified querying

### Specialized Agent Roles

#### Database Designer Agent
- Schema design and normalization
- Query optimization and indexing
- Migration strategy and implementation
- Performance tuning and monitoring

#### Documentation Engineer Agent
- Technical documentation creation
- API reference generation
- Tutorial and guide writing
- Documentation architecture planning

#### System Architect Agent
- System design and technology selection
- Architecture planning and evaluation
- Infrastructure design and scaling
- Technical strategy and roadmap

### Migration and Versioning

#### Package Migration Patterns
```typescript
// Migration from v0.x to v1.x
export default {
  name: packageJSON.name,
  version: packageJSON.version,
  install(app: TokenRingApp) {
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(chatCommands)
    );
    app.waitForService(AgentLifecycleService, lifecycleService =>
      lifecycleService.addHooks(packageJSON.name, hooks)
    );
    app.addServices(new AgentCheckpointService());
  },
  start(app: TokenRingApp) {
    const config = app.getConfigSlice("checkpoint", CheckpointPackageConfigSchema);
    app.requireService(AgentCheckpointService).setActiveProviderName(config.defaultProvider);
  }
} satisfies TokenRingPlugin;
```

This knowledge repository will be updated as new data engineering patterns and systems are discovered in the TokenRing ecosystem.