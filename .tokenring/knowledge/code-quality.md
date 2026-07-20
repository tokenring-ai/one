# Code Quality Standards and Patterns

This document defines the code quality standards, patterns, and best practices used in the Token Ring AI codebase.

---

## Table of Contents

1. [Architecture Patterns](#architecture-patterns)
2. [Type Safety and Validation](#type-safety-and-validation)
3. [Error Handling](#error-handling)
4. [Security Best Practices](#security-best-practices)
5. [Performance Guidelines](#performance-guidelines)
6. [Frontend Standards](#frontend-standards)
7. [Code Organization](#code-organization)
8. [Testing Requirements](#testing-requirements)
9. [Documentation Standards](#documentation-standards)

---

## Architecture Patterns

### Provider-Based Abstraction

The codebase uses a provider-based architecture for extensible services:

```typescript
// Define the provider interface
export interface EmailProvider {
  description: string;
  listBoxes(): Promise<EmailBox[]>;
  getMessages(filter: EmailMessageQueryOptions): Promise<EmailMessagePage>;
  // ... other methods
}

// Central service for provider management
class EmailService implements TokenRingService {
  private providers = new KeyedRegistry<EmailProvider>();
  
  registerEmailProvider = this.providers.set;
  getAvailableProviders = this.providers.keysArray;
  requireEmailProvider = this.providers.require;
}
```

**Key Principles:**

- Define clear interfaces for pluggable components
- Use registry patterns for component management
- Centralize orchestration in service classes
- Maintain separation between interface and implementation

### Service Layer Pattern

Services orchestrate operations across providers:

```typescript
class EmailService {
  async getMessages(filter: EmailMessageQueryOptions, agent: Agent): Promise<EmailMessagePage> {
    return this.requireActiveEmailProvider(agent).getMessages(filter);
  }
}
```

### Agent-Scoped State Management

State is managed at the agent level with serialization support:

```typescript
class EmailState extends AgentStateSlice<typeof serializationSchema> {
  activeProvider: string | undefined;
  currentEmail: EmailMessage | undefined;
  processedEmails = new Set<string>();
  
  serialize(): z.output<typeof serializationSchema> {
    return { activeProvider, currentEmail, processedEmails: Array.from(this.processedEmails) };
  }
  
  deserialize(data: z.output<typeof serializationSchema>): void {
    this.processedEmails = new Set(data.processedEmails ?? []);
  }
}
```

---

## Type Safety and Validation

### Zod Schema-First Design

All data structures are defined with Zod schemas first, then types are inferred:

```typescript
// Define schema
export const EmailMessageSchema = z.object({
  id: z.string(),
  subject: z.string(),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  receivedAt: z.coerce.date(),
});

// Infer type
export type EmailMessage = z.infer<typeof EmailMessageSchema>;
```

**Best Practices:**

- Always define schemas before types
- Use `z.infer` for type inference
- Validate all external inputs
- Use `exactOptional()` for optional fields to distinguish `undefined` from missing

### RPC Schema Definition

RPC endpoints use discriminated unions for result types:

```typescript
result: z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    draft: EmailDraftSchema,
    message: z.string(),
  }),
  AgentNotFoundSchema,
])
```

---

## Error Handling

### Command Errors

Use `CommandFailedError` for CLI command failures:

```typescript
import { CommandFailedError } from "@tokenring-ai/agent/AgentError";

function execute({ positionals, agent }) {
  if (!providerName) throw new CommandFailedError("Usage: /email provider set <name>");
}
```

### RPC Error Handling

Use discriminated unions for RPC results:

```typescript
async createDraft(args, app) {
  const agent = app.requireService(AgentManager).getAgent(args.agentId);
  if (!agent) {
    return { status: "agentNotFound" };
  }
  // ... success case
  return { status: "success", draft, message: `Created draft: ${draft.id}` };
}
```

### Background Task Error Handling

Always wrap background tasks in try-catch:

```typescript
agent.runBackgroundTask(async signal => {
  while (!signal.aborted) {
    try {
      await this.checkForNewEmails(watch, agent);
      await delay(this.options.pollInterval, null, { signal });
    } catch (error: unknown) {
      agent.errorMessage(`Error while checking for new emails: ${error as Error}`);
    }
  }
});
```

**Important:** Never silently swallow errors. At minimum, log them.

---

## Security Best Practices

### Input Validation

- Validate all inputs with Zod schemas
- Use `.email()` for email fields
- Sanitize user-provided data before use

### XSS Prevention

When rendering HTML content:

```typescript
// UNSAFE - avoid this
<iframe srcDoc={msg.htmlBody} sandbox="allow-same-origin" />

// SAFE - use sanitization or stricter sandbox
<iframe srcDoc={sanitizeHtml(msg.htmlBody)} sandbox="allow-same-origin allow-scripts" />
```

**Recommendations:**

- Sanitize HTML before rendering
- Use strict CSP headers
- Avoid `allow-scripts` when possible

### Regex Security

When using user-provided or configurable regex patterns:

```typescript
// Validate patterns at configuration time
const pattern = new RegExp(action.pattern, "is");

// Consider timeout for regex execution
// Log pattern matches for audit
```

**Recommendations:**

- Validate patterns at configuration time
- Implement timeout for regex execution
- Log pattern matches for audit trails

### Rate Limiting

Implement rate limiting for external API calls:

```typescript
// Recommended pattern
class RateLimiter {
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Implement rate limiting logic
  }
}
```

---

## Performance Guidelines

### Pagination

Always support pagination for list operations:

```typescript
export const EmailMessageQueryOptionsSchema = z.object({
  box: z.string().exactOptional(),
  limit: z.number().exactOptional(),
  pageToken: z.string().exactOptional(),
});
```

### Debouncing

Debounce user input for search operations:

```typescript
useEffect(() => {
  const timeout = setTimeout(() => setActiveSearch(searchInput), 300);
  return () => clearTimeout(timeout);
}, [searchInput]);
```

### Virtual Scrolling

For large lists (100+ items), implement virtual scrolling:

```typescript
// Recommended libraries: react-window, react-virtualized
import { FixedSizeList } from 'react-window';
```

### Caching

Implement client-side caching with invalidation:

```typescript
// Recommended pattern
const cache = new Map<string, { data: T, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

---

## Frontend Standards

### Component Organization

- Use composition for complex UIs
- Extract reusable components
- Keep components focused on single responsibility

### State Management

For complex state with multiple related variables:

```typescript
// Use useReducer for complex state transitions
const [state, dispatch] = useReducer(emailAppStateReducer, initialState);
```

### Event Handlers

Use `useCallback` for event handlers to prevent unnecessary re-renders:

```typescript
const handleSelect = useCallback((id: string) => {
  setSelectedMessageId(id);
}, []);
```

### Accessibility

Always include accessibility labels for icon-only buttons:

```typescript
<button
  type="button"
  onClick={onClose}
  aria-label="Close email"
>
  <X className="w-4 h-4" />
</button>
```

### Constants

Extract magic numbers to constants:

```typescript
const SPLIT_CONFIG = {
  INITIAL_RATIO: 0.3,
  MIN_FIRST: 200,
  MIN_SECOND: 300,
};
```

---

## Code Organization

### Package Structure

```text
pkg/{service}/
├── {Service}.ts           # Core service class
├── {Provider}.ts          # Provider interface and schemas
├── schema.ts              # Configuration schemas
├── state/
│   └── {State}.ts         # State management
├── tools/                 # Chat tools
├── commands/              # CLI commands
├── rpc/
│   ├── {service}.ts       # RPC implementation
│   └── schema.ts          # RPC schema
├── plugin.ts              # Plugin registration
└── index.ts               # Exports
```

### Tool/Command Patterns

All tools follow the same structure:

```typescript
const name = "email_createDraft";
const displayName = "Email/createDraft";
const description = "Create a new email draft";

const inputSchema = z.object({
  subject: z.string().describe("Email subject line"),
  to: z.array(addressSchema).min(1).describe("Primary recipients"),
});

async function execute(input: z.output<typeof inputSchema>, agent: Agent): Promise<TokenRingToolResult> {
  // Implementation
}

export default {
  name,
  displayName,
  description,
  inputSchema,
  execute,
} satisfies TokenRingToolDefinition<typeof inputSchema>;
```

All commands follow the same structure:

```typescript
const inputSchema = {
  args: {
    box: { type: "string", required: false },
  },
} as const satisfies AgentCommandInputSchema;

async function execute({ args, agent }: AgentCommandInputType<typeof inputSchema>): Promise<string> {
  // Implementation
}

export default {
  name: "email messages list",
  description: "List messages",
  inputSchema,
  help: `Help text with examples`,
  execute,
} satisfies TokenRingAgentCommand<typeof inputSchema>;
```

---

## Testing Requirements

### Test Coverage Areas

- Service operations
- Tool execution
- Command execution
- RPC endpoints
- State management
- Provider implementations

### Test Structure

```typescript
import { describe, it, expect, vi } from "vitest";
import EmailService from "./EmailService";

describe("EmailService", () => {
  describe("getMessages", () => {
    it("should return messages from active provider", async () => {
      // Test implementation
    });
  });
});
```

---

## Documentation Standards

### Inline Documentation

Add JSDoc/TSDoc comments for public APIs:

```typescript
/**
 * Retrieves messages from a selected email box.
 * @param filter - Query filters including box, limit, and pagination
 * @param agent - The agent instance
 * @returns Promise resolving to paginated messages
 */
async getMessages(filter: EmailMessageQueryOptions, agent: Agent): Promise<EmailMessagePage> {
  // Implementation
}
```

### README Documentation

Each package should include:

- Overview and key responsibilities
- Installation instructions
- Feature documentation with examples
- Configuration schema
- API reference
- Best practices
- Testing instructions

---

## Code Review Checklist

Before merging code, verify:

- [ ] All inputs are validated with schemas
- [ ] Errors are properly handled and logged
- [ ] No silent error swallowing
- [ ] Security considerations addressed (XSS, injection, etc.)
- [ ] Performance implications considered
- [ ] Tests added for new functionality
- [ ] Documentation updated
- [ ] Code follows established patterns
- [ ] No unused imports or variables
- [ ] Accessibility requirements met (frontend)

---

## Common Anti-Patterns to Avoid

### 1. Silent Error Handling

```typescript
// BAD
.catch(() => {});

// GOOD
.catch((error) => {
  console.error("Operation failed:", error);
  // Or notify user
});
```

### 2. Missing Timeouts

```typescript
// BAD
await provider.getMessages(filter);

// GOOD
await Promise.race([
  provider.getMessages(filter),
  timeout(30000, "Get messages timed out"),
]);
```

### 3. Inline Handlers Without useCallback

```typescript
// BAD
<button onClick={() => handleSelect(id)}>Click</button>

// GOOD
const handleClick = useCallback(() => handleSelect(id), [id, handleSelect]);
<button onClick={handleClick}>Click</button>
```

### 4. Magic Numbers

```typescript
// BAD
if (messages.length > 50) { }

// GOOD
const MAX_MESSAGES = 50;
if (messages.length > MAX_MESSAGES) { }
```

---

## Grading Rubric

Code quality is assessed on:

| Category | Weight | A (90-100) | B (80-89) | C (70-79) | D (<70) |
|----------|--------|------------|-----------|-----------|---------|
| Architecture | 25% | Clear patterns, extensible | Good patterns | Adequate | Poor |
| Type Safety | 20% | Complete schema coverage | Most covered | Partial | Minimal |
| Error Handling | 20% | Comprehensive | Good | Basic | Poor |
| Security | 15% | All concerns addressed | Most addressed | Some | Few |
| Performance | 10% | Optimized | Good | Adequate | Poor |
| Testing | 10% | Full coverage | Good coverage | Partial | None |
