# TokenRing AI - External Service Integrations Knowledge Repository

This file maintains knowledge about third-party integrations, APIs, webhooks, and external service connections in the TokenRing project.

## Base Project Overview

### Project Structure
- **PACKAGES.md**: Contains project package definitions and dependencies (30+ @tokenring-ai/* packages)
- **README.md**: Main project documentation

### Key Integration Packages

Based on PACKAGES.md analysis, the following are the primary external service integration packages:

1. **@tokenring-ai/websearch** (0.1.0): Abstract web search interface with pluggable providers
2. **@tokenring-ai/serper** (0.1.0): Serper.dev API integration for Google web/news search
3. **@tokenring-ai/scraperapi** (0.1.0): ScraperAPI integration for web scraping, Google SERP/news
4. **@tokenring-ai/aws** (0.1.0): AWS integration with STS/S3 clients, authentication
5. **@tokenring-ai/mcp** (0.1.0): MCP (Model Context Protocol) client for external server connections

## Discovered Integration Patterns

### 1. Web Search Integration Pattern

#### Abstract Provider Architecture
- **Base**: `@tokenring-ai/websearch` provides abstract `WebSearchProvider` interface
- **Implementations**: Multiple concrete providers (Serper, ScraperAPI) extend the base
- **Service Layer**: `WebSearchService` manages providers with `KeyedRegistryWithSingleSelection`
- **Plugin Integration**: Each package exports a `TokenRingPlugin` with install/start lifecycle

#### Standardized Interfaces
```typescript
// Common provider interface
interface WebSearchProvider {
  searchWeb(query: string, options?: WebSearchProviderOptions): Promise<WebSearchResult>
  searchNews(query: string, options?: WebSearchProviderOptions): Promise<NewsSearchResult>
  fetchPage(url: string, options?: WebPageOptions): Promise<WebPageResult>
}
```

#### Provider-Specific Implementations

**Serper Integration**:
- Direct Google Search API proxy via serper.dev
- Supports location-based searches (gl, location parameters)
- Handles authentication via API key
- Maps options to Serper-specific parameters

**ScraperAPI Integration**:
- Google SERP and News search via ScraperAPI
- Supports JavaScript rendering and geotargeting
- Country-specific searches and custom TLDs
- Robust error handling with retry logic

### 2. External Service Integration Pattern

#### AWS Service Integration
- **Service-Based Architecture**: `AWSService` manages AWS SDK clients
- **Credential Management**: Secure handling of access keys, secret keys, session tokens
- **Client Initialization**: Lazy initialization of STS and S3 clients
- **Authentication Status**: Real-time authentication checking and status reporting

#### Key Features:
- Environment variable support for credentials
- Region-based configuration
- Tool integration (`listS3Buckets`)
- Chat commands (`aws status`)

### 3. Protocol Integration Pattern

#### MCP (Model Context Protocol) Integration
- **Transport Support**: stdio, SSE, HTTP transports for external connections
- **Automatic Tool Registration**: MCP server tools automatically registered with agents
- **Plugin Architecture**: Seamless integration with TokenRing plugin system
- **Dynamic Discovery**: Tools discovered and registered at runtime

#### Transport Configurations:
```typescript
// Stdio transport
{ type: 'stdio' }

// SSE transport  
{ type: 'sse', url: 'http://localhost:3000/sse' }

// HTTP transport
{ type: 'http', url: 'http://localhost:3000/mcp' }
```

## Integration Connection Strategies

### 1. Plugin-Based Architecture

All integration packages follow a consistent plugin pattern:

```typescript
export default {
  name: "@tokenring-ai/package-name",
  version: "0.1.0",
  description: "Package description",
  install(app: TokenRingApp): void {
    // Register services, tools, commands
  },
  start(app: TokenRingApp): void {
    // Initialize active providers, start services
  }
} satisfies TokenRingPlugin
```

### 2. Service Registry Pattern

- **Centralized Management**: `@tokenring-ai/agent` acts as service registry hub
- **Keyed Registries**: Services registered with string keys for easy lookup
- **Single Selection**: Some registries support single active provider at a time
- **Dynamic Registration**: Tools and services registered at runtime

### 3. Tool Integration Pattern

- **Standardized Tools**: Each service exports standardized tools
- **Input Validation**: Zod schemas for tool input validation
- **Agent Integration**: Tools seamlessly available to agents
- **Chat Commands**: Interactive commands for manual usage

### 4. Configuration Pattern

- **Schema Validation**: Zod schemas for configuration validation
- **Environment Support**: API keys and credentials via environment variables
- **Flexible Options**: Per-request overrides for provider-specific options
- **Default Values**: Sensible defaults for optional parameters

## External Service Orchestration

### 1. Web Search Orchestration

**Search Flow**:
1. User requests search via agent tool or chat command
2. `WebSearchService` delegates to active provider
3. Provider makes external API call (Serper/ScraperAPI)
4. Results normalized and returned to agent
5. Agent processes results for user

**Error Handling**:
- Retry logic via `doFetchWithRetry` utility
- Rate limit handling with exponential backoff
- Authentication error detection and hints
- Structured error responses

### 2. AWS Service Orchestration

**Authentication Flow**:
1. Credential validation on service initialization
2. Lazy client creation when needed
3. Real-time status checking via STS `GetCallerIdentity`
4. Service health monitoring

**Tool Execution**:
1. Agent requests AWS tool execution
2. Tool validates inputs via Zod schema
3. AWS SDK client performs operation
4. Results formatted and returned to agent

### 3. MCP Orchestration

**Connection Flow**:
1. Plugin reads transport configuration
2. Appropriate MCP transport created (stdio/SSE/HTTP)
3. Connection established to external MCP server
4. Server tools discovered and registered
5. Tools available to all agents

**Runtime Discovery**:
- Dynamic tool registration as servers connect
- Tool namespaced by server name (`serverName/toolName`)
- Automatic cleanup on disconnect

## Integration Workflows

### 1. Research Workflow (Web Search)
```
User Query → Agent → WebSearch Tool → WebSearchService → Provider → External API → Normalized Results → Agent Processing → User Response
```

### 2. Cloud Operations Workflow (AWS)
```
User Query → Agent → AWS Tool → AWSService → AWS SDK Client → AWS API → Formatted Results → Agent Processing → User Response
```

### 3. External Tool Access Workflow (MCP)
```
Agent Request → MCP Tool → MCPTransport → External MCP Server → Tool Execution → Results → Agent Processing → User Response
```

## Key Integration Strategies

### 1. Abstraction Layers
- Abstract interfaces hide provider-specific details
- Common result types across all implementations
- Standardized error handling patterns

### 2. Plugin System
- Consistent installation and startup lifecycle
- Automatic service registration
- Hot-swappable providers

### 3. Configuration Management
- Environment-based credential handling
- Schema-validated configuration
- Provider-specific option mapping

### 4. Error Resilience
- Retry logic with exponential backoff
- Structured error responses
- Graceful degradation

### 5. Performance Optimization
- Lazy client initialization
- Connection pooling where applicable
- Result caching strategies

_(Knowledge will be accumulated here as the agent learns about the codebase)_