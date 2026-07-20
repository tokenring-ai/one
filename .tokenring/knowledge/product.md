# Product Knowledge Repository

This file maintains knowledge about product requirements, features, and enhancements in the TokenRing project.

## Discovered Product Information

### Project Overview
TokenRing AI is a monorepo centered on a single unified application:
1. **TokenRing One** - Unified AI assistant (merging the former TokenRing Coder coding assistant and TokenRing Writer content platform) for coding, content creation, research, publishing, and automation, built on a 50+-package ecosystem

The application shares the core @tokenring-ai/* package ecosystem with modular, pluggable architecture.

### Product Architecture Patterns

#### Shared Core Foundation
- **Monorepo Structure**: TypeScript monorepo using Bun as package manager
- **Agent-Centric Architecture**: @tokenring-ai/agent serves as central orchestrator
- **Modular Package System**: 45 specialized packages under @tokenring-ai/* scope
- **Service Registry Pattern**: Central service registration and dependency injection
- **Plugin Architecture**: Extensible tool and command systems

#### Cross-Package Interaction Model
```
AgentTeam (agent)
├── AI Calls (ai-client)
├── FS Ops (filesystem + local-filesystem/s3)
├── Memory/Queue (memory/queue)
├── Tools: git, testing, javascript, docker, websearch, chrome, kubernetes
├── Services: database (mysql), sandbox, aws, kubernetes, chrome, codewatch, codebase
└── UI: cli (inquirer-*) + feedback
```

#### Application Entry Points
The application follows a standard pattern:
- Entry point: `tokenring.ts` (run via `bun run tokenring`) with Commander CLI interface
- Configuration: `.tokenring/one-config.{mjs,cjs,js}`
- Service Registration: PluginManager installs packages dynamically
- UI Options: Support both Inquirer (CLI) and Ink (modern terminal) interfaces

### UX Design Principles

#### 1. Conversational Interface Pattern
- **Primary Interaction**: Natural language chat interface with AI agents
- **Command System**: `/` prefixed commands for advanced operations
- **Agent Specialization**: Different AI agents for different tasks (writer, editor, researcher, etc.)
- **Persistent Sessions**: SQLite-based history and state persistence

#### 2. Progressive Enhancement
- **Basic Usage**: Simple chat interface for immediate value
- **Advanced Features**: Command system for power users
- **Plugin System**: Extensible functionality through packages
- **Multi-Modal**: Support for text, audio, and visual interfaces

#### 3. Developer-Friendly Design
- **Local-First**: Secure local execution with optional cloud integrations
- **Transparent Configuration**: Clear config files with TypeScript schemas
- **Multiple Deployment Options**: Direct CLI, Docker, or web interface
- **Rich Tooling**: Built-in code intelligence, testing, and quality tools

### Feature Specification Strategies

#### 1. Agent-Based Feature Organization
Features are organized around specialized AI agents:
- **Product Design Engineer**: Product enhancement and PRD creation
- **Performance Engineer**: Scalability and optimization
- **UI/UX Designer**: User interface and experience design
- **Code Quality Engineer**: Code reviews and quality standards

#### 2. Package-Based Feature Modules
- **Core Foundation**: Agent, AI client, utility, filesystem, memory, queue
- **Storage & Database**: Abstract database layer with multiple provider support
- **Development Tools**: Testing, git, javascript tooling, code intelligence, codebase
- **Web & External Services**: Search, scraping, chrome, cloud integrations
- **Communication**: Slack, Telegram, feedback systems
- **Audio & Media**: Recording, playbook, transcription, TTS
- **Content Management**: Blog, research, websearch, newsrpm, ghost-io
- **Financial Data**: Cloudquote for market data and analysis
- **Code Monitoring**: CodeWatch for automated code modification workflows
- **Container Management**: Docker for containerized application orchestration
- **Kubernetes Management**: Kubernetes for cluster resource discovery and management
- **Human-in-the-Loop**: Feedback package for interactive AI-human collaboration
- **File Indexing**: FileIndex for hybrid search and intelligent file content retrieval
- **Memory Management**: Memory package for short-term memory and context retention
- **Queue Management**: Queue package for work item queuing and workflow orchestration

### Product Enhancement Methodologies

#### 1. Systematic Analysis Approach
- **Problem Statement**: Clear definition of user pain points
- **Goals & Success Metrics**: Measurable outcomes
- **User Stories**: Scenario-based requirements
- **Technical Specifications**: Implementation details
- **Risk Assessment**: Identification and mitigation strategies

#### 2. Iterative Enhancement Process
- **Multi-Agent Coordination**: Specialized agents handle different aspects
- **Checkpoint Persistence**: State preservation across sessions
- **Queue Management**: Sequential processing with checkpoint preservation
- **Testing Integration**: Auto-repair and quality assurance

#### 3. Ecosystem Expansion Strategy
- **Plugin Architecture**: Easy addition of new packages
- **Service Registry**: Centralized service management
- **Provider Pattern**: Multiple implementation options per interface
- **Backward Compatibility**: Smooth migration paths

### User Workflows

#### 1. TokenRing One - Development Workflows
- **Development Tasks**: Code editing, refactoring, testing
- **Multi-Agent Projects**: Team coordination with specialized agents
- **Integration Work**: External service connections
- **Quality Assurance**: Code review and testing automation
- **Automated Code Modification**: AI comment-driven code changes via CodeWatch
- **Codebase Context Management**: Selective inclusion of files, symbols, and documentation via Codebase package
- **Containerized Development**: Docker-based development environments and testing
- **Kubernetes Operations**: Cluster resource discovery and management via Kubernetes package
- **Human-in-the-Loop**: Interactive feedback collection via Feedback package
- **File Content Search**: Hybrid search across codebase via FileIndex package
- **Version Control**: Git operations for commit management, rollback, and branch operations via Git package
- **JavaScript Validation**: ESLint-based validation for JavaScript/TypeScript files via Javascript package
- **Memory Management**: Session-scoped memory storage for context retention via Memory package
- **Queue Management**: Work item queuing with state preservation via Queue package

#### 2. TokenRing One - Content Creation Workflows
- **Content Creation**: Article writing with research integration
- **Editorial Process**: Managing editor coordinates assignments
- **Publishing**: Direct integration with content directories and Ghost.io
- **Research Integration**: Web search and knowledge retrieval
- **Financial Research**: Market data analysis via CloudQuote
- **Content Review**: Browser-based content feedback via Feedback package
- **Document Search**: Search across content files via FileIndex package
- **Ghost Blog Management**: Create, update, publish posts via Ghost.io integration
- **Memory Management**: Memory storage for user preferences and content context via Memory package
- **Queue Management**: Batch content processing via Queue package

#### 3. Common Workflows
- **Session Persistence**: Automatic state saving and restoration
- **Configuration Management**: Project-specific settings
- **Multi-Provider Support**: Switch between AI models dynamically
- **Human-in-the-Loop**: Feedback and approval processes via Feedback package
- **File System Monitoring**: CodeWatch for automated AI-triggered modifications
- **Context-Aware Development**: Codebase package provides intelligent file and symbol context for AI agents
- **Container Orchestration**: Docker for reproducible development and deployment environments
- **Kubernetes Cluster Management**: Resource discovery, monitoring, and management via Kubernetes package
- **Interactive Questioning**: AskQuestions tool for clarification and decision-making
- **File Content Review**: GetFileFeedback tool for browser-based content review
- **React Component Preview**: ReactFeedback tool for visual component approval
- **Hybrid File Search**: FileIndex package for semantic + full-text search across files
- **Ghost Blog Operations**: Post management, image uploads, and publishing via Ghost.io package
- **Git Operations**: Commit with AI-generated messages, rollback, branch management via Git package
- **JavaScript Code Quality**: ESLint validation for code quality via Javascript package
- **Memory Operations**: Add, list, remove, update memories via Memory package tools and commands
- **Queue Operations**: Add, list, remove, process queue items via Queue package tools and commands
- **Testing Operations**: Run tests, auto-repair failures, manage test resources via Testing package

### Product Positioning

#### 1. Target Markets
- **Developers**: AI-powered coding assistance for productivity
- **Content Creators**: Writing and publishing automation
- **Financial Analysts**: Market data analysis and research
- **Teams**: Multi-agent coordination for complex projects
- **Enterprises**: Secure local AI assistance with cloud options
- **DevOps**: Containerized application management and deployment
- **Cloud Native Teams**: Kubernetes cluster management and operations
- **Blog Publishers**: Ghost.io integration for content management
- **Workflow Automation**: Queue-based task orchestration and batch processing
- **Quality Assurance**: Automated testing and code quality assurance

#### 2. Competitive Advantages
- **Local-First**: Secure execution without data exposure
- **Extensible**: 45-package ecosystem for customization
- **Agent Specialization**: Purpose-built AI agents for different tasks
- **Open Architecture**: Transparent and customizable system
- **Financial Integration**: Real-time market data and analysis
- **Automated Code Modification**: CodeWatch for AI comment-driven workflows
- **Intelligent Context Management**: Codebase package for selective, smart context injection
- **Container Support**: Docker integration for reproducible environments
- **Kubernetes Integration**: Native Kubernetes cluster resource discovery and management
- **Human-in-the-Loop**: Comprehensive feedback system for AI-human collaboration
- **Hybrid Search**: FileIndex package for comprehensive file content search
- **Ghost.io Integration**: Native support for Ghost blogging platform
- **Git Integration**: AI-powered version control with automated commit messages
- **Code Quality**: ESLint-based JavaScript/TypeScript validation
- **Memory Management**: Session-scoped memory for context retention and continuity
- **Queue Management**: Work item queuing with state preservation and checkpointing
- **Testing Integration**: Automated testing with auto-repair capabilities

#### 3. Value Propositions
- **Productivity**: AI assistance reduces manual work
- **Quality**: Built-in testing and code quality tools
- **Flexibility**: Multiple deployment and usage options
- **Security**: Local execution with optional cloud integration
- **Financial Intelligence**: Comprehensive market data access
- **Automation**: File system monitoring and AI-triggered actions
- **Context Optimization**: Smart context selection and token efficiency
- **Reproducibility**: Docker-based development and deployment
- **Cloud Native**: Kubernetes cluster management for modern deployments
- **Alignment**: Interactive feedback ensures AI actions match user intent
- **Search Efficiency**: Hybrid search combines semantic, full-text, and token overlap for optimal results
- **Content Publishing**: Streamlined Ghost.io blog management and publishing
- **Version Control**: Automated Git operations with AI-generated commit messages
- **Code Quality Assurance**: Automated JavaScript/TypeScript validation and linting
- **Context Continuity**: Memory package maintains context across interactions
- **Workflow Orchestration**: Queue package enables sequential task processing with state preservation
- **Quality Assurance**: Testing package enables automated test execution and repair

### Feature Roadmaps

#### 1. Core Platform Evolution
- **Context Injection**: Implementation of declarative context system
- **RAG Integration**: Enhanced semantic search capabilities
- **Multi-Modal**: Expanded audio and visual interface support
- **Performance**: Optimization and scalability improvements
- **Codebase Enhancement**: Smart context selection, auto-discovery, enhanced resource types
- **Feedback Enhancement**: Comprehensive human-in-the-loop interaction platform
- **FileIndex Enhancement**: Persistent storage, true semantic search, enhanced commands
- **Ghost.io Enhancement**: Comprehensive blog management with chat commands, tools, and RPC endpoints
- **Git Enhancement**: Comprehensive version control with status, diff, remote operations, staging management
- **Javascript Enhancement**: Comprehensive JavaScript/TypeScript development platform with formatting, fixing, metrics, and dependency analysis
- **Kubernetes Enhancement**: Comprehensive Kubernetes cluster management with CRUD operations, chat commands, logs, exec, and scaling
- **Memory Enhancement**: Persistent storage, semantic search, categorization, and advanced lifecycle management
- **Queue Enhancement**: Priority queues, scheduling, persistence, dependencies, analytics, and advanced workflow orchestration
- **Testing Enhancement**: Comprehensive testing platform with framework integrations, coverage reporting, and advanced features

#### 2. Package Ecosystem Expansion
- **New Integrations**: Additional service providers
- **Enhanced Tools**: Advanced development, writing, and financial tools
- **Quality Assurance**: Improved testing and monitoring
- **User Experience**: Better interfaces and workflows
- **CodeWatch Enhancement**: Advanced AI comment patterns and multi-agent coordination
- **Codebase Enhancement**: Diff resources, test resources, documentation resources, LSP integration
- **Docker Enhancement**: Comprehensive container management with chat commands, RPC endpoints, and advanced features
- **Feedback Enhancement**: Enhanced question types, chat commands, service layer, multi-channel support
- **FileIndex Enhancement**: Persistent providers, semantic search, advanced chunking, RPC endpoints
- **Ghost.io Enhancement**: Comprehensive blog operations with pages, tags, members, newsletters, offers, tiers, webhooks
- **Git Enhancement**: Comprehensive Git operations with status, diff, remote, staging, merge, rebase, tags, hooks
- **Javascript Enhancement**: Comprehensive JavaScript/TypeScript tools with formatting, fixing, metrics, dependency analysis, security linting, and performance analysis
- **Kubernetes Enhancement**: Comprehensive Kubernetes operations with CRUD, logs, exec, scaling, rollouts, and multi-cluster support
- **Memory Enhancement**: Persistent storage providers, semantic search, categorization, metadata, lifecycle management, cross-agent sharing
- **Queue Enhancement**: Priority support, task scheduling, persistence, dependencies, categories, analytics, batch operations, templates, notifications, monitoring, error handling, multi-queue support, workflow orchestration
- **Testing Enhancement**: Comprehensive testing platform with framework integrations, coverage reporting, parallel execution, flaky test detection, and advanced reporting

#### 3. Application-Specific Features
- **Coder**: Advanced code intelligence and project management
- **Writer**: Enhanced publishing and content management
- **Financial**: Expanded market data and analysis capabilities
- **Shared**: Improved agent coordination and task orchestration
- **DevOps**: Enhanced Docker and container orchestration capabilities
- **Cloud Native**: Enhanced Kubernetes cluster management and operations
- **Feedback**: Comprehensive human-in-the-loop workflows for all applications
- **Search**: Enhanced file search capabilities via FileIndex
- **Ghost Blog**: Enhanced Ghost.io integration with full Admin API coverage
- **Git**: Enhanced version control with comprehensive Git workflow support
- **JavaScript**: Enhanced code quality with comprehensive validation, formatting, and analysis tools
- **Kubernetes**: Enhanced cluster management with comprehensive Kubernetes workflow support
- **Memory**: Enhanced memory management with persistent storage, semantic search, and organization
- **Queue**: Enhanced queue management with priority, scheduling, persistence, and workflow orchestration
- **Testing**: Enhanced testing with comprehensive test framework integrations, coverage reporting, and quality assurance

## Enhancement Opportunities

### 1. Context Injection System
The design documents reveal three approaches for context management:
- **Recommendation**: Implement declarative approach for configurability
- **Impact**: Better context relevance and token efficiency
- **Implementation**: Create ContextResolver with query-based configuration

### 2. Agent Specialization Enhancement
Current agents could be enhanced with:
- **Domain-Specific Knowledge**: Industry-specific expertise
- **Workflow Integration**: Better task coordination between agents
- **User Learning**: Adapt to individual user preferences

### 3. Package Ecosystem Optimization
- **Performance Profiling**: Identify and optimize bottlenecks
- **Dependency Management**: Reduce package coupling and improve modularity
- **Testing Coverage**: Comprehensive test suites for all packages

### 4. User Experience Improvements
- **Onboarding**: Better first-time user experience
- **Configuration Management**: Simplified setup and customization
- **Progressive Disclosure**: Gradually introduce advanced features
- **Codebase Auto-Discovery**: Automatic project structure detection and resource suggestion
- **FileIndex Auto-Discovery**: Automatic file indexing configuration and optimization
- **Memory Auto-Discovery**: Automatic memory categorization and organization
- **Queue Auto-Discovery**: Automatic queue configuration and optimization
- **Testing Auto-Discovery**: Automatic test framework detection and configuration

### 5. Integration Expansion
- **More AI Providers**: Additional LLM support
- **Development Tools**: IDE integrations and extensions
- **Collaboration**: Team features and shared workspaces
- **Browser Automation**: Enhanced Chrome/Puppeteer capabilities
- **Financial Data**: Expanded CloudQuote features for comprehensive market analysis
- **CodeWatch Enhancement**: Implement brainstormed features for comprehensive code monitoring and automation
- **Codebase Enhancement**: Implement brainstormed features for comprehensive code context management
- **Database Enhancement**: Implement brainstormed features for comprehensive database management
- **Docker Enhancement**: Implement brainstormed features for comprehensive container management
- **Feedback Enhancement**: Implement brainstormed features for comprehensive human-in-the-loop interactions
- **FileIndex Enhancement**: Implement brainstormed features for comprehensive file indexing and search
- **Filesystem Enhancement**: Implement brainstormed features for comprehensive file operations and management
- **Memory Enhancement**: Implement brainstormed features for comprehensive memory management including:
  - Persistent storage with SQLite, PostgreSQL, MongoDB, Redis providers
  - Semantic search using embeddings for intelligent memory retrieval
  - Memory categorization and tagging for organization
  - Rich metadata (timestamps, priority, source, confidence)
  - Memory lifecycle management with expiration and auto-archiving
  - Structured memory types (JSON, key-value, list, reference)
  - Cross-agent memory sharing and synchronization
  - Memory versioning and history tracking
  - Memory analytics and insights
  - Context optimization with selective memory injection
  - Memory consolidation and deduplication
  - Memory templates for common use cases
  - Export/import and backup capabilities
  - Enhanced tools and commands for memory operations
  - Security features (encryption, access control, audit logging)
- **Queue Enhancement**: Implement brainstormed features for comprehensive queue management including:
  - Priority queue support with priority levels and escalation
  - Advanced filtering and search across queue items
  - Persistent storage with SQLite, PostgreSQL, MongoDB, Redis providers
  - Task dependencies and prerequisite resolution
  - Task scheduling and timing (delayed, scheduled, recurring)
  - Queue categories and tags for organization
  - Queue metrics and analytics
  - Batch operations and bulk processing
  - Queue templates and presets
  - Notifications and alerts for queue events
  - Queue monitoring and health checks
  - Advanced error handling and retry logic
  - Multi-queue support and queue chaining
  - Workflow orchestration with conditional logic
- **Testing Enhancement**: Implement brainstormed features for comprehensive testing including:
  - Test framework integrations (Vitest, Jest, Mocha, Playwright, Cypress)
  - Automatic test discovery and configuration
  - Code coverage collection and reporting
  - Parallel test execution and test sharding
  - Flaky test detection and retry logic
  - Advanced test filtering and categorization
  - Comprehensive test reporting and analytics
  - Test environment management and containerization
  - Test data management and fixture handling
  - Performance and load testing capabilities
  - Mocking and stubbing support
  - Visual regression testing
  - Accessibility testing
  - Security testing and vulnerability scanning
  - Deep integration with other TokenRing packages
  - AI-powered test generation and improvement
- **Ghost.io Enhancement**: Implement brainstormed features for comprehensive Ghost blog management including:
  - Chat commands for post, page, tag, member, newsletter, offer, tier, webhook management
  - AI tools for all Ghost Admin API operations
  - RPC endpoints for programmatic access
  - Advanced filtering with NQL query language
  - Pagination support for large datasets
  - Lexical format support for lossless editing
  - Pages, tags, members, newsletters, offers, tiers, webhooks support
  - Integration with FileIndex for content search
  - Integration with Feedback for content review workflows
- **Git Enhancement**: Implement brainstormed features for comprehensive Git version control including:
  - Status and diff tools for repository visibility
  - Staging area management for selective commits
  - Remote operations (push, pull, fetch, clone)
  - Advanced branch operations (merge, rebase, cherry-pick)
  - Tag management for versioning
  - RPC endpoints for programmatic access
  - Enhanced chat commands with interactive features
  - Git ignore management
  - Hook management system
  - Submodule and worktree support
- **Javascript Enhancement**: Implement brainstormed features for comprehensive JavaScript/TypeScript development including:
  - TypeScript support for type checking
  - Code formatting with Prettier/ESLint
  - Auto-fix capabilities for ESLint issues
  - JavaScript tools suite for validation and analysis
  - Comprehensive chat command system
  - RPC endpoints for programmatic access
  - Code quality metrics and complexity analysis
  - Dependency analysis and validation
  - Security and performance linting
  - Test coverage integration
  - Bundler integration (Webpack, Rollup, Vite)
  - Transpilation support (Babel, TypeScript)
  - Monorepo support
- **Kubernetes Enhancement**: Implement brainstormed features for comprehensive Kubernetes cluster management including:
  - CRUD operations for core resources (Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces, etc.)
  - Chat commands for cluster operations (/k8s status, /k8s list, /k8s get, /k8s create, /k8s delete, etc.)
  - Logs and exec capabilities for pod inspection and debugging
  - Scaling operations for deployments, statefulsets, and daemonsets
  - Rollout management with pause, resume, undo, and history
  - Resource filtering with label selectors and field selectors
  - Multi-cluster support with context switching
  - KubeConfig loading for existing cluster configurations
  - Port forwarding and proxy capabilities
  - Event monitoring and health checks
  - Namespace management with resource quotas
  - Service and ingress management
  - Persistent volume and claim management
  - RBAC management for roles and bindings
  - Job and cronjob management
  - Network policy management
  - HPA and PDB management
  - Custom resource definition (CRD) management
- **Utility Enhancement**: Implement brainstormed features for comprehensive utility functions including:
  - Collection/Array utilities (chunk, flatten, groupBy, keyBy, partition, uniq, xor, difference, intersection, zip)
  - Date/Time utilities (format, parse, arithmetic, range, relative time, timezone)
  - Number/Math utilities (formatting, validation, statistical operations, random generation)
  - Validation utilities (type guards, string validation, composite validation)
  - Logging utilities (log levels, handlers, formatters, performance logging)
  - Caching utilities (memory cache, LRU, LFU, TTL, cache decorators)
  - Crypto/Security utilities (hashing, encryption, base64, UUID, password hashing)
  - Stream utilities (stream map, filter, reduce, chunk, batch, rate limiting)
  - File Path utilities (path manipulation, validation, patterns, glob)
  - Encoding/Decoding utilities (JSON, URL, HTML, CSV, YAML, TOML)

## Key Product Design Patterns

### 1. Plugin Architecture Pattern
```typescript
interface TokenRingPackage {
  name: string;
  version: string;
  tools: Tool[];
  commands: Command[];
  services: Service[];
}
```

### 2. Service Registry Pattern
```typescript
class PluginManager {
  installPlugins(packages: TokenRingPackage[], app: TokenRingApp): void
  getService<T>(serviceType: string): T
}
```

### 3. Agent Coordination Pattern
```typescript
class AgentTeam {
  createAgent(name: string): Promise<Agent>
  coordinate(agents: Agent[]): Promise<void>
}
```

### 4. Context Injection Pattern
```typescript
interface ContextProvider {
  getContext(agent: Agent): Promise<ContextItem[]>
  estimateTokens(agent: Agent): Promise<number>
}
```

### 5. JavaScript Tool Definition Pattern
```typescript
interface TokenRingToolDefinition<TInputSchema> {
  name: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (input: z.infer<TInputSchema>, agent: Agent): Promise<Output>;
}
```

### 6. Utility Package Pattern
```typescript
// object/pick.ts
export default function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((acc, key) => {
    if (Object.hasOwn(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Pick<T, K>);
}
```

### 7. Registry Pattern
```typescript
// registry/KeyedRegistry.ts
export default class KeyedRegistry<T = any> {
  protected items: Map<string, T> = new Map();
  private subscribers: Map<string, ((item: T) => void)[]> = new Map();

  register = (name: string, resource: T) => {
    this.items.set(name, resource);
    // Notify subscribers
  };
}
```

### 8. AI Client Model Registry Pattern
```typescript
// ModelTypeRegistry.ts - Base registry for AI models
export class ModelTypeRegistry<T extends ModelSpec, C extends GenericAIClient, R extends ModelRequirements> {
  modelSpecs = new KeyedRegistry<T>();
  
  registerModelSpec = this.modelSpecs.register;
  registerAllModelSpecs(modelSpecs: T[]): void;
  getAllModelsWithOnlineStatus(): Promise<Record<string, ModelStatus<T>>>;
  getClient(name: string): Promise<C>;
  getModelSpecsByRequirements(requirements: R): Record<string, T>;
}

// Seven specialized registries:
// - ChatModelRegistry
// - EmbeddingModelRegistry
// - ImageGenerationModelRegistry
// - VideoGenerationModelRegistry
// - SpeechModelRegistry
// - TranscriptionModelRegistry
// - RerankingModelRegistry
```

### 9. AI Provider Pattern
```typescript
// providers.ts - Provider registration interface
interface AIModelProvider<T> {
  providerCode: string;
  configSchema: T;
  init(providerDisplayName: string, config: z.output<T>, app: TokenRingApp): Promise<void>;
  autoConfigure?: () => Promise<z.output<T> | null>;
}

// 17+ providers implemented:
// - anthropic, openai, google, groq, cerebras, deepseek
// - elevenlabs, fal, xai, openrouter, perplexity, azure
// - ollama, llama, openaiCompatible, and more
```

### 10. Feature System Pattern
```typescript
// Model settings with query parameters
interface SettingDefinition {
  description: string;
} & ({
  type: "boolean";
  defaultValue?: boolean;
} | {
  type: "number";
  defaultValue?: number;
  min?: number;
  max?: number;
} | {
  type: "enum";
  defaultValue?: PrimitiveType;
  values: PrimitiveType[];
} | {
  type: "array";
  defaultValue?: PrimitiveType[];
});

// Usage: openai:gpt-5?websearch=1&reasoningEffort=high
```

### 11. AWS Service Pattern
```typescript
// AWSService.ts - Base service for AWS integrations
export default class AWSService implements TokenRingService {
  readonly name = "AWSService";
  description = "Provides AWS functionality";
  private stsClient?: STSClient;
  private s3Client?: S3Client;

  constructor(readonly options: z.output<typeof AWSConfigSchema>);
  
  // Generic client initialization for any AWS service
  initializeAWSClient<T>(
    ClientClass: new (config: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
    } & Record<string, unknown>) => T,
    clientConfig: Record<string, unknown> = {}
  ): T;
  
  // Singleton client access
  getSTSClient(): STSClient;
  getS3Client(): S3Client;
  
  // Authentication
  isAuthenticated(): boolean;
  async getCallerIdentity(): Promise<{ Arn?: string; Account?: string; UserId?: string }>;
  
  // Service status
  async status(_agent: Agent): Promise<ServiceStatus>;
}
```

### 12. AWS Tool Pattern
```typescript
// Tools follow consistent pattern with error handling
interface AWSTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent) => Promise<{ type: 'json'; data: any }>;
}

// Example: S3 bucket listing tool
const listS3BucketsTool: AWSTool<z.ObjectSchema> = {
  name: "aws_listS3Buckets",
  displayName: "Aws/listS3BucketsTool",
  description: "Lists all S3 buckets in the configured AWS account and region.",
  inputSchema: z.object({}),
  execute: async (_args, agent) => {
    const awsService = agent.requireServiceByType(AWSService);
    
    if (!awsService.isAuthenticated()) {
      throw new Error(`[${name}] AWS credentials not configured in AWSService.`);
    }
    
    try {
      const s3Client = awsService.getS3Client();
      const command = new ListBucketsCommand({});
      const response = await s3Client.send(command);
      const buckets = (response.Buckets || []).map((bucket: any) => ({
        Name: bucket.Name,
        CreationDate: bucket.CreationDate,
      }));
      return { type: 'json' as const, data: { buckets } };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[${name}] Error listing S3 buckets: ${message}`);
    }
  }
};
```

### 13. AWS Command Pattern
```typescript
// Commands follow consistent pattern with help text
interface AWSCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}

// Example: AWS status command
const awsStatusCommand: AWSCommand = {
  name: "aws status",
  description: "View current AWS authentication status",
  execute: async (remainder, agent) => {
    const awsService = agent.requireServiceByType(AWSService);
    try {
      const identity = await awsService.getCallerIdentity();
      const lines = [
        "AWS Authentication Status:",
        indent([
          `Account: ${identity.Account}`,
          `Arn: ${identity.Arn}`,
          `UserId: ${identity.UserId}`,
          `Region: ${awsService.options.region}`
        ], 1)
      ];
      return lines.join("\n");
    } catch (error: unknown) {
      throw new CommandFailedError(`Failed to get AWS caller identity: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  help: `/aws status - View current AWS authentication status\n\nView current AWS authentication status and account information...`
};
```

### 14. Blog Provider Pattern
```typescript
// BlogProvider.ts - Interface for blog platform integrations
export interface BlogProvider {
  description: string;
  imageGenerationModel: string;
  cdnName: string;
  
  attach(agent: Agent, creationContext: AgentCreationContext): void;
  getAllPosts(agent: Agent): Promise<BlogPost[]>;
  getRecentPosts(filter: BlogPostFilterOptions, agent: Agent): Promise<BlogPost[]>;
  createPost(data: CreatePostData, agent: Agent): Promise<BlogPost>;
  updatePost(data: UpdatePostData, agent: Agent): Promise<BlogPost>;
  selectPostById(id: string, agent: Agent): Promise<BlogPost>;
  getCurrentPost(agent: Agent): BlogPost | null;
  clearCurrentPost(agent: Agent): Promise<void>;
}
```

### 15. Review Escalation Pattern
```typescript
// BlogService.ts - Review escalation for publishing
async publishPost(agent: Agent): Promise<void> {
  const currentPost = activeBlog.getCurrentPost(agent);
  
  // Check review patterns
  if (state.reviewPatterns && state.reviewPatterns.length > 0) {
    for (const pattern of state.reviewPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(currentPost.content)) {
        // Trigger escalation workflow
        const escalationService = agent.requireServiceByType(EscalationService);
        await using channel = await escalationService.initiateContactWithUser(state.reviewEscalationTarget, agent);
        // Wait for approve/reject response
      }
    }
  }
  
  // Publish if no escalation needed
  await activeBlog.updatePost({ status: "published" }, agent);
}
```

### 16. Chrome Browser Automation Pattern
```typescript
// ChromeService.ts - Browser lifecycle management
export default class ChromeService implements TokenRingService {
  readonly name = "ChromeService";
  description = "Chrome browser automation service";

  constructor(private options: z.output<typeof ChromeConfigSchema>);
  
  async getBrowser(agent: Agent): Promise<Browser> {
    const state = agent.getState(ChromeState);
    
    if (state.launch) {
      return await puppeteer.launch(state as LaunchOptions);
    } else {
      return await puppeteer.connect(state as ConnectOptions);
    }
  }
}
```

### 17. CLI Interaction Pattern
```typescript
// AgentCLI.ts - Main CLI service class
export default class AgentCLI implements TokenRingService {
  readonly name = "AgentCLI";
  description = "Command-line interface for interacting with agents";

  constructor(
    readonly app: TokenRingApp,
    readonly config: z.infer<typeof CLIConfigSchema>
  );

  async run(signal: AbortSignal): Promise<void>;
}

// CLI supports two UI frameworks:
// - OpenTUI (default): React-based terminal UI
// - Ink: Alternative React-based terminal UI

// Key components:
// - AgentCLI: Main service coordinating CLI operations
// - AgentLoop: Handles interaction loop for individual agents
// - RawChatUI: Core chat UI with terminal rendering
// - InputEditor: Multi-line text editor
// - InlineQuestions: Inline question handling
// - SimpleSpinner: Loading state indicator
```

### 18. CloudQuote Financial Data Pattern
```typescript
// CloudQuoteService.ts - Base service for financial data
export default class CloudQuoteService extends HttpService implements TokenRingService {
  readonly name = "CloudQuote";
  description = "Service for accessing CloudQuote financial data API";
  
  protected baseUrl = "https://api.cloudquote.io";
  protected defaultHeaders: Record<string, string>;
  
  constructor(private readonly options: CloudQuoteServiceOptions);
  
  // Generic API request method
  async getJSON(apiPath: string, params: Record<string, string|number|undefined|null>): Promise<any>;
  
  // Specialized methods
  async getHeadlinesBySecurity(params: any): Promise<any>;
  async getPriceChart(params: any): Promise<{ svgDataUri: string }>;
}
```

### 19. CodeWatch Service Pattern
```typescript
// CodeWatchService.ts - File system monitoring for AI comments
export default class CodeWatchService implements TokenRingService {
  readonly name = "CodeWatchService";
  description = "Monitors files for AI comments and triggers automated workflows";

  constructor(readonly app: TokenRingApp, readonly config: z.output<typeof CodeWatchConfigSchema>);
  
  // File system watching with configurable debouncing
  async watchFileSystem(
    fileSystemProviderName: string, 
    filesystemConfig: FileSystemConfig, 
    signal: AbortSignal
  ): Promise<void>;
  
  // Process files for AI comment detection
  async processFileForAIComments({
    filePath, 
    fileSystemProviderName
  }): Promise<void>;
  
  // Trigger code modification agents
  async triggerCodeModification(
    content: string, 
    filePath: string, 
    lineNumber: number, 
    fileSystemProviderName: string
  ): Promise<void>;
}

// AI Comment Patterns:
// - Lines starting with # AI or // AI
// - Lines ending with AI!
// - Supports Python/shell (#) and C-style (//) comments
```

### 20. Codebase Resource Pattern
```typescript
// CodeBaseService.ts - Resource management for codebase context
export default class CodeBaseService implements TokenRingService {
  readonly name = "CodeBaseService";
  description = "Manages codebase resources for providing file content and directory structure to AI context";
  
  resourceRegistry = new KeyedRegistry<FileMatchResource>();
  
  // Resource management methods
  registerResource(name: string, resource: FileMatchResource): void;
  getAvailableResources(): string[];
  getEnabledResourceNames(agent: Agent): Set<string>;
  getEnabledResources(agent: Agent): FileMatchResource[];
  setEnabledResources(resourceNames: string[], agent: Agent): Set<string>;
  enableResources(resourceNames: string[], agent: Agent): Set<string>;
  disableResources(resourceNames: string[], agent: Agent): Set<string>;
  
  // Repository mapping
  async generateRepoMap(files: Set<string>, fileSystem: FileSystemService, agent: Agent): Promise<string | null>;
  getLanguageFromExtension(ext: string): LanguageEnum | null;
  formatFileOutput(filePath: string, chunks: any[]): string | null;
}

// Resource types:
// - FileTreeResource: Provides directory structure context
// - RepoMapResource: Provides symbol-level repository mapping
// - WholeFileResource: Provides complete file contents
```

### 21. Codebase Command Pattern
```typescript
// Commands follow consistent pattern with help text
interface CodebaseCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}

// Example commands:
const codebaseSelectCommand: CodebaseCommand = {
  name: "codebase select",
  description: "Interactive resource selection",
  execute: async (remainder, agent) => {
    const codebaseService = agent.requireServiceByType(CodeBaseService);
    const sortedResources = codebaseService.getAvailableResources().sort();
    
    const selection = await agent.askQuestion({
      message: "Select resources to include in your chat context",
      question: {
        type: 'treeSelect',
        label: "Codebase Resource Selection",
        key: "result",
        defaultValue: Array.from(codebaseService.getEnabledResourceNames(agent)),
        minimumSelections: 0,
        tree: buildResourceTree(sortedResources),
      }
    });
    
    if (selection) {
      const enabled = codebaseService.setEnabledResources(selection, agent);
      return `Currently enabled codebase resources: ${Array.from(enabled).join(", ")}`;
    }
    return "Resource selection cancelled.";
  },
  help: `# /codebase select\n\nOpen an interactive tree view to browse and select codebase resources.`
};
```

### 22. Docker Service Pattern
```typescript
// DockerService.ts - Base service for Docker integrations
export default class DockerService implements TokenRingService {
  readonly name = "DockerService";
  description = "Provides Docker functionality";
  
  constructor(readonly options: z.output<typeof DockerConfigSchema>);
  
  // Build Docker CLI command with host and TLS settings
  buildDockerCmd(): string;
}

// Configuration Schema
const DockerConfigSchema = z.object({
  host: z.string().optional(),
  tls: z.object({
    verify: z.boolean().default(false),
    caCert: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
  }).optional(),
});
```

### 23. Docker Sandbox Provider Pattern
```typescript
// DockerSandboxProvider.ts - Sandbox implementation for persistent containers
export default class DockerSandboxProvider implements SandboxProvider {
  constructor(readonly dockerService: DockerService);
  
  async createContainer(options: SandboxOptions): Promise<SandboxResult>;
  async executeCommand(containerId: string, command: string): Promise<ExecuteResult>;
  async stopContainer(containerId: string): Promise<void>;
  async getLogs(containerId: string): Promise<LogsResult>;
  async removeContainer(containerId: string): Promise<void>;
}
```

### 24. Feedback Tool Pattern
```typescript
// Feedback tools follow consistent pattern with type-safe schemas
interface FeedbackTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<TokenRingToolJSONResult | TokenRingToolTextResult>;
}

// Example: Ask Questions tool
const askQuestionsTool: FeedbackTool<z.ObjectSchema> = {
  name: "ask_questions",
  displayName: "Feedback/askQuestions",
  description: "Ask the user questions with optional choices for human-in-the-loop feedback",
  inputSchema: z.object({
    message: z.string(),
    questions: z.array(z.object({
      question: z.string(),
      choices: z.array(z.string())
    }))
  }),
  execute: async (args, agent) => {
    // Transform questions to form-based input
    // Handle treeSelect for choices, text for freeform
    // Return formatted responses
  }
};

// Three core tools:
// - Feedback/askQuestions: Interactive questioning via chat
// - Feedback/getFileFeedback: Browser-based file content review
// - Feedback/react-feedback: React component preview and approval
```

### 25. File Index Provider Pattern
```typescript
// FileIndexProvider.ts - Abstract base class for file indexing providers
export interface SearchResult {
  path: string;
  chunk_index: number;
  content: string;
  relevance?: number;
  distance?: number;
}

export default abstract class FileIndexProvider {
  // Core search methods
  abstract search(query: string, limit?: number): Promise<SearchResult[]>;
  abstract fullTextSearch(query: string, limit?: number): Promise<SearchResult[]>;
  
  // Lifecycle methods
  abstract waitReady(): Promise<void>;
  abstract processFile(filePath: string): Promise<void>;
  abstract onFileChanged(type: string, filePath: string): void;
  abstract close(): Promise<void>;
  
  // Current file context
  abstract setCurrentFile(filePath: string): void;
  abstract clearCurrentFile(): void;
  abstract getCurrentFile(): string | null;
}
```

### 26. Hybrid Search Pattern
```typescript
// Hybrid search combining multiple search strategies
async hybridSearchFileIndex(
  { query, topK, textWeight, fullTextWeight, mergeRadius },
  agent
): Promise<HybridSearchResult[]> {
  // Execute both embedding and full-text search in parallel
  const [embeddingHits, fullTextHits] = await Promise.all([
    fileIndex.search(query, topK * 4, agent),
    fileIndex.fullTextSearch(query, topK * 4, agent),
  ]);
  
  // Compute token overlap (BM25-like)
  const queryTokens = query.toLowerCase().split(/\W+/).filter(Boolean);
  
  // Combine and normalize scores
  // Merge adjacent chunks within mergeRadius
  // Return top K merged results
}

// HybridSearchResult interface:
interface HybridSearchResult {
  path: string;
  start: number;
  end: number;
  hybridScore: number;
  content: string;
}
```

### 27. Ghost.io Blog Provider Pattern
```typescript
// GhostBlogProvider.ts - Ghost.io blog platform integration
export default class GhostBlogProvider implements BlogProvider {
  readonly description: string;
  readonly cdnName: string;
  readonly imageGenerationModel: string;
  private readonly adminAPI: GhostAdminAPI;
  
  constructor(options: GhostBlogProviderOptions);
  
  attach(agent: Agent): void;
  getCurrentPost(agent: Agent): BlogPost | null;
  getAllPosts(): Promise<BlogPost[]>;
  getRecentPosts(filter: BlogPostFilterOptions, agent: Agent): Promise<BlogPost[]>;
  createPost(data: CreatePostData, agent: Agent): Promise<BlogPost>;
  updatePost(data: UpdatePostData, agent: Agent): Promise<BlogPost>;
  selectPostById(id: string, agent: Agent): Promise<BlogPost>;
  clearCurrentPost(agent: Agent): Promise<void>;
}

// GhostCDNProvider extends CDNProvider for image uploads
export default class GhostCDNProvider extends CDNProvider {
  private readonly adminAPI: GhostAdminAPI;
  
  constructor(options: GhostCDNProviderOptions);
  
  async upload(data: Buffer, options?: UploadOptions): Promise<UploadResult>;
}

// GhostBlogState for agent state management
export class GhostBlogState extends AgentStateSlice {
  currentPost: GhostPost | null;
  
  reset(): void;
  serialize(): z.output<typeof serializationSchema>;
  deserialize(data: z.output<typeof serializationSchema>): void;
  show(): string[];
}
```

### 28. Git Service Pattern
```typescript
// GitService.ts - Base service for Git integrations
export default class GitService implements TokenRingService {
  readonly name = "GitService";
  description = "Provides Git functionality";
}
```

### 29. Git Tool Pattern
```typescript
// Tools follow consistent pattern with error handling
interface GitTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<string>;
}

// Example: Commit tool
const commitTool: GitTool<z.ObjectSchema> = {
  name: "git_commit",
  displayName: "Git/commit",
  description: "Commits changes in the source directory to git.",
  inputSchema: z.object({
    message: z.string().describe("Optional commit message. If not provided, a message will be generated based on the chat context.").optional(),
  }),
  execute: async (args, agent) => {
    const fileSystem = agent.requireServiceByType(FileSystemService);
    const terminal = agent.requireServiceByType(TerminalService);
    const chatModelRegistry = agent.requireServiceByType(ChatModelRegistry);
    const chatService = agent.requireServiceByType(ChatService);
    
    // Generate commit message if not provided
    let gitCommitMessage = args.message;
    if (!gitCommitMessage) {
      const currentMessage = chatService.getLastMessage(agent);
      if (currentMessage) {
        // Generate message using AI
        const model = chatService.requireModel(agent);
        const chatConfig = chatService.getChatConfig(agent);
        const messages = await chatService.buildChatMessages({
          input: "Please create a git commit message for the set of changes you recently made.",
          chatConfig,
          agent
        });
        messages.splice(0, messages.length - 2);
        const client = await chatModelRegistry.getClient(model);
        const [output] = await client.textChat({ messages, tools: {} }, agent);
        gitCommitMessage = output || "TokenRing One Automatic Checkin";
      }
    }
    
    // Execute git commands
    await terminal.executeCommand("git", ["add", "."], {}, agent);
    await terminal.executeCommand("git", ["-c", "user.name=TokenRing One", "-c", "user.email=one@tokenring.ai", "commit", "-m", gitCommitMessage], {}, agent);
    
    fileSystem.setDirty(false, agent);
    return "Changes successfully committed to git";
  }
};
```

### 30. Git Hook Pattern
```typescript
// Hooks follow consistent pattern with lifecycle integration
interface GitHook {
  name: string;
  displayName: string;
  description: string;
  callbacks: HookCallback[];
}

// Example: Auto commit hook
const autoCommitHook: GitHook = {
  name: "autoCommit",
  displayName: "Git/Auto Commit",
  description: "Automatically commit changes to the source directory to git",
  callbacks: [
    new HookCallback(AfterTestsPassed, async (_data, agent) => {
      const testingService = agent.requireServiceByType(TestingService);
      const filesystem = agent.requireServiceByType(FileSystemService);
      
      if (filesystem.isDirty(agent)) {
        if (!testingService.allTestsPassed(agent)) {
          agent.errorMessage("Not committing changes, due to tests not passing");
          return;
        }
        await commit({message: ""}, agent);
      }
    })
  ]
};
```

### 31. Kubernetes Service Pattern
```typescript
// KubernetesService.ts - Base service for Kubernetes integrations
export default class KubernetesService implements TokenRingService {
  readonly name = "KubernetesService";
  description = "Provides Kubernetes functionality";

  constructor(readonly options: ParsedKubernetesServiceConfig);
  
  // Core method for resource discovery
  async listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>;
}

// Configuration Schema
const KubernetesServiceConfigSchema = z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().default("default"),
  token: z.string().optional(),
  clientCertificate: z.string().optional(),
  clientKey: z.string().optional(),
  caCertificate: z.string().optional(),
});
```

### 32. Kubernetes Tool Pattern
```typescript
// Tools follow consistent pattern with error handling
interface KubernetesTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent) => Promise<TokenRingToolJSONResult | TokenRingToolTextResult>;
}

// Example: List API Resources tool
const listKubernetesApiResourcesTool: KubernetesTool<z.ObjectSchema> = {
  name: "kubernetes_listKubernetesApiResources",
  displayName: "Kubernetes/listKubernetesApiResources",
  description: "Lists all instances of all accessible API resource types in the configured Kubernetes cluster.",
  inputSchema: z.object({}),
  execute: async (_args, agent) => {
    const kubernetesService = agent.requireServiceByType(KubernetesService);
    const resources = await kubernetesService.listAllApiResourceTypes(agent);
    const output = JSON.stringify(resources);
    return { type: 'json' as const, data: { output } };
  }
};
```

### 33. Memory Service Pattern
```typescript
// ShortTermMemoryService.ts - Base service for memory management
export default class ShortTermMemoryService implements TokenRingService {
  readonly name = "ShortTermMemoryService";
  description = "Provides Short Term Memory functionality";

  attach(agent: Agent): void {
    agent.initializeState(MemoryState, {});
  }

  addMemory(memory: string, agent: Agent): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories.push(memory);
    });
  }

  clearMemory(agent: Agent): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories = [];
    });
  }

  spliceMemory(index: number, count: number, agent: Agent, ...items: string[]): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories.splice(index, count, ...items);
    });
  }
}
```

### 34. Memory State Pattern
```typescript
// MemoryState.ts - Agent state slice for storing memories
export class MemoryState extends AgentStateSlice<typeof serializationSchema> {
  memories: string[] = [];

  constructor({memories = []}: { memories?: string[] } = {}) {
    super("MemoryState", serializationSchema);
    this.memories = [...memories];
  }

  reset(): void {
    this.memories = [];
  }

  transferStateFromParent(parent: Agent): void {
    const parentState = parent.getState(MemoryState);
    this.deserialize(parentState.serialize());
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      memories: this.memories,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.memories = data.memories ? [...data.memories] : [];
  }

  show(): string[] {
    return [
      `Memories: ${this.memories.length}`,
      ...this.memories.map((m, i) => `  [${i + 1}] ${m}`)
    ];
  }
}

const serializationSchema = z.object({
  memories: z.array(z.string())
});
```

### 35. Memory Tool Pattern
```typescript
// Tools follow consistent pattern with error handling
interface MemoryTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<string>;
}

// Example: Add Memory tool
const addMemoryTool: MemoryTool<z.ObjectSchema> = {
  name: "memory_add",
  displayName: "Memory/addMemory",
  description: "Add an item to the memory list. The item will be presented in future chats to help keep important information in the back of your mind.",
  inputSchema: z.object({
    memory: z.string().describe("The fact, idea, or info to remember.")
  }),
  execute: async (args, agent) => {
    const memoryService = agent.requireServiceByType(ShortTermMemoryService);
    
    if (!args.memory) {
      throw new Error(`[${name}] Missing parameter: memory`);
    }
    
    memoryService.addMemory(args.memory, agent);
    agent.infoMessage(`[${name}] Added new memory`);
    return "Memory added";
  }
};
```

### 36. Memory Command Pattern
```typescript
// Commands follow consistent pattern with help text
interface MemoryCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}

// Example: Memory list command
const memoryListCommand: MemoryCommand = {
  name: "memory list",
  description: "Display all stored memory items",
  help: `# /memory list\n\nDisplay all stored memory items.\n\n## Example\n\n/memory list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const memoryService = agent.requireServiceByType(ShortTermMemoryService);
    let index = 0;
    const lines: string[] = [];
    
    for await (const memory of agent.getState(MemoryState).memories) {
      if (index === 0) lines.push("Memory items:");
      const memoryLines = memory.split("\n");
      lines.push(`[${index}] ${memoryLines[0]}`);
      for (let i = 1; i < memoryLines.length; i++) {
        lines.push(`[${index}]  ${memoryLines[i]}`);
      }
      index++;
    }
    
    if (index === 0) lines.push("No memory items stored");
    return lines.join("\n");
  }
};
```

### 37. Memory Context Handler Pattern
```typescript
// Context handlers inject memories into agent context
import {type ContextHandlerOptions, ContextItem} from "@tokenring-ai/chat/schema";
import {MemoryState} from "../state/memoryState.ts";

export default async function* getContextItems({agent}: ContextHandlerOptions): AsyncGenerator<ContextItem> {
  const state = agent.getState(MemoryState);
  for (const memory of state.memories ?? []) {
    yield {
      role: "user",
      content: memory,
    };
  }
}
```

### 38. Memory Scripting Pattern
```typescript
// Scripting functions for memory operations
scriptingService.registerFunction("addMemory", {
  type: 'native',
  params: ['memory'],
  execute(this: ScriptingThis, memory: string): string {
    this.agent.requireServiceByType(ShortTermMemoryService).addMemory(memory, this.agent);
    return `Added memory: ${memory.substring(0, 50)}...`;
  }
});

scriptingService.registerFunction("clearMemory", {
  type: 'native',
  params: [],
  execute(this: ScriptingThis): string {
    this.agent.requireServiceByType(ShortTermMemoryService).clearMemory(this.agent);
    return 'Memory cleared';
  }
});
```

### 39. Queue Service Pattern
```typescript
// WorkQueueService.ts - Base service for queue management
export default class WorkQueueService implements TokenRingService {
  readonly name = "WorkQueueService";
  description = "Provides Work Queue functionality";

  constructor(private readonly options: ParsedWorkQueueConfig);
  
  attach(agent: Agent): void;
  startWork(agent: Agent): void;
  stopWork(agent: Agent): void;
  started(agent: Agent): boolean;
  enqueue(item: QueueItem, agent: Agent): boolean;
  dequeue(agent: Agent): QueueItem | undefined;
  get(idx: number, agent: Agent): QueueItem;
  splice(start: number, deleteCount: number, agent: Agent, ...items: QueueItem[]): QueueItem[];
  size(agent: Agent): number;
  isEmpty(agent: Agent): boolean;
  clear(agent: Agent): void;
  getAll(agent: Agent): QueueItem[];
  getCurrentItem(agent: Agent): QueueItem | null;
  setCurrentItem(item: QueueItem | null, agent: Agent): void;
  setInitialCheckpoint(checkpoint: AgentCheckpointData, agent: Agent): void;
  getInitialCheckpoint(agent: Agent): AgentCheckpointData | null;
}
```

### 40. Queue State Pattern
```typescript
// WorkQueueState.ts - Agent state slice for queue management
export class WorkQueueState extends AgentStateSlice<typeof serializationSchema> {
  queue: QueueItem[] = [];
  started = false;
  initialCheckpoint: AgentCheckpointData | null = null;
  currentItem: QueueItem | null = null;
  maxSize: number | null = null;

  constructor(readonly initialConfig: z.output<typeof WorkQueueAgentConfigSchema>);
  
  reset(): void;
  serialize(): z.output<typeof serializationSchema>;
  deserialize(data: z.output<typeof serializationSchema>): void;
  show(): string[];
}

interface QueueItem {
  checkpoint: AgentCheckpointData;
  name: string;
  input: string;
}

const serializationSchema = z.object({
  queue: z.array(z.object({
    checkpoint: z.any(),
    name: z.string(),
    input: z.string()
  })),
  started: z.boolean(),
  currentItem: z.any().nullable(),
  initialCheckpoint: z.any().nullable(),
  maxSize: z.number().nullable(),
});
```

### 41. Queue Tool Pattern
```typescript
// Tools follow consistent pattern with error handling
interface QueueTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<TokenRingToolJSONResult | string>;
}

// Example: Add Task to Queue tool
const addTaskToQueueTool: QueueTool<z.ObjectSchema> = {
  name: "queue_addTaskToQueue",
  displayName: "Queue/addTaskToQueue",
  description: "Adds a task to the queue for later execution by the system.",
  inputSchema: z.object({
    description: z.string().describe("A short description of the task to be performed"),
    content: z.string().describe("A natural language string, explaining the exact task to be performed, in great detail.")
  }),
  execute: async (args, agent) => {
    const workQueueService = agent.requireServiceByType(WorkQueueService);
    
    workQueueService.enqueue({
      checkpoint: agent.generateCheckpoint(),
      name: args.description,
      input: args.content
    }, agent);
    
    agent.infoMessage(`[${name}] Added task "${args.description}" to queue`);
    
    return {
      type: "json",
      data: {
        status: "queued",
        message: "Task has been queued for later execution."
      }
    };
  }
};
```

### 42. Queue Command Pattern
```typescript
// Commands follow consistent pattern with help text
interface QueueCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}

// Example commands:
const queueAddCommand: QueueCommand = {
  name: "queue add",
  description: "Add a prompt to the queue",
  help: `# /queue add\n\nAdd a new prompt to the end of the queue.\n\n## Example\n\n/queue add 'Write a Python function to calculate Fibonacci numbers'`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    const prompt = remainder.trim();
    if (!prompt) throw new CommandFailedError("Usage: /queue add <prompt>");
    const workQueueService = agent.requireServiceByType(WorkQueueService);
    workQueueService.enqueue({ checkpoint: agent.generateCheckpoint(), name: prompt, input: prompt }, agent);
    return `Added to queue. Queue length: ${workQueueService.size(agent)}`;
  }
};

const queueListCommand: QueueCommand = {
  name: "queue list",
  description: "Display all queued prompts",
  help: `# /queue list\n\nDisplay all queued prompts with their indices.\n\n## Example\n\n/queue list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const workQueueService = agent.requireServiceByType(WorkQueueService);
    if (workQueueService.size(agent) === 0) return "Queue is empty.";
    return ["Queue contents:", numberedList(workQueueService.getAll(agent).map(({name}) => name))].join("\n");
  }
};
```

### 43. Testing Service Pattern
```typescript
// TestingService.ts - Base service for testing management
export default class TestingService implements TokenRingService {
  readonly name = "TestingService";
  description = "Provides testing functionality";

  private testRegistry = new KeyedRegistry<TestingResource>();
  
  registerResource = this.testRegistry.register;
  getAvailableResources = this.testRegistry.getAllItemNames;
  
  constructor(readonly options: z.output<typeof TestingServiceConfigSchema>);
  
  attach(agent: Agent): void;
  runTests(likeName: string, agent: Agent): Promise<void>;
  allTestsPassed(agent: Agent): boolean;
}
```

### 44. Testing Resource Pattern
```typescript
// TestingResource.ts - Interface for test resources
interface TestingResource {
  description: string;
  runTest: (agent: Agent) => Promise<TestResult>;
}

type TestResult =
  | { status: "passed"; startedAt: number; finishedAt: number; output?: string; }
  | { status: "failed"; startedAt: number; finishedAt: number; output: string; }
  | { status: "timeout"; startedAt: number; finishedAt: number; }
  | { status: "error"; startedAt: number; finishedAt: number; error: string; };
```

### 45. Shell Command Testing Resource Pattern
```typescript
// ShellCommandTestingResource.ts - Shell command test implementation
class ShellCommandTestingResource implements TestingResource {
  description = "Provides ShellCommandTesting functionality";
  
  constructor(private readonly options: z.output<typeof shellCommandTestingConfigSchema>);
  
  async runTest(agent: Agent): Promise<TestResult> {
    const terminal = agent.requireServiceByType(TerminalService);
    const startedAt = Date.now();
    
    const bashResult = await terminal.runScript(
      this.options.command,
      {
        timeoutSeconds: this.options.timeoutSeconds,
        workingDirectory: this.options.workingDirectory,
      },
      agent,
    );
    
    // Map terminal result to test result
    // ...
  }
}
```

### 46. Testing Command Pattern
```typescript
// Commands follow consistent pattern with help text
interface TestingCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}

// Example commands:
const testListCommand: TestingCommand = {
  name: "test list",
  description: "List available tests",
  help: `# /test list\n\nShow all available tests.\n\n## Example\n\n/test list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const available = Array.from(agent.requireServiceByType(TestingService).getAvailableResources());
    return available.length === 0 ? "No tests available." : "Available tests:\n" + available.map(n => ` - ${n}`).join('\n');
  },
};

const testRunCommand: TestingCommand = {
  name: "test run",
  description: "Run tests",
  help: `# /test run [test_name]\n\nRun a specific test or all tests. If tests fail, the agent may offer to automatically repair the issues.\n\n## Example\n\n/test run\n/test run userAuth`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    await agent.requireServiceByType(TestingService).runTests(remainder?.trim() || "*", agent);
    return "Tests executed";
  },
};
```

### 47. Testing Hook Pattern
```typescript
// Hooks follow consistent pattern with lifecycle integration
interface TestingHook {
  name: string;
  displayName: string;
  description: string;
  callbacks: HookCallback[];
}

// Example: Auto test hook
const autoTestHook: TestingHook = {
  name: "autoTest",
  displayName: "Testing/Auto Test",
  description: "Runs tests automatically after chat is complete",
  callbacks: [
    new HookCallback(AfterAgentInputSuccess, async (_data, agent) => {
      const filesystem = agent.requireServiceByType(FileSystemService);
      const testingService = agent.requireServiceByType(TestingService);
      
      if (filesystem.isDirty(agent)) {
        agent.infoMessage("Working Directory was updated, running test suite...");
        await testingService.runTests("*", agent);
      }
    })
  ]
};
```

## Utility Package (@tokenring-ai/utility)

### Overview

The `@tokenring-ai/utility` package provides a comprehensive collection of general-purpose utility functions and classes used across the TokenRing ecosystem. This package serves as the foundation for reusable helpers for common programming tasks including object manipulation, string processing, HTTP operations, promise handling, registry management, timer utilities, and more.

### Current Capabilities

#### Supported Features
- **Buffer Utilities**: Binary data detection (`isBinaryData`)
- **Object Utilities**: `pick`, `omit`, `transform`, `isEmpty`, `deepMerge`, `deepEquals`, `parametricObjectFilter`, `pickValue`, `requireFields`, `isPlainObject`
- **String Utilities**: `convertBoolean`, `trimMiddle`, `shellEscape`, `joinDefault`, `formatLogMessages`, `wrapText`, `markdownList`, `numberedList`, `indent`, `codeBlock`, `errorToString`, `markdownTable`, `dedupe`, `like`, `asciiTable`, `generateHumanId`, `getRandomItem`, `oneOf`, `ridiculousMessages`, `workingMessages`, `intelligentTruncate`
- **HTTP Utilities**: `HttpService` (abstract base class), `doFetchWithRetry`, `cachedDataRetriever`
- **Promise Utilities**: `abandon`, `waitForAbort`, `backoff`
- **Registry Utilities**: `KeyedRegistry`, `TypedRegistry`
- **Timer Utilities**: `debounce`, `throttle`
- **Environment Utilities**: `defaultEnv`, `isDevelopmentEnvironment`, `isProductionEnvironment`
- **Type Definitions**: `PrimitiveType`

#### Current Components
- **Object Manipulation**: `pick`, `omit`, `transform`, `deepMerge`, `deepEquals`, `isEmpty`, `parametricObjectFilter`, `pickValue`, `requireFields`, `isPlainObject`
- **String Formatting**: Comprehensive string utilities for formatting, truncating, escaping, and generating output
- **HTTP Service**: Abstract base class for HTTP services with retry logic
- **Promise Handling**: Utilities for abandoning promises, waiting for abort signals, and exponential backoff
- **Registry Patterns**: `KeyedRegistry` for string-keyed registries, `TypedRegistry` for type-based registries
- **Timer Functions**: Debounce and throttle for rate limiting
- **Binary Detection**: Binary data detection for file handling

#### Current Limitations
- No collection/array manipulation utilities beyond basic operations
- No date/time utilities
- No number/math utilities
- No logging utilities beyond formatting
- No validation utilities beyond `requireFields`
- No caching utilities beyond basic HTTP caching
- No crypto/security utilities
- No stream utilities
- No file path utilities
- No encoding/decoding utilities
- Limited error handling utilities
- No performance monitoring utilities
- No debugging utilities
- No configuration management utilities
- No environment variable utilities beyond basic checks

See `pkg/utility/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### Object Utilities

**Type Signature:**
```typescript
// pick.ts
export default function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K>

// omit.ts
export default function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K>

// deepMerge.ts
export default function deepMerge<T extends object, S extends object>(
  target: T | null | undefined,
  source: S | null | undefined,
): T & S
```

**Implementation Example:**
```typescript
import pick from '@tokenring-ai/utility/object/pick';
import omit from '@tokenring-ai/utility/object/omit';
import deepMerge from '@tokenring-ai/utility/object/deepMerge';

const user = { id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret' };

// Pick specific fields
const publicUser = pick(user, ['id', 'name']);
// { id: 1, name: 'Alice' }

// Remove sensitive fields
const safeUser = omit(user, ['password']);
// { id: 1, name: 'Alice', email: 'alice@example.com' }

// Deep merge
const configA = { port: 3000, host: 'localhost' };
const configB = { host: '127.0.0.1', cache: true };
const merged = deepMerge(configA, configB);
// { port: 3000, host: '127.0.0.1', cache: true }
```

#### Registry Utilities

**KeyedRegistry Pattern:**
```typescript
export default class KeyedRegistry<T = any> {
  protected items: Map<string, T> = new Map();
  private subscribers: Map<string, ((item: T) => void)[]> = new Map();

  register = (name: string, resource: T) => {
    this.items.set(name, resource);
    // Notify subscribers
  };

  waitForItemByName = (name: string, callback: (item: T) => void): void;
  getItemByName = (name: string): T | undefined;
  requireItemByName = (name: string): T;
  getAllItemNames = (): string[];
  getItemNamesLike = (likeName: string | string[]): string[];
  getLongestPrefixMatch = (input: string): { key: string; item: T; remainder: string } | undefined;
}
```

**TypedRegistry Pattern:**
```typescript
export default class TypedRegistry<MinimumType extends ThingWithConstructor> {
  protected registry = new KeyedRegistry<MinimumType>();
  
  register = (...items: MinimumType[] | MinimumType[][]);
  getItemByType = <R extends MinimumType>(type: abstract new (...args: any[]) => R): R | undefined;
  requireItemByType = <R extends MinimumType>(type: abstract new (...args: any[]) => R): R;
}
```

#### HTTP Service Pattern

**Abstract Base Class:**
```typescript
export abstract class HttpService {
  protected abstract baseUrl: string;
  protected abstract defaultHeaders: Record<string, string>;

  async parseJsonOrThrow(res: Response, context: string): Promise<any>;
  protected async fetchJson(path: string, opts: RequestInit = {}, context: string): Promise<any>;
}
```

**Usage Example:**
```typescript
class UserService extends HttpService {
  protected baseUrl = 'https://api.example.com';
  protected defaultHeaders = {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  };

  async getUser(id: string) {
    return this.fetchJson(`/users/${id}`, {}, 'getUser');
  }
}
```

#### Timer Utilities

**Debounce Pattern:**
```typescript
export default function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}
```

**Throttle Pattern:**
```typescript
export default function throttle<T extends (...args: any[]) => any>(func: T): (minWait: number, ...args: Parameters<T>) => void
```

### Enhancement Opportunities

See `pkg/utility/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **Collection/Array Utilities** - chunk, flatten, groupBy, keyBy, partition, uniq, xor, difference, intersection, zip
2. **Date/Time Utilities** - format, parse, arithmetic, range, relative time, timezone conversion
3. **Number/Math Utilities** - formatting, validation, statistical operations, random generation
4. **Validation Utilities** - type guards, string validation (email, URL, UUID), composite validation
5. **Logging Utilities** - log levels, handlers, formatters, performance logging
6. **Caching Utilities** - memory cache, LRU, LFU, TTL, cache decorators

#### Medium Priority
7. **Crypto/Security Utilities** - hashing, encryption, base64, UUID generation, password hashing
8. **Stream Utilities** - stream map, filter, reduce, chunk, batch, rate limiting
9. **File Path Utilities** - path manipulation, validation, patterns, glob matching
10. **Encoding/Decoding Utilities** - JSON, URL, HTML, CSV, YAML, TOML parsing and stringifying

#### Low Priority
11. **Performance Monitoring** - timers, memory usage, CPU usage, metrics
12. **Debugging Utilities** - debug helper, object inspection, stack traces
13. **Configuration Management** - config loading, validation, merging, environment variables
14. **Error Handling** - error classification, wrapping, retry with backoff, fallback
15. **Template Utilities** - string templating, code generation
16. **Internationalization** - translation, pluralization, localization
17. **Color/ANSI** - ANSI colors, color utilities
18. **CLI Utilities** - spinners, progress bars, table rendering
19. **Type Utilities** - type guards, type transformations
20. **Browser-Specific** - browser detection, localStorage, sessionStorage, cookies

### Integration

#### Module Structure
```typescript
// Individual imports (tree-shakeable)
import pick from '@tokenring-ai/utility/object/pick';
import debounce from '@tokenring-ai/utility/timer/debounce';
import KeyedRegistry from '@tokenring-ai/utility/registry/KeyedRegistry';
import { HttpService } from '@tokenring-ai/utility/http/HttpService';
```

#### Integration Opportunities
- **With @tokenring-ai/agent**: Utility functions for agent operations
- **With @tokenring-ai/chat**: String formatting for chat output
- **With @tokenring-ai/filesystem**: Binary detection for file handling
- **With @tokenring-ai/memory**: Object utilities for memory management
- **With @tokenring-ai/queue**: Registry patterns for queue management
- **With @tokenring-ai/testing**: Utility functions for test helpers
- **With @tokenring-ai/http**: HTTP service base for API clients
- **Across all packages**: Shared utilities to reduce duplication

### Best Practices

1. **Tree-Shaking**: Import individual functions to minimize bundle size
2. **Type Safety**: Leverage TypeScript generics for type-safe utilities
3. **Pure Functions**: Prefer pure functions without side effects
4. **Comprehensive Tests**: All utilities should have unit tests
5. **JSDoc**: Document all public APIs with JSDoc comments
6. **Performance**: Benchmark critical utilities
7. **Dependencies**: Minimize external dependencies
8. **Cross-Platform**: Ensure utilities work in Node.js and browser

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/agent` 0.2.0 - Agent integration
- `human-id` ^4.1.3 - Human-readable ID generation

### Related Components
- **@tokenring-ai/agent**: Agent framework integration
- **@tokenring-ai/chat**: Chat output formatting
- **@tokenring-ai/filesystem**: File operations
- **@tokenring-ai/memory**: Memory management
- **@tokenring-ai/queue**: Queue management
- **@tokenring-ai/testing**: Test utilities

### Limitations and Considerations

- **No Collection Utilities**: Missing array/collection manipulation functions
- **No Date Utilities**: No date/time formatting or manipulation
- **No Number Utilities**: No number formatting or mathematical operations
- **No Validation**: Limited validation beyond `requireFields`
- **No Logging**: No logging framework beyond formatting
- **No Caching**: No caching utilities
- **No Crypto**: No cryptographic operations
- **No Streams**: No stream processing utilities
- **No Path Utilities**: No file path manipulation
- **No Encoding**: No encoding/decoding utilities beyond basic JSON

---

## Filesystem Package (@tokenring-ai/filesystem)

[Content from previous file continues...]

---

## Git Package (@tokenring-ai/git)

[Content from previous file continues...]

---

## JavaScript Package (@tokenring-ai/javascript)

### Overview

The `@tokenring-ai/javascript` package provides JavaScript/TypeScript validation capabilities for the TokenRing AI ecosystem. This package integrates with the TokenRing FileSystemService to register ESLint-based validation for JavaScript files, ensuring code quality and consistency across JavaScript/TypeScript projects.

### Current Capabilities

#### Supported Features
- **Automatic ESLint Validation**: Validate JavaScript files using ESLint
- **File Extension Support**: .js, .mjs, .cjs, .jsx files
- **Integration with FileSystemService**: Seamless file validation
- **Error and Warning Reporting**: Line/column information for issues
- **Reusable ESLint Instance**: Performance optimization
- **Plugin-Based Architecture**: Easy integration with TokenRing apps

#### Current Components
- **JavascriptFileValidator**: ESLint-based file validator
- **Plugin System**: Integration with FileSystemService

#### Current Limitations
- No chat commands for user interaction
- No AI tools directly exposed to agents
- No RPC endpoints for programmatic access
- No TypeScript support (only JavaScript validation)
- No code formatting capabilities (Prettier, ESLint fix)
- No code fixing or auto-correction features
- No syntax checking beyond ESLint rules
- No code quality metrics or reporting
- No type checking (TypeScript compiler integration)
- No dependency analysis or import validation
- No security linting or performance linting

See `pkg/javascript/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### JavascriptFileValidator

The `JavascriptFileValidator` is a file validator implementation that uses ESLint to validate JavaScript files.

**Type Signature:**
```typescript
type FileValidator = (filePath: string, content: string) => Promise<string | null>;
```

**Implementation:**
```typescript
import type {FileValidator} from "@tokenring-ai/filesystem/FileSystemService";
import {ESLint} from "eslint";

const eslint = new ESLint();

const JavascriptFileValidator: FileValidator = async (filePath, content) => {
  const results = await eslint.lintText(content, {filePath});
  const messages = results.flatMap(r => r.messages);
  if (messages.length === 0) return null;
  return messages.map(m => `${m.line}:${m.column} ${m.severity === 2 ? "error" : "warning"} ${m.message} (${m.ruleId})`).join("\n");
};

export default JavascriptFileValidator;
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the JavaScript file validators with the FileSystemService.

**Plugin Implementation:**
```typescript
import {TokenRingPlugin} from "@tokenring-ai/app";
import FileSystemService from "@tokenring-ai/filesystem/FileSystemService";
import {z} from "zod";
import JavascriptFileValidator from "./JavascriptFileValidator.ts";
import packageJSON from './package.json' with {type: 'json'};

const packageConfigSchema = z.object({});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(FileSystemService, fileSystemService => {
      for (const ext of [".js", ".mjs", ".cjs", ".jsx"]) {
        fileSystemService.registerFileValidator(ext, JavascriptFileValidator);
      }
    });
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Configuration

The plugin has an empty configuration schema:

```typescript
const packageConfigSchema = z.object({});
```

### Usage Examples

#### Plugin Installation

```typescript
import {TokenRingApp} from "@tokenring-ai/app";
import javascriptPlugin from "@tokenring-ai/javascript/plugin";

const app = new TokenRingApp();

// Install the JavaScript validation plugin
await app.installPlugin(javascriptPlugin);

// Now all JavaScript files will be automatically validated
```

#### Manual Validator Usage

```typescript
import JavascriptFileValidator from "@tokenring-ai/javascript/JavascriptFileValidator";

const code = `
const x = 1;
const y = 2;
`;

const result = await JavascriptFileValidator("example.js", code);

if (result) {
  console.log("Validation issues:");
  console.log(result);
} else {
  console.log("No issues found");
}
```

### Enhancement Opportunities

See `pkg/javascript/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **TypeScript Support** - Add TypeScript file validation (.ts, .tsx, .cts, .mts) with type checking
2. **Code Formatting Tools** - Format JavaScript/TypeScript code with Prettier or ESLint
3. **Code Fixing and Auto-Correction** - Auto-fix fixable ESLint issues
4. **JavaScript Tools Suite** - Expose validation, type checking, metrics, and analysis tools to AI agents
5. **Chat Commands System** - Comprehensive CLI-like command system for JavaScript operations
6. **RPC Endpoints** - Programmatic access for external systems and integrations
7. **Code Quality Metrics** - Cyclomatic complexity, LOC metrics, maintainability index

#### Medium Priority
8. **Dependency Analysis** - Detect unused, missing, or outdated dependencies
9. **JSDoc/TSDoc Validation** - Validate documentation comments
10. **Security Linting** - Detect sensitive data and security vulnerabilities
11. **Performance Linting** - Detect performance anti-patterns
12. **Test Coverage Integration** - Integrate with Jest, Mocha, Vitest coverage reports
13. **Bundler Integration** - Validate Webpack, Rollup, Vite configurations
14. **Transpilation Support** - TypeScript to JavaScript, Babel transpilation
15. **Monorepo Support** - Workspace-aware linting

#### Low Priority
16. **Code Generation** - Generate boilerplate, types, test scaffolding
17. **Refactoring Tools** - Rename symbols, extract methods, convert modules
18. **Documentation Generation** - Auto-generate JSDoc, API docs, README
19. **Visual Code Analysis** - Dependency graphs, complexity visualization
20. **IDE Integration** - VS Code extension, language server support
21. **CI/CD Integration** - Pre-commit hooks, PR validation, quality gates
22. **Custom Rule Development** - Create and share custom ESLint rules
23. **Team Collaboration Features** - Shared configurations, coding standards
24. **AI-Powered Code Suggestions** - AI-powered fix suggestions and improvements

### Integration

#### Plugin Registration

The plugin automatically registers:
- `JavascriptFileValidator` - ESLint-based file validator for JavaScript files

#### Integration Opportunities
- **With @tokenring-ai/filesystem**: File operations and validation integration
- **With @tokenring-ai/testing**: Test coverage integration
- **With @tokenring-ai/terminal**: Command execution for formatting and fixing
- **With @tokenring-ai/agent**: Tool execution context for AI tools
- **With @tokenring-ai/chat**: Chat commands for JavaScript operations
- **With @tokenring-ai/feedback**: Interactive workflows for code review
- **With @tokenring-ai/codebase**: Code context and resource management
- **With @tokenring-ai/git**: Pre-commit validation and hooks
- **With @tokenring-ai/code-watch**: File change monitoring for auto-validation

### Best Practices

1. **ESLint Configuration**: Ensure valid `.eslintrc` or `eslint.config.js` in project
2. **Plugin Installation**: Install plugin during application setup
3. **File Extensions**: Validator registered for .js, .mjs, .cjs, .jsx
4. **Performance**: ESLint instance is reused for all validations
5. **Error Handling**: Handle cases where ESLint configuration is missing
6. **TypeScript**: Plan to add TypeScript support for type checking
7. **Formatting**: Consider adding Prettier integration for consistent formatting
8. **Auto-Fix**: Enable auto-fix for safe rules to improve code quality

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/filesystem` 0.2.0 - FileSystemService for file validation
- `eslint` ^10.0.3 - JavaScript linting engine
- `zod` ^4.3.6 - Runtime type validation

### Related Components
- **@tokenring-ai/filesystem**: File operations and validation
- **@tokenring-ai/testing**: Test execution and coverage
- **@tokenring-ai/terminal**: Command execution
- **@tokenring-ai/code-watch**: File system monitoring
- **@tokenring-ai/feedback**: Interactive workflows
- **@tokenring-ai/git**: Version control and pre-commit hooks

### Limitations and Considerations

- **JavaScript Only**: Currently only validates JavaScript files, no TypeScript support
- **No Tools**: No AI tools exposed to agents
- **No Commands**: No chat commands for user interaction
- **No RPC**: No programmatic access for external systems
- **No Formatting**: No code formatting capabilities
- **No Auto-Fix**: No auto-correction of issues
- **No Metrics**: No code quality metrics or reporting
- **No Dependencies**: No dependency analysis
- **No Security**: No security linting
- **No Performance**: No performance linting

---

## Kubernetes Package (@tokenring-ai/kubernetes)

### Overview

The `@tokenring-ai/kubernetes` package provides Kubernetes cluster integration for TokenRing AI agents, enabling AI agents to discover and interact with Kubernetes clusters by listing all accessible API resources, including core and custom resources across namespaces.

### Current Capabilities

#### Supported Features
- **Resource Discovery**: Lists all accessible API resources across core and custom resource groups
- **Multi-Namespace Support**: Discovers resources across all namespaces or specified namespace
- **Authentication Support**: Token-based and client certificate authentication
- **Plugin Integration**: Automatic integration with TokenRing applications
- **Error Handling**: Graceful error handling with detailed error messages
- **Service Architecture**: Built on TokenRing service architecture for seamless agent integration

#### Current Components
- **KubernetesService**: Core service implementation for cluster connection and resource discovery
- **listKubernetesApiResources Tool**: Single tool for listing all API resources
- **Plugin System**: Integration with TokenRing applications
- **Configuration Schema**: Zod-based configuration validation

#### Current Limitations
- **Read-Only Operations**: Currently only discovers and lists resources
- **No CRUD Operations**: Cannot create, update, or delete resources
- **No Chat Commands**: No user-facing CLI-like commands
- **No RPC Endpoints**: No programmatic access for external systems
- **No Logs Access**: Cannot retrieve pod logs or container logs
- **No Exec Support**: Cannot execute commands in containers
- **No Port Forwarding**: No port-forwarding capabilities
- **No Scale Operations**: Cannot scale deployments, replicasets, or statefulsets
- **No Rollout Management**: Cannot manage deployment rollouts or rollbacks
- **No Resource Filtering**: Cannot filter resources by labels, selectors, or fields
- **Single Cluster**: Only supports one cluster at a time
- **No KubeConfig Loading**: No support for loading existing kubeconfig files

See `pkg/kubernetes/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### KubernetesService

The main service class implementing `TokenRingService` for Kubernetes integration.

**Type Signature:**
```typescript
class KubernetesService implements TokenRingService {
  readonly name = "KubernetesService";
  description = "Provides Kubernetes functionality";
  
  constructor(readonly options: ParsedKubernetesServiceConfig);
  
  async listAllApiResourceTypes(agent: Agent): Promise<K8sResourceInfo[]>;
}
```

**Configuration Schema:**
```typescript
const KubernetesServiceConfigSchema = z.object({
  clusterName: z.string(),
  apiServerUrl: z.string(),
  namespace: z.string().default("default"),
  token: z.string().optional(),
  clientCertificate: z.string().optional(),
  clientKey: z.string().optional(),
  caCertificate: z.string().optional(),
});
```

**Interface:**
```typescript
interface K8sResourceInfo {
  group?: string;      // API group (e.g., "apps" or "" for core resources)
  version?: string;    // API version (e.g., "v1")
  kind?: string;       // Resource kind (e.g., "Pod")
  namespace?: string;  // Namespace for namespaced resources
  name?: string;       // Resource name
  error?: string;      // Error message if listing failed
}
```

#### Tool Definition

**Tool Pattern:**
```typescript
interface KubernetesTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent) => Promise<TokenRingToolJSONResult | TokenRingToolTextResult>;
}
```

**Current Tool:**
```typescript
const listKubernetesApiResourcesTool: KubernetesTool<z.ObjectSchema> = {
  name: "kubernetes_listKubernetesApiResources",
  displayName: "Kubernetes/listKubernetesApiResources",
  description: "Lists all instances of all accessible API resource types in the configured Kubernetes cluster.",
  inputSchema: z.object({}),
  execute: async (_args, agent) => {
    const kubernetesService = agent.requireServiceByType(KubernetesService);
    const resources = await kubernetesService.listAllApiResourceTypes(agent);
    const output = JSON.stringify(resources);
    return { type: 'json' as const, data: { output } };
  }
};
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the Kubernetes service and tools with TokenRing applications.

**Plugin Implementation:**
```typescript
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {z} from "zod";
import KubernetesService from "./KubernetesService.ts";
import packageJSON from './package.json' with {type: 'json'};
import {KubernetesServiceConfigSchema} from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  kubernetes: KubernetesServiceConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.kubernetes) {
      app.waitForService(ChatService, chatService =>
        chatService.addTools(tools)
      );
      app.addServices(new KubernetesService(config.kubernetes));
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Enhancement Opportunities

See `pkg/kubernetes/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **CRUD Operations** - Create, get, update, delete operations for core resources (Pods, Deployments, Services, ConfigMaps, Secrets, Namespaces)
2. **Chat Commands System** - Comprehensive CLI-like command system (/k8s status, /k8s list, /k8s get, /k8s create, /k8s delete, etc.)
3. **Logs and Exec** - Retrieve pod logs and execute commands in containers
4. **Scaling Operations** - Scale deployments, statefulsets, and daemonsets
5. **Rollout Management** - Manage deployment rollouts with pause, resume, undo, and history
6. **Resource Filtering** - Filter resources by label selectors and field selectors

#### Medium Priority
7. **Namespace Management** - Full namespace lifecycle management with resource quotas
8. **Event Monitoring** - Monitor cluster events and perform health checks
9. **Multi-Cluster Support** - Support for managing multiple Kubernetes clusters
10. **KubeConfig Loading** - Support for loading existing kubeconfig files
11. **Port Forwarding** - Implement port forwarding capabilities
12. **Service and Ingress** - Manage Kubernetes services and ingress resources

#### Low Priority
13. **Persistent Volume Management** - Manage PVs, PVCs, and StorageClasses
14. **RBAC Management** - Manage roles, role bindings, and service accounts
15. **Job and CronJob** - Manage batch workloads
16. **Network Policy** - Manage network policies for pod networking
17. **HPA and PDB** - Manage autoscaling and disruption budgets
18. **CRD Management** - Manage custom resource definitions and instances
19. **Helm Integration** - Integrate with Helm for package management
20. **Certificate Management** - Manage TLS certificates and secrets

### Integration

#### Plugin Registration

The plugin automatically registers:
- `KubernetesService` - Core service for cluster connection and resource discovery
- `listKubernetesApiResources` - Tool for listing all API resources

#### Integration Opportunities
- **With @tokenring-ai/filesystem**: Load resource definitions from YAML/JSON files
- **With @tokenring-ai/git**: Version control for Kubernetes manifests, GitOps workflows
- **With @tokenring-ai/feedback**: Interactive confirmation for destructive operations
- **With @tokenring-ai/code-watch**: Monitor manifest files for changes, auto-apply configurations
- **With @tokenring-ai/chat**: Chat command system implementation
- **With @tokenring-ai/docker**: Container image management, registry integration
- **With @tokenring-ai/terminal**: Command execution for kubectl-like operations

### Best Practices

1. **Authentication**: Use token-based authentication when possible, rotate tokens regularly
2. **Namespace Scoping**: Specify namespace when possible to limit resource scope
3. **Error Handling**: Handle API errors gracefully with detailed error messages
4. **Security**: Never log sensitive credentials, use environment variables for secrets
5. **RBAC Awareness**: Respect Kubernetes RBAC permissions for operations
6. **Dry-Run**: Use dry-run mode for testing changes before applying
7. **Confirmation**: Implement confirmation workflows for destructive operations
8. **Pagination**: Handle large resource lists with pagination when available

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/agent` 0.2.0 - Agent interface for service integration
- `@tokenring-ai/chat` 0.2.0 - Chat service for tool registration
- `@kubernetes/client-node` ^1.4.0 - Official Kubernetes Node.js client
- `zod` ^4.3.6 - Runtime type validation

### Related Components
- **@tokenring-ai/docker**: Container management and orchestration
- **@tokenring-ai/filesystem**: File operations for manifest management
- **@tokenring-ai/git**: Version control for Kubernetes manifests
- **@tokenring-ai/feedback**: Interactive workflows for operations
- **@tokenring-ai/chat**: Chat commands for user interaction
- **@tokenring-ai/terminal**: Command execution for kubectl operations

### Limitations and Considerations

- **Read-Only**: Currently only discovers and lists resources, no CRUD operations
- **Single Tool**: Only one tool (listKubernetesApiResources) available
- **No Commands**: No chat commands for user interaction
- **No RPC**: No programmatic access for external systems
- **No Logs**: Cannot retrieve pod or container logs
- **No Exec**: Cannot execute commands in containers
- **No Scaling**: Cannot scale deployments or other resources
- **No Rollouts**: Cannot manage deployment rollouts
- **No Filtering**: Cannot filter resources by labels or fields
- **Single Cluster**: Only supports one cluster configuration
- **No KubeConfig**: Cannot load existing kubeconfig files

---

## Memory Package (@tokenring-ai/memory)

### Overview

The `@tokenring-ai/memory` package provides short-term memory management for AI agents within the TokenRing framework. It enables agents to store and recall simple facts or information during a session, maintaining context across interactions without persistent storage. This package uses an agent state slice for memory storage and integrates with the TokenRing agent system via tools, chat commands, context handlers, and scripting functions.

### Current Capabilities

#### Supported Features
- **Memory Storage**: Store and retrieve memories as strings in an ordered list
- **Context Integration**: Memories are automatically injected into agent context for all future interactions
- **Session Management**: Session-scoped storage—memories clear on chat or memory resets
- **Sub-agent Persistence**: Memories can be transferred from parent agents to sub-agents
- **Multiple Interfaces**: Tools and chat commands for programmatic and interactive management
- **State Management**: Built-in state serialization/deserialization for persistence
- **Context Injection**: Automatic injection of memories into agent context via context handlers

#### Current Components
- **ShortTermMemoryService**: Core service implementation for memory management
- **MemoryState**: Agent state slice for storing memories with serialization support
- **memory_add Tool**: Tool to add a memory item to the agent's memory state
- **Memory Commands**: /memory list, add, clear, remove, set commands
- **Context Handler**: short-term-memory context handler for automatic memory injection
- **Scripting Functions**: addMemory() and clearMemory() global functions
- **Plugin System**: Integration with TokenRing applications

#### Current Limitations
- **No Persistent Storage**: Memories are lost when session ends (no database integration)
- **No Memory Categorization**: All memories stored in a flat list without organization
- **No Semantic Search**: Cannot search memories by meaning or relevance
- **No Memory Metadata**: No timestamps, categories, tags, or priority levels
- **No Memory Expiration**: Memories never expire or auto-archive
- **No Memory Summarization**: No automatic summarization of related memories
- **Single Memory Type**: All memories are simple strings, no structured data support
- **No Cross-Agent Sharing**: Memories cannot be shared between independent agents
- **No Memory Versioning**: No history or version tracking for memory changes
- **No Memory Analytics**: No insights into memory usage or patterns
- **No Memory Priority**: All memories treated equally in context injection
- **No Context Optimization**: All memories injected regardless of relevance
- **No Memory Consolidation**: No automatic merging of duplicate or related memories
- **No Memory Templates**: No pre-defined memory structures for common use cases
- **No Memory Export/Import**: No way to backup or transfer memories between sessions

See `pkg/memory/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### ShortTermMemoryService

The main service class implementing memory management for agents.

**Type Signature:**
```typescript
class ShortTermMemoryService implements TokenRingService {
  readonly name = "ShortTermMemoryService";
  description = "Provides Short Term Memory functionality";
  
  attach(agent: Agent): void;
  addMemory(memory: string, agent: Agent): void;
  clearMemory(agent: Agent): void;
  spliceMemory(index: number, count: number, agent: Agent, ...items: string[]): void;
}
```

**Implementation:**
```typescript
import Agent from "@tokenring-ai/agent/Agent";
import {TokenRingService} from "@tokenring-ai/app/types";
import {MemoryState} from "./state/memoryState.ts";

export default class ShortTermMemoryService implements TokenRingService {
  readonly name = "ShortTermMemoryService";
  description = "Provides Short Term Memory functionality";

  attach(agent: Agent): void {
    agent.initializeState(MemoryState, {});
  }

  addMemory(memory: string, agent: Agent): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories.push(memory);
    });
  }

  clearMemory(agent: Agent): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories = [];
    });
  }

  spliceMemory(
    index: number,
    count: number,
    agent: Agent,
    ...items: string[]
  ): void {
    agent.mutateState(MemoryState, (state: MemoryState) => {
      state.memories.splice(index, count, ...items);
    });
  }
}
```

#### MemoryState

An agent state slice for storing memories with serialization support.

**Type Signature:**
```typescript
class MemoryState extends AgentStateSlice<typeof serializationSchema> {
  memories: string[] = [];
  
  constructor({memories = []}: { memories?: string[] } = {});
  reset(): void;
  transferStateFromParent(parent: Agent): void;
  serialize(): z.output<typeof serializationSchema>;
  deserialize(data: z.output<typeof serializationSchema>): void;
  show(): string[];
}
```

**Implementation:**
```typescript
import {Agent} from "@tokenring-ai/agent";
import {AgentStateSlice} from "@tokenring-ai/agent/types";
import {z} from "zod";

const serializationSchema = z.object({
  memories: z.array(z.string())
});

export class MemoryState extends AgentStateSlice<typeof serializationSchema> {
  memories: string[] = [];

  constructor({memories = []}: { memories?: string[] } = {}) {
    super("MemoryState", serializationSchema);
    this.memories = [...memories];
  }

  reset(): void {
    this.memories = [];
  }

  transferStateFromParent(parent: Agent): void {
    const parentState = parent.getState(MemoryState);
    this.deserialize(parentState.serialize());
  }

  serialize(): z.output<typeof serializationSchema> {
    return {
      memories: this.memories,
    };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.memories = data.memories ? [...data.memories] : [];
  }

  show(): string[] {
    return [
      `Memories: ${this.memories.length}`,
      ...this.memories.map((m, i) => `  [${i + 1}] ${m}`)
    ];
  }
}
```

#### Tool Definition

**Tool Pattern:**
```typescript
interface MemoryTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<string>;
}
```

**Current Tool:**
```typescript
const addMemoryTool: MemoryTool<z.ObjectSchema> = {
  name: "memory_add",
  displayName: "Memory/addMemory",
  description: "Add an item to the memory list. The item will be presented in future chats to help keep important information in the back of your mind.",
  inputSchema: z.object({
    memory: z.string().describe("The fact, idea, or info to remember.")
  }),
  execute: async (args, agent) => {
    const memoryService = agent.requireServiceByType(ShortTermMemoryService);
    
    if (!args.memory) {
      throw new Error(`[${name}] Missing parameter: memory`);
    }
    
    memoryService.addMemory(args.memory, agent);
    agent.infoMessage(`[${name}] Added new memory`);
    return "Memory added";
  }
};
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the memory service, tools, commands, and context handlers with TokenRing applications.

**Plugin Implementation:**
```typescript
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {ScriptingService} from "@tokenring-ai/scripting";
import {ScriptingThis} from "@tokenring-ai/scripting/ScriptingService";
import {z} from "zod";

import agentCommands from "./commands.ts";
import contextHandlers from "./contextHandlers.ts";
import packageJSON from "./package.json" with {type: "json"};
import ShortTermMemoryService from "./ShortTermMemoryService.js";
import tools from "./tools.ts";

const packageConfigSchema = z.object({});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(ScriptingService, (scriptingService: ScriptingService) => {
      scriptingService.registerFunction("addMemory", {
          type: 'native',
          params: ['memory'],
          execute(this: ScriptingThis, memory: string): string {
            this.agent.requireServiceByType(ShortTermMemoryService).addMemory(memory, this.agent);
            return `Added memory: ${memory.substring(0, 50)}...`;
          }
        }
      );

      scriptingService.registerFunction("clearMemory", {
          type: 'native',
          params: [],
          execute(this: ScriptingThis): string {
            this.agent.requireServiceByType(ShortTermMemoryService).clearMemory(this.agent);
            return 'Memory cleared';
          }
        }
      );
    });
    app.waitForService(ChatService, chatService => {
      chatService.addTools(tools);
      chatService.registerContextHandlers(contextHandlers);
    });
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(agentCommands)
    );
    app.addServices(new ShortTermMemoryService());
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Enhancement Opportunities

See `pkg/memory/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **Persistent Memory Storage** - Add database-backed persistent storage (SQLite, PostgreSQL, MongoDB, Redis)
2. **Memory Categorization and Organization** - Add categories, tags, and hierarchical organization
3. **Semantic Memory Search** - Implement embedding-based semantic search for intelligent memory retrieval
4. **Memory Metadata and Enrichment** - Add timestamps, priority, source, confidence, entity extraction
5. **Memory Expiration and Auto-Archiving** - Implement memory lifecycle management with expiration policies

#### Medium Priority
6. **Structured Memory Types** - Support for JSON, key-value, list, and reference memory types
7. **Cross-Agent Memory Sharing** - Enable memory sharing and synchronization between independent agents
8. **Memory Versioning and History** - Track memory changes over time with version history
9. **Memory Analytics and Insights** - Provide analytics and insights about memory usage and patterns
10. **Context Optimization and Selective Injection** - Optimize context injection by selecting only relevant memories

#### Low Priority
11. **Memory Consolidation and Deduplication** - Automatically detect and merge duplicate or related memories
12. **Memory Templates and Patterns** - Pre-defined memory structures for common use cases
13. **Memory Export/Import and Backup** - Backup, restore, and transfer memories between sessions
14. **Memory UI and Visualization** - Visual interfaces for memory management and exploration
15. **Advanced Memory Commands** - Enhanced chat command system for memory operations
16. **Memory Tools Enhancement** - Expand tool API for advanced memory operations
17. **Memory Provider Pattern** - Pluggable storage providers for different deployment scenarios
18. **Memory Security and Privacy** - Enhanced security features for sensitive memories
19. **Memory Integration with Other Packages** - Deep integration with existing TokenRing packages
20. **Memory Learning and Adaptation** - AI-powered memory management that learns from usage patterns

### Integration

#### Plugin Registration

The plugin automatically registers:
- `ShortTermMemoryService` - Core service for memory management
- `memory_add` - Tool for adding memories
- `memory` commands - /memory list, add, clear, remove, set
- `short-term-memory` context handler - Automatic memory injection
- `addMemory()` and `clearMemory()` - Scripting functions

#### Integration Opportunities
- **With @tokenring-ai/filesystem**: File operations for memory export/import
- **With @tokenring-ai/chat**: Context injection and memory-enhanced conversations
- **With @tokenring-ai/agent**: State management and sub-agent memory transfer
- **With @tokenring-ai/feedback**: Memory about user preferences and feedback
- **With @tokenring-ai/codebase**: Memory about code structure and patterns
- **With @tokenring-ai/fileIndex**: Cross-reference memories with file content
- **With @tokenring-ai/ghost.io**: Memory about blog posts and content
- **With @tokenring-ai/git**: Memory about commit history and changes
- **With @tokenring-ai/cloudquote**: Memory about financial data and insights

### Best Practices

1. **Memory Relevance**: Add only relevant and useful memories to avoid context noise
2. **Memory Brevity**: Keep memories concise and focused on key information
3. **Memory Organization**: Use categories and tags for better memory management (when implemented)
4. **Memory Privacy**: Avoid storing sensitive or personal information in memories
5. **Memory Review**: Periodically review and clean up outdated or irrelevant memories
6. **Memory Priority**: Use priority levels to ensure important memories are retained (when implemented)
7. **Memory Consolidation**: Merge duplicate or related memories to reduce redundancy (when implemented)
8. **Memory Export**: Regularly backup important memories (when implemented)

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/chat` 0.2.0 - Chat service for tool registration and context handlers
- `@tokenring-ai/agent` 0.2.0 - Agent framework and state management
- `@tokenring-ai/utility` 0.2.0 - Shared utilities and helpers
- `@tokenring-ai/scripting` 0.2.0 - Scripting service for global functions
- `zod` ^4.3.6 - Runtime type validation and serialization

### Related Components
- **@tokenring-ai/chat**: Context injection and conversation management
- **@tokenring-ai/agent**: State management and sub-agent coordination
- **@tokenring-ai/feedback**: User preferences and feedback storage
- **@tokenring-ai/fileIndex**: Cross-reference with file content
- **@tokenring-ai/codebase**: Code structure and pattern memory
- **@tokenring-ai/ghost.io**: Content and blog post memory

### Limitations and Considerations

- **Session-Scoped**: Currently memories are lost when session ends (no persistence)
- **Flat Structure**: All memories stored in a simple list without organization
- **No Search**: Cannot search memories by content or meaning
- **No Metadata**: No timestamps, categories, tags, or priority levels
- **No Expiration**: Memories never expire or auto-archive
- **Simple Strings**: All memories are simple strings, no structured data support
- **No Sharing**: Memories cannot be shared between independent agents
- **No Versioning**: No history or version tracking for memory changes
- **No Analytics**: No insights into memory usage or patterns
- **No Priority**: All memories treated equally in context injection
- **No Optimization**: All memories injected regardless of relevance

---

## Queue Package (@tokenring-ai/queue)

### Overview

The `@tokenring-ai/queue` package provides a work queue management system for TokenRing AI agents, enabling sequential processing of work items with state preservation through checkpointing. This package enables batch processing, task management, and workflow orchestration while maintaining agent state across queue items.

### Current Capabilities

#### Supported Features
- **FIFO Queue Processing**: First-in-first-out queue with enqueue, dequeue, and splice operations
- **State Preservation**: Checkpoint-based state saving and restoration for each queue item
- **Interactive Management**: 11 chat commands for queue operations
- **Programmatic Access**: Single tool (`queue_addTaskToQueue`) for task addition
- **Size Limits**: Optional bounded queue with configurable `maxSize`
- **Processing Workflow**: Start, load, run, skip, done workflow
- **Agent Integration**: Seamless integration with TokenRing agent framework
- **Serialization**: State serialization for persistence across sessions

#### Current Components
- **WorkQueueService**: Core queue management service implementing TokenRingService
- **WorkQueueState**: Agent state slice with serialization support
- **Chat Commands**: `/queue add`, `/queue remove`, `/queue details`, `/queue clear`, `/queue list`, `/queue start`, `/queue next`, `/queue done`, `/queue skip`, `/queue run`
- **Tools**: `queue_addTaskToQueue`
- **Configuration**: Service-level and agent-level configuration via Zod schemas

#### Current Limitations
- **FIFO Only**: No priority-based processing
- **No Persistence**: Queue items lost when session ends (no database integration)
- **No Scheduling**: No delayed or scheduled execution
- **No Dependencies**: No task dependency management
- **No Categories**: No organization with categories or tags
- **No Filtering**: No search or filtering capabilities
- **No Analytics**: No metrics or insights
- **Single Tool**: Only one tool available
- **No Error Handling**: No retry logic or error recovery
- **No Multi-Queue**: Only one queue per agent

See `pkg/queue/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### WorkQueueService

The main service class implementing queue management for agents.

**Type Signature:**
```typescript
class WorkQueueService implements TokenRingService {
  readonly name = "WorkQueueService";
  description = "Provides Work Queue functionality";
  
  constructor(private readonly options: ParsedWorkQueueConfig);
  
  attach(agent: Agent): void;
  startWork(agent: Agent): void;
  stopWork(agent: Agent): void;
  started(agent: Agent): boolean;
  enqueue(item: QueueItem, agent: Agent): boolean;
  dequeue(agent: Agent): QueueItem | undefined;
  get(idx: number, agent: Agent): QueueItem;
  splice(start: number, deleteCount: number, agent: Agent, ...items: QueueItem[]): QueueItem[];
  size(agent: Agent): number;
  isEmpty(agent: Agent): boolean;
  clear(agent: Agent): void;
  getAll(agent: Agent): QueueItem[];
  getCurrentItem(agent: Agent): QueueItem | null;
  setCurrentItem(item: QueueItem | null, agent: Agent): void;
  setInitialCheckpoint(checkpoint: AgentCheckpointData, agent: Agent): void;
  getInitialCheckpoint(agent: Agent): AgentCheckpointData | null;
}
```

**Configuration Schema:**
```typescript
const WorkQueueAgentConfigSchema = z.object({
  maxSize: z.number().positive().optional(),
});

const WorkQueueServiceConfigSchema = z.object({
  agentDefaults: z.object({
    maxSize: z.number().positive().optional(),
  }).prefault({})
});
```

#### WorkQueueState

An agent state slice for managing queue operations with serialization support.

**Type Signature:**
```typescript
class WorkQueueState extends AgentStateSlice<typeof serializationSchema> {
  queue: QueueItem[] = [];
  started = false;
  initialCheckpoint: AgentCheckpointData | null = null;
  currentItem: QueueItem | null = null;
  maxSize: number | null = null;
  
  constructor(readonly initialConfig: z.output<typeof WorkQueueAgentConfigSchema>);
  reset(): void;
  serialize(): z.output<typeof serializationSchema>;
  deserialize(data: z.output<typeof serializationSchema>): void;
  show(): string[];
}
```

**Interface:**
```typescript
interface QueueItem {
  checkpoint: AgentCheckpointData;  // Saved agent state for this item
  name: string;                      // Short description of the task
  input: string;                     // Full prompt/instructions to execute
}
```

#### Tool Definition

**Tool Pattern:**
```typescript
interface QueueTool<TInputSchema> {
  name: string;
  displayName: string;
  description: string;
  inputSchema: TInputSchema;
  execute: (args: z.output<TInputSchema>, agent: Agent): Promise<TokenRingToolJSONResult | string>;
}
```

**Current Tool:**
```typescript
const addTaskToQueueTool: QueueTool<z.ObjectSchema> = {
  name: "queue_addTaskToQueue",
  displayName: "Queue/addTaskToQueue",
  description: "Adds a task to the queue for later execution by the system.",
  inputSchema: z.object({
    description: z.string().describe("A short description of the task to be performed"),
    content: z.string().describe("A natural language string, explaining the exact task to be performed, in great detail.")
  }),
  execute: async (args, agent) => {
    const workQueueService = agent.requireServiceByType(WorkQueueService);
    
    workQueueService.enqueue({
      checkpoint: agent.generateCheckpoint(),
      name: args.description,
      input: args.content
    }, agent);
    
    agent.infoMessage(`[${name}] Added task "${args.description}" to queue`);
    
    return {
      type: "json",
      data: {
        status: "queued",
        message: "Task has been queued for later execution."
      }
    };
  }
};
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the queue service, tools, and commands with TokenRing applications.

**Plugin Implementation:**
```typescript
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {z} from "zod";

import agentCommands from "./commands.ts";
import packageJSON from "./package.json" with {type: "json"};
import {WorkQueueServiceConfigSchema} from "./schema.ts";
import tools from "./tools.ts";
import WorkQueueService from "./WorkQueueService.js";

const packageConfigSchema = z.object({
  queue: WorkQueueServiceConfigSchema.prefault({})
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.waitForService(ChatService, chatService =>
      chatService.addTools(tools)
    );
    app.waitForService(AgentCommandService, agentCommandService =>
      agentCommandService.addAgentCommands(agentCommands)
    );
    app.addServices(new WorkQueueService(config.queue));
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Enhancement Opportunities

See `pkg/queue/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **Priority Queue Support** - Priority levels (1-10) with priority-based sorting and escalation
2. **Advanced Filtering and Search** - Filter by name, content, priority, date range; full-text search
3. **Queue Persistence and Storage** - SQLite, PostgreSQL, MongoDB, Redis storage providers
4. **Task Dependencies and Prerequisites** - Dependency resolution and circular dependency detection
5. **Task Scheduling and Timing** - Delayed, scheduled, and recurring task execution

#### Medium Priority
6. **Queue Categories and Tags** - Organization with categories and multiple tags per item
7. **Queue Metrics and Analytics** - Processing statistics, throughput, success rates
8. **Batch Operations and Bulk Processing** - Bulk add, remove, update, export/import
9. **Queue Templates and Presets** - Save and reuse queue configurations
10. **Notifications and Alerts** - Email, Slack, Telegram notifications for queue events
11. **Queue Monitoring and Health Checks** - Real-time status, health endpoints, webhook integration
12. **Advanced Error Handling and Retry Logic** - Automatic retry with exponential backoff, dead letter queue

#### Low Priority
13. **Multi-Queue Support and Queue Chaining** - Multiple named queues with queue-to-queue workflows
14. **Workflow Orchestration** - Complex workflows with conditional logic and branching
15. **Queue UI and Visualization** - Visual queue viewer, dependency graphs, timeline view
16. **Integration with External Systems** - REST API, GraphQL, webhook triggers
17. **Advanced Security Features** - Item-level encryption, access control, audit logging
18. **Machine Learning Optimization** - Predict optimal processing order, auto-categorization
19. **Collaboration Features** - Shared queues, user assignment, comments
20. **Resource Management** - Resource requirements, resource-aware scheduling

### Integration

#### Plugin Registration

The plugin automatically registers:
- `WorkQueueService` - Core service for queue management
- `queue_addTaskToQueue` - Tool for adding tasks to queue
- `queue` commands - /queue add, remove, details, clear, list, start, next, done, skip, run

#### Integration Opportunities
- **With @tokenring-ai/filesystem**: File operations for queue import/export
- **With @tokenring-ai/chat**: Context injection and queue-enhanced conversations
- **With @tokenring-ai/agent**: State management and checkpoint preservation
- **With @tokenring-ai/memory**: Memory about queue preferences and patterns
- **With @tokenring-ai/feedback**: Notification and alert workflows
- **With @tokenring-ai/escalation**: Escalation workflows for failed items
- **With @tokenring-ai/codebase**: Memory about code structure for queue tasks
- **With @tokenring-ai/git**: Version control for queue templates
- **With @tokenring-ai/cloudquote**: Financial data integration for scheduled tasks

### Best Practices

1. **Queue Item Brevity**: Keep queue item descriptions concise and focused
2. **Checkpoint Management**: Ensure checkpoints are created before adding items
3. **Queue Size Limits**: Configure appropriate maxSize based on use case
4. **State Preservation**: Use `/queue start` to preserve initial state before processing
5. **Error Handling**: Implement retry logic for critical tasks (when implemented)
6. **Queue Monitoring**: Regularly check queue status and metrics (when implemented)
7. **Item Organization**: Use categories and tags for better management (when implemented)
8. **Queue Cleanup**: Periodically review and clear completed or outdated items

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/chat` 0.2.0 - Chat service for tool registration and commands
- `@tokenring-ai/agent` 0.2.0 - Agent framework and state management
- `@tokenring-ai/utility` 0.2.0 - Shared utilities including deepMerge
- `zod` ^4.3.6 - Runtime type validation and serialization

### Related Components
- **@tokenring-ai/agent**: State management and checkpoint preservation
- **@tokenring-ai/chat**: Command execution and tool registration
- **@tokenring-ai/memory**: Memory for queue preferences
- **@tokenring-ai/feedback**: Notification workflows
- **@tokenring-ai/escalation**: Escalation for failed items

### Limitations and Considerations

- **FIFO Only**: Currently processes items in first-in-first-out order, no priority support
- **Session-Scoped**: Queue items lost when session ends (no persistence)
- **No Scheduling**: No delayed or scheduled execution
- **No Dependencies**: No task dependency management
- **No Categories**: No organization with categories or tags
- **No Filtering**: No search or filtering capabilities
- **No Analytics**: No metrics or insights
- **Single Tool**: Only one tool (queue_addTaskToQueue) available
- **No Error Handling**: No retry logic or error recovery
- **No Multi-Queue**: Only one queue per agent

---

## Testing Package (@tokenring-ai/testing)

### Overview

The `@tokenring-ai/testing` package provides automated testing capabilities for AI agents within the TokenRing ecosystem. It enables automated and manual testing of codebases with seamless integration into agent workflows, including auto-repair capabilities when tests fail.

### Current Capabilities

#### Supported Features
- **Testing Resources**: Pluggable components for defining and running tests (shell commands, custom resources)
- **Service Layer**: Central `TestingService` for managing and executing tests across resources
- **Chat Commands**: Interactive `/test` command for manual control
- **Automation Hooks**: Automatic test execution after file modifications
- **Configuration-Based Setup**: Declarative resource configuration through plugin system
- **State Management**: Checkpoint-based state preservation during repair workflows
- **Auto-Repair**: Automatic error detection and repair suggestions when tests fail

#### Current Components
- **TestingService**: Core service implementation for test management
- **TestingResource Interface**: Base interface for custom test implementations
- **ShellCommandTestingResource**: Concrete implementation for shell command tests
- **Test Commands**: `/test list` and `/test run` for interactive test management
- **Auto-Test Hook**: Automatically runs tests after file modifications
- **TestingState**: State management for test results and repair counts
- **Plugin System**: Integration with TokenRing applications

#### Current Limitations
- **Single Resource Type**: Only shell command execution is supported
- **No Test Discovery**: Tests must be manually configured, no automatic discovery
- **Limited Output**: Basic pass/fail status with truncated output
- **No Parallel Execution**: Tests run sequentially
- **No Test Categories**: Cannot organize tests by type (unit, integration, e2e)
- **No Coverage Reporting**: No code coverage metrics or reporting
- **No Test Filtering**: Limited pattern matching for test selection
- **No Retry Logic**: No automatic retry for flaky tests
- **No Test Reporting**: No detailed reports, summaries, or analytics
- **No Integration**: Limited integration with popular testing frameworks
- **No Mocking**: No mocking or stubbing capabilities
- **No Environment Management**: No test environment configuration
- **No CI/CD Integration**: No integration with CI/CD pipelines
- **No Test Data Management**: No test data setup/teardown
- **No Performance Testing**: No performance or load testing support

See `pkg/testing/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### TestingService

The main service class implementing test management for agents.

**Type Signature:**
```typescript
class TestingService implements TokenRingService {
  readonly name = "TestingService";
  description = "Provides testing functionality";
  
  private testRegistry = new KeyedRegistry<TestingResource>();
  
  registerResource = this.testRegistry.register;
  getAvailableResources = this.testRegistry.getAllItemNames;
  
  constructor(readonly options: z.output<typeof TestingServiceConfigSchema>);
  
  attach(agent: Agent): void;
  runTests(likeName: string, agent: Agent): Promise<void>;
  allTestsPassed(agent: Agent): boolean;
}
```

**Configuration Schema:**
```typescript
const TestingServiceConfigSchema = z.object({
  agentDefaults: z.object({
    maxAutoRepairs: z.number().default(5)
  }).prefault({}),
  resources: z.record(z.string(), z.any()).optional()
}).strict().prefault({});
```

**Interface:**
```typescript
interface TestResult {
  status: "passed" | "failed" | "timeout" | "error";
  startedAt: number;
  finishedAt: number;
  output?: string;
  error?: string;
}
```

#### TestingResource Interface

Base interface for implementing custom test resources.

**Type Signature:**
```typescript
interface TestingResource {
  description: string;
  runTest: (agent: Agent) => Promise<TestResult>;
}
```

#### ShellCommandTestingResource

Concrete implementation for running shell commands as tests.

**Type Signature:**
```typescript
class ShellCommandTestingResource implements TestingResource {
  description = "Provides ShellCommandTesting functionality";
  
  constructor(private readonly options: z.output<typeof shellCommandTestingConfigSchema>);
  
  async runTest(agent: Agent): Promise<TestResult>;
}
```

**Configuration Schema:**
```typescript
const shellCommandTestingConfigSchema = z.object({
  type: z.literal("shell"),
  name: z.string(),
  description: z.string().optional(),
  workingDirectory: z.string().optional(),
  command: z.string(),
  timeoutSeconds: z.number().default(120),
  cropOutput: z.number().default(10000)
});
```

#### Test Commands

**Command Pattern:**
```typescript
interface TestingCommand {
  name: string;
  description: string;
  execute: (remainder: string, agent: Agent): Promise<string>;
  help: string;
}
```

**Current Commands:**
```typescript
// /test list - List available tests
const testListCommand: TestingCommand = {
  name: "test list",
  description: "List available tests",
  help: `# /test list\n\nShow all available tests.\n\n## Example\n\n/test list`,
  execute: async (_remainder: string, agent: Agent): Promise<string> => {
    const available = Array.from(agent.requireServiceByType(TestingService).getAvailableResources());
    return available.length === 0 ? "No tests available." : "Available tests:\n" + available.map(n => ` - ${n}`).join('\n');
  },
};

// /test run - Run tests
const testRunCommand: TestingCommand = {
  name: "test run",
  description: "Run tests",
  help: `# /test run [test_name]\n\nRun a specific test or all tests. If tests fail, the agent may offer to automatically repair the issues.\n\n## Example\n\n/test run\n/test run userAuth`,
  execute: async (remainder: string, agent: Agent): Promise<string> => {
    await agent.requireServiceByType(TestingService).runTests(remainder?.trim() || "*", agent);
    return "Tests executed";
  },
};
```

#### Testing Hook

**Hook Pattern:**
```typescript
interface TestingHook {
  name: string;
  displayName: string;
  description: string;
  callbacks: HookCallback[];
}
```

**Current Hook:**
```typescript
const autoTestHook: TestingHook = {
  name: "autoTest",
  displayName: "Testing/Auto Test",
  description: "Runs tests automatically after chat is complete",
  callbacks: [
    new HookCallback(AfterAgentInputSuccess, async (_data, agent) => {
      const filesystem = agent.requireServiceByType(FileSystemService);
      const testingService = agent.requireServiceByType(TestingService);
      
      if (filesystem.isDirty(agent)) {
        agent.infoMessage("Working Directory was updated, running test suite...");
        await testingService.runTests("*", agent);
      }
    })
  ]
};
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the testing service, commands, and hooks with TokenRing applications.

**Plugin Implementation:**
```typescript
import {AgentCommandService} from "@tokenring-ai/agent";
import {TokenRingPlugin} from "@tokenring-ai/app";
import {AgentLifecycleService} from "@tokenring-ai/lifecycle";
import {z} from "zod";

import agentCommands from "./commands.ts";
import hooks from "./hooks.ts";
import packageJSON from "./package.json" with {type: "json"};
import {shellCommandTestingConfigSchema, TestingServiceConfigSchema} from "./schema.ts";
import ShellCommandTestingResource from "./ShellCommandTestingResource.ts";
import TestingService from "./TestingService.ts";

const packageConfigSchema = z.object({
  testing: TestingServiceConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.testing) {
      app.waitForService(AgentCommandService, agentCommandService =>
        agentCommandService.addAgentCommands(agentCommands)
      );
      app.waitForService(AgentLifecycleService, lifecycleService =>
        lifecycleService.addHooks(hooks)
      );
      const testingService = new TestingService(config.testing);
      app.addServices(testingService);

      if (config.testing.resources) {
        for (const name in config.testing.resources) {
          const testingConfig = config.testing.resources[name];
          switch (testingConfig.type) {
            case "shell":
              testingService.registerResource(
                name,
                new ShellCommandTestingResource(shellCommandTestingConfigSchema.parse(testingConfig)),
              );
              break;
          }
        }
      }
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Enhancement Opportunities

See `pkg/testing/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **Test Framework Integrations** - Native support for Vitest, Jest, Mocha, Playwright, Cypress
2. **Test Discovery and Auto-Configuration** - Automatic test file discovery and framework detection
3. **Test Coverage Integration** - Coverage collection, reporting, and analysis
4. **Advanced Test Filtering** - Pattern-based filtering, smart test selection, test categories
5. **Parallel Test Execution** - Concurrent test execution with test sharding

#### Medium Priority
6. **Flaky Test Detection and Management** - Automatic detection, retry logic, flaky test quarantine
7. **Test Reporting and Analytics** - Detailed reports, analytics dashboard, failure analysis
8. **Test Environment Management** - Environment profiles, container-based testing, database management
9. **Test Data Management** - Fixture management, test data generation, data cleanup
10. **Performance and Load Testing** - Performance tests, load testing, performance reporting

#### Low Priority
11. **Mocking and Stubbing** - Function mocking, API mocking, mock management
12. **Visual Regression Testing** - Screenshot testing, visual regression detection
13. **Accessibility Testing** - A11y audits, WCAG compliance checking
14. **Security Testing** - Security scans, vulnerability detection, compliance reporting
15. **AI-Powered Test Generation** - Automatic test generation, test improvement suggestions

### Integration

#### Plugin Registration

The plugin automatically registers:
- `TestingService` - Core service for test management
- `/test list` and `/test run` - Commands for interactive test management
- `autoTest` hook - Automatic test execution after file modifications
- `TestingState` - State management for test results and repair counts

#### Integration Opportunities
- **With @tokenring-ai/filesystem**: File operations for test artifacts and snapshots
- **With @tokenring-ai/chat**: Context injection and test-enhanced conversations
- **With @tokenring-ai/agent**: State management and checkpoint preservation
- **With @tokenring-ai/terminal**: Command execution for test runners
- **With @tokenring-ai/git**: Pre-commit test hooks, test results in commits
- **With @tokenring-ai/codebase**: Code context for intelligent test suggestions
- **With @tokenring-ai/feedback**: Interactive test failure review and approval
- **With @tokenring-ai/queue**: Queue-based test execution and batch processing
- **With @tokenring-ai/javascript**: Test coverage integration and code quality

### Best Practices

1. **Test Configuration**: Ensure valid test framework configuration in project
2. **Plugin Installation**: Install plugin during application setup
3. **Resource Configuration**: Configure test resources declaratively in plugin config
4. **Auto-Repair**: Configure appropriate maxAutoRepairs limit to prevent infinite loops
5. **Test Isolation**: Ensure tests are isolated and don't depend on test order
6. **Test Output**: Configure appropriate output truncation for large test suites
7. **Timeout Settings**: Set appropriate timeout values for long-running tests
8. **Working Directory**: Specify correct working directory for test execution

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/chat` 0.2.0 - Chat service integration
- `@tokenring-ai/agent` 0.2.0 - Agent framework and command system
- `@tokenring-ai/filesystem` 0.2.0 - File system operations
- `@tokenring-ai/lifecycle` 0.2.0 - Lifecycle and hook management
- `@tokenring-ai/terminal` 0.2.0 - Terminal service for shell execution
- `@tokenring-ai/queue` 0.2.0 - Queue service for task management
- `@tokenring-ai/utility` 0.2.0 - Utility classes and helpers
- `glob-gitignore` ^1.0.15 - Gitignore pattern support
- `zod` ^4.3.6 - Runtime type validation

### Related Components
- **@tokenring-ai/filesystem**: File operations and shell command execution
- **@tokenring-ai/terminal**: Command execution for test runners
- **@tokenring-ai/git**: Version control and pre-commit hooks
- **@tokenring-ai/feedback**: Interactive test failure review
- **@tokenring-ai/queue**: Queue-based test execution
- **@tokenring-ai/javascript**: Code quality and test coverage

### Limitations and Considerations

- **Shell Only**: Currently only shell command execution is supported
- **No Discovery**: Tests must be manually configured
- **Sequential Execution**: Tests run one at a time, no parallelism
- **Basic Reporting**: Limited test result reporting and analytics
- **No Coverage**: No code coverage collection or reporting
- **No Framework Integration**: Limited integration with popular test frameworks
- **No Retry**: No automatic retry for flaky tests
- **No Categories**: No test categorization or filtering
- **No Environment**: No test environment management
- **No CI/CD**: No CI/CD pipeline integration

---

## AI Client Package (@tokenring-ai/ai-client)

[Content continues from previous file...]

---

## Serper Package (@tokenring-ai/serper)

### Overview

The `@tokenring-ai/serper` package provides Google Search and News capabilities through the Serper API for TokenRing AI agents. It extends the `@tokenring-ai/websearch` module to enable seamless integration with TokenRing agents and applications for real-time web searches, news articles, and web page content extraction.

### Current Capabilities

#### Supported Features
- **Google Search Integration**: Perform organic web searches with knowledge graphs, related searches, and "people also ask" results
- **Google News Search**: Access real-time news articles with source, date, and snippet information
- **Web Page Fetching**: Extract markdown content and metadata from web pages using Serper's scraping service
- **Location-Based Search**: Support for geographic targeting through `gl` and `location` parameters
- **Language Support**: Multi-language search capabilities through `hl` parameter
- **Plugin Architecture**: Automatic registration with TokenRing applications via websearch service
- **Retry Logic**: Built-in retry mechanism with exponential backoff via `doFetchWithRetry`
- **Type Safety**: Full TypeScript support with Zod schema validation
- **Comprehensive Error Handling**: Detailed error messages with hints for common issues

#### Current Components
- **SerperWebSearchProvider**: Core provider implementation extending `WebSearchProvider`
- **Plugin System**: Integration with TokenRing applications via websearch service
- **Type Definitions**: Comprehensive TypeScript types for requests and responses
- **Configuration Schemas**: Zod-based configuration validation

#### Current Limitations
- **No Chat Commands**: No user-facing CLI-like commands for direct search operations
- **No AI Tools**: No tools directly exposed to AI agents for programmatic search
- **No RPC Endpoints**: No programmatic access for external systems and integrations
- **Limited News Date Control**: News search hardcoded to last hour (`tbs: "qdr:h"`)
- **No Search History**: No tracking or caching of previous searches
- **No Result Caching**: No built-in caching mechanism for repeated queries
- **No Advanced Filtering**: Limited filtering options beyond basic parameters
- **No Search Analytics**: No metrics or insights about search usage
- **No Batch Operations**: No support for multiple simultaneous searches
- **No Extended Endpoints**: No Images, Shopping, Videos, Places, Code, Academic, Twitter, or Reddit search

See `pkg/serper/BRAINSTORM.md` for comprehensive enhancement opportunities.

### Core Components

#### SerperWebSearchProvider

The main provider class implementing `WebSearchProvider` for Serper API integration.

**Type Signature:**
```typescript
class SerperWebSearchProvider extends WebSearchProvider {
  constructor(config: SerperWebSearchProviderOptions);
  
  async searchWeb(query: string, options?: WebSearchProviderOptions): Promise<WebSearchResult>;
  async searchNews(query: string, options?: WebSearchProviderOptions): Promise<NewsSearchResult>;
  async fetchPage(url: string, options?: WebPageOptions): Promise<WebPageResult>;
}
```

**Configuration Schema:**
```typescript
const SerperDefaultsSchema = z.object({
  gl: z.string().optional(),
  hl: z.string().optional(),
  location: z.string().optional(),
  num: z.number().optional(),
  page: z.number().optional(),
});

const SerperWebSearchProviderOptionsSchema = z.object({
  apiKey: z.string(),
  defaults: SerperDefaultsSchema.optional(),
});
```

**Interface:**
```typescript
interface SerperSearchResponse {
  searchParameters: SerperSearchParameters;
  knowledgeGraph?: SerperKnowledgeGraph;
  organic: SerperOrganicResult[];
  peopleAlsoAsk?: SerperPeopleAlsoAsk[];
  relatedSearches?: SerperRelatedSearch[];
}

interface SerperNewsResponse {
  searchParameters: SerperSearchParameters;
  news: SerperNewsResult[];
  credits?: number;
}

interface SerperPageResponse {
  text: string;
  markdown: string;
  metadata: {
    title?: string;
    description?: string;
    "og:title"?: string;
    "og:description"?: string;
    "og:url"?: string;
    "og:image"?: string;
    "og:type"?: string;
    "og:site_name"?: string;
    [key: string]: any;
  };
  credits?: number;
}
```

#### Plugin

The package exports a default `TokenRingPlugin` that registers the Serper provider with TokenRing applications via the websearch service.

**Plugin Implementation:**
```typescript
import {TokenRingPlugin} from "@tokenring-ai/app";
import {WebSearchConfigSchema, WebSearchService} from "@tokenring-ai/websearch";
import {z} from "zod";
import packageJSON from './package.json' with {type: 'json'};
import SerperWebSearchProvider, {SerperWebSearchProviderOptionsSchema} from "./SerperWebSearchProvider.js";

const packageConfigSchema = z.object({
  websearch: WebSearchConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.websearch) {
      app.waitForService(WebSearchService, cdnService => {
        for (const name in config.websearch!.providers) {
          const provider = config.websearch!.providers[name];
          if (provider.type === "serper") {
            cdnService.registerProvider(name, new SerperWebSearchProvider(SerperWebSearchProviderOptionsSchema.parse(provider)));
          }
        }
      });
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
```

### Enhancement Opportunities

See `pkg/serper/BRAINSTORM.md` for detailed brainstormed features including:

#### High Priority
1. **Chat Commands System** - Comprehensive CLI-like command system (/serper search, /serper news, /serper fetch, /serper images, etc.)
2. **AI Tools Suite** - Tools for AI agents (googleSerpSearch, googleNewsSearch, fetchWebPage, deepSearch)
3. **RPC Endpoints** - Programmatic access for external systems
4. **Extended Serper Endpoints** - Images, Shopping, Videos, Places search
5. **Search Caching & History** - Intelligent caching and search history management

#### Medium Priority
6. **Advanced Search Features** - Date range filtering, reranking, search suggestions
7. **Batch & Parallel Operations** - Multiple simultaneous searches
8. **Search Analytics & Monitoring** - Usage insights and metrics
9. **Result Enhancement & Processing** - Summarization, entity extraction, topic clustering
10. **Integration with Other Packages** - Deep integration with TokenRing ecosystem

#### Low Priority
11. **Serper Specialized Endpoints** - Code, Academic, Twitter, Reddit search
12. **Advanced Caching Strategies** - Multi-level caching with Redis, disk
13. **Search Optimization & Token Efficiency** - Optimize for AI context
14. **UI/UX Enhancements** - Interactive CLI, result formatting
15. **Testing & Quality Assurance** - Comprehensive testing infrastructure
16. **Security & Privacy** - Enhanced security features
17. **Developer Experience** - SDK enhancements, documentation
18. **Performance Optimization** - Connection pooling, request batching
19. **Enterprise Features** - Multi-tenant, quotas, billing
20. **Future-Proofing** - Plugin system, extensible architecture

### Integration

#### Plugin Registration

The plugin automatically registers:
- `SerperWebSearchProvider` - Core provider for Serper API integration

#### Integration Opportunities
- **With @tokenring-ai/websearch**: Base web search provider interface and service
- **With @tokenring-ai/agent**: Agent tool integration for search operations
- **With @tokenring-ai/chat**: Chat service for tools and commands
- **With @tokenring-ai/fileIndex**: Index search results for later retrieval
- **With @tokenring-ai/memory**: Store search preferences and patterns
- **With @tokenring-ai/feedback**: Request user feedback on search results
- **With @tokenring-ai/queue**: Queue-based search processing
- **With @tokenring-ai/escalation**: Escalate for insufficient results
- **With @tokenring-ai/utility**: HTTP utilities and object manipulation

### Best Practices

1. **API Key Security**: Store Serper API key in environment variables
2. **Rate Limiting**: Implement appropriate delays between requests
3. **Caching**: Consider caching repeated search queries
4. **Error Handling**: Always handle potential errors from search operations
5. **Configuration Defaults**: Set reasonable default values for search parameters
6. **Timeout Management**: Configure appropriate timeouts for page fetching
7. **Query Validation**: Validate search queries before sending to API
8. **Result Processing**: Handle cases where results may be empty

### Dependencies

The package depends on the following core packages:
- `@tokenring-ai/app` 0.2.0 - Application framework and plugin system
- `@tokenring-ai/agent` 0.2.0 - Agent framework
- `@tokenring-ai/websearch` 0.2.0 - Web search provider base class
- `@tokenring-ai/utility` 0.2.0 - Utility functions (doFetchWithRetry, pick)
- `zod` ^4.3.6 - Runtime type validation

### Related Components
- **@tokenring-ai/websearch**: Web search provider interface and service
- **@tokenring-ai/agent**: Agent orchestration system
- **@tokenring-ai/chat**: Chat service for tools and commands
- **@tokenring-ai/fileIndex**: Search result indexing
- **@tokenring-ai/memory**: Memory for search preferences
- **@tokenring-ai/feedback**: Interactive feedback workflows
- **@tokenring-ai/queue**: Queue-based search processing
- **@tokenring-ai/escalation**: Escalation for insufficient results
- **@tokenring-ai/utility**: Shared utilities and helpers

### Limitations and Considerations

- **No Chat Commands**: No user-facing CLI-like commands
- **No AI Tools**: No tools directly exposed to AI agents
- **No RPC Endpoints**: No programmatic access for external systems
- **Limited News Date**: News search hardcoded to last hour
- **No Search History**: No tracking of previous searches
- **No Caching**: No built-in caching for repeated queries
- **No Extended Endpoints**: No Images, Shopping, Videos, Places, Code, Academic, Twitter, Reddit
- **No Batch Operations**: No support for multiple simultaneous searches
- **No Analytics**: No metrics or insights about search usage

