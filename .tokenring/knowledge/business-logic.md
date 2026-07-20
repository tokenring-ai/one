# Business Logic Knowledge Repository

This file maintains knowledge about business workflows, rules engines, and automation systems in the TokenRing project.

## Discovered Business Logic

### Project Overview

The TokenRing AI project contains multiple packages focused on workflow management, automation, and business logic processing. It's a comprehensive AI-powered development and content creation ecosystem with 50+ specialized packages.

### Key Workflow-Related Packages

- **@tokenring-ai/tasks** - Task management and execution
- **@tokenring-ai/scripting** - Scripting language implementation  
- **@tokenring-ai/iterables** - Iteration patterns and data processing
- **@tokenring-ai/queue** - Queue-based workflow orchestration
- **@tokenring-ai/agent** - Multi-agent coordination and orchestration
- **@tokenring-ai/testing** - Testing framework with auto-repair
- **@tokenring-ai/memory** - Short-term memory and context storage
- **@tokenring-ai/feedback** - Human-in-the-loop feedback systems

### Core Business Logic Components

#### 1. Task Orchestration (@tokenring-ai/tasks)

**TaskService Features:**
- Multi-step workflow execution with configurable parallelism
- Auto-approval mechanism with configurable timeout
- Sub-agent execution via `runSubAgent`
- Task status tracking (pending, running, completed, failed)
- Checkpoint preservation for task execution
- Configurable parallel task execution (`parallelTasks` setting)

**Key Workflow Patterns:**
- Sequential and parallel task execution using `async.mapLimit`
- Agent delegation and coordination
- Status monitoring and error handling
- Context preservation across task execution
- Automatic cleanup and resource management

**Business Rules:**
- Tasks have configurable timeout and max response length
- Auto-approval prevents human intervention delays
- Failed tasks can be retried with preserved context
- Parallel execution is controlled and limited
- Task results are cached and can be retrieved

**Chat Command Interface:**
```bash
/tasks list                    # Display all tasks with status
/tasks clear                   # Remove all tasks
/tasks execute                 # Execute pending tasks
/tasks auto-approve 30         # Set auto-approval timeout
/tasks parallel 5              # Set parallel execution count
```

#### 2. Scripting Language (@tokenring-ai/scripting)

**ScriptingService Features:**
- Custom scripting language with variables, functions, control flow
- Multiple function types: static, LLM, JavaScript, native
- Script registration and management
- Context-aware execution with variable interpolation
- Chat command integration

**Scripting Workflows:**
- Reusable command sequences
- Dynamic function execution with parameter binding
- LLM-powered function execution
- JavaScript function integration
- Native function execution for specialized operations

**Business Logic Patterns:**
- Function overloading support
- Variable scoping and context management
- Error handling and rollback mechanisms
- Integration with chat-based workflows

**Chat Command Interface:**
```bash
/script list                   # List available scripts
/script run <name> [input]     # Execute script
/script info <name>            # Show script details
/call functionName("arg1", "arg2")  # Call functions directly
/var name="value"              # Set variables
/func name(params) { body }    # Define functions
```

#### 3. Iterable Processing (@tokenring-ai/iterables)

**IterableService Features:**
- Named iterables for batch operations
- Provider-based iterable generation
- Asynchronous iteration patterns
- State persistence for iterables

**Batch Processing Workflows:**
- Pattern-based data generation
- Provider-agnostic iteration
- Stateful iteration with checkpointing
- Integration with `/foreach` commands

**Business Rules:**
- Iterable specifications define data generation rules
- Providers can be swapped without changing business logic
- Iteration state is preserved across agent restarts
- Batch operations can be cancelled or resumed

#### 4. Queue Management (@tokenring-ai/queue)

**WorkQueueService Features:**
- FIFO queue operations with configurable maximum size
- Work item tracking and management
- Checkpoint preservation for queue state
- Start/stop functionality for queue processing

**Queue Workflows:**
- Sequential work item processing
- Queue state persistence
- Initial checkpoint restoration
- Current item tracking

**Business Logic:**
- Queue size limits prevent memory overflow
- Checkpoint preservation enables recovery
- Start/stop controls enable controlled execution
- Items can be inserted, removed, or modified

### Multi-Agent Coordination Architecture

#### Agent Management System (@tokenring-ai/agent)

**AgentManager Features:**
- Dynamic agent creation and destruction
- Agent configuration management
- Idle agent cleanup with configurable timeouts
- Sub-agent creation with state inheritance

**Coordination Patterns:**
- Parent-child agent relationships
- State sharing between agents (filtered by `persistToSubAgents`)
- Event-driven communication via EventEmitter
- Service-based dependency injection

**Key Business Logic:**
- Agents are automatically cleaned up after idle timeout
- Sub-agents inherit selective state from parent
- Agent lifecycle events trigger hook execution
- Service registry enables dynamic service discovery

#### Sub-Agent Execution Engine

**runSubAgent Function Features:**
- Configurable output forwarding (chat, system, reasoning, human requests)
- Timeout handling with custom configurations
- Response truncation with context preservation
- Automatic cleanup options
- Silent execution mode for background tasks

**Execution Workflows:**
- Sub-agent spawning with context injection
- Event forwarding to parent agents
- Human-in-the-loop request handling
- Error propagation and recovery
- Response truncation for large outputs

**Business Rules:**
- Human requests can be forwarded or blocked based on context
- System errors are always included in responses for debugging
- Timeout handling prevents hanging agents
- Automatic cleanup prevents resource leaks

**Chat Command Interface:**
```bash
/work <message>               # Execute work with agent
/reset                       # Reset agent state
/settings <key> <value>       # Configure agent
/hook <name> <action>        # Manage lifecycle hooks
/debug <command>             # Debug operations
/help                        # Show help
/logs                        # View execution logs
```

### Event-Driven Architecture

**AgentEventState Features:**
- Event cursor-based iteration
- Event type classification (chat, reasoning, system, human requests)
- Serialization for checkpoint persistence
- Event filtering and forwarding

**Event Processing Patterns:**
- Cursor-based event consumption
- Real-time event forwarding
- Event type-specific routing
- State persistence across agent restarts

**Business Logic:**
- Events are immutable and timestamp-ordered
- Event cursors enable replay and recovery
- Event forwarding can be selectively enabled/disabled
- System errors are always captured for debugging

### Testing and Quality Assurance (@tokenring-ai/testing)

**TestingService Features:**
- Registry-based testing resource management
- Resource activation/deactivation
- Test result aggregation
- Auto-repair capabilities

**Testing Workflows:**
- Configurable test resource activation
- Parallel test execution
- Result aggregation and reporting
- Integration with git for auto-commit

**Business Rules:**
- Only active resources are tested
- Test results are cached for performance
- Failed tests can trigger auto-repair workflows
- Integration with development workflows (git hooks)

### Memory and Context Management (@tokenring-ai/memory)

**ShortTermMemoryService Features:**
- Memory addition and retrieval
- Context injection for scripts
- Integration with scripting functions
- State persistence across sessions

**Memory Workflows:**
- Memory-based context enhancement
- Script function integration
- Context-aware processing
- State persistence and recovery

**Business Logic:**
- Memory is automatically injected into context
- Scripts can access and manipulate memory
- Memory state survives agent restarts
- Integration with external memory systems

**Chat Command Interface:**
```bash
/memory add <content>         # Add memory item
/memory list                  # List memories
/memory clear                 # Clear all memory
/attention <focus>            # Set attention focus
```

### Approval and Feedback Systems (@tokenring-ai/feedback)

**Human-in-the-Loop Features:**
- File feedback and review systems
- Interactive approval workflows
- React component preview
- Question and response handling

**Approval Workflows:**
- Human feedback collection
- File review and approval
- Component preview and validation
- Request/response coordination

**Business Rules:**
- Human requests can be forwarded or blocked
- File feedback requires human interaction
- Component previews require browser integration
- Response handling is coordinated across agents

### Workflow Orchestration Patterns

1. **Sequential Processing**: Tasks executed in order with dependency tracking
2. **Parallel Processing**: Multiple tasks processed simultaneously with controlled concurrency
3. **Approval Workflows**: Human-in-the-loop validation points
4. **Recovery Mechanisms**: Checkpoint-based recovery for failed workflows

### Business Rule Engine Characteristics

1. **Declarative Configuration**: Business rules defined via configuration files
2. **Runtime Validation**: Rule validation at execution time
3. **Context Injection**: Rules can access agent context and state
4. **Extensible Rule Types**: Support for custom rule implementations

### Integration Patterns

1. **Service Registry**: Dynamic service discovery and injection
2. **Event Bus**: EventEmitter-based communication
3. **State Management**: Centralized state with checkpoint persistence
4. **Hook System**: Lifecycle event processing

### Advanced Workflow Examples

#### Multi-Agent Development Workflow
```typescript
// 1. Create team of specialized agents
const team = new AgentTeam();
await team.addAgent('fullstack-developer', { /* config */ });
await team.addAgent('test-engineer', { /* config */ });
await team.addAgent('devops-engineer', { /* config */ });

// 2. Execute complex workflow
const taskId = taskService.addTask({
  name: "Implement new feature",
  agentType: "fullstack-developer",
  message: "Build the new user authentication system"
}, team.leader);

// 3. Automatic testing and deployment
await taskService.executeTasks([taskId], team.leader);
```

#### Script-Based Automation
```javascript
// Define reusable automation script
script myDeployment = [
  "/test run",
  "/git commit -m 'Automated deployment'",
  "/deploy production",
  "/notify team 'Deployment complete'"
];

// Execute with parameters
/script run myDeployment "v1.2.3"
```

#### Batch Processing Workflow
```typescript
// Define iterable for batch processing
await iterableService.define(
  "user-list",
  "database-query",
  { query: "SELECT * FROM users WHERE active = true" },
  "Active users for processing"
);

// Process in batches
/for user in user-list
  /call sendWelcomeEmail(user.email)
```

### Key Architectural Insights

#### Agent-Centric Design
- All functionality is exposed through agents
- Services are injected into agents dynamically
- Agents coordinate through shared services and events
- State is managed centrally with persistence

#### Workflow Automation
- Scripts enable reusable automation patterns
- Tasks provide high-level workflow orchestration
- Queues enable batch and background processing
- Iterables support data-driven workflows

#### Human-in-the-Loop
- Approval workflows prevent automatic execution
- Feedback systems enable human validation
- Memory systems maintain context across interactions
- Testing ensures code quality and reliability

#### Scalability Features
- Parallel processing with configurable limits
- Automatic cleanup prevents resource leaks
- Checkpoint persistence enables recovery
- Event-driven architecture supports high throughput

### Business Logic Patterns Summary

1. **Command Pattern**: Chat commands encapsulate workflow operations
2. **Strategy Pattern**: Multiple providers for same functionality (filesystems, databases, etc.)
3. **Observer Pattern**: Event-driven updates and notifications
4. **State Pattern**: Agent state management with persistence
5. **Template Method**: Abstract workflows with concrete implementations
6. **Chain of Responsibility**: Command processing pipelines
7. **Facade Pattern**: Service abstractions for complex operations
8. **Factory Pattern**: Dynamic agent and service creation

### Workflow Engineering Practices

1. **Modular Design**: Each package has single responsibility
2. **Event Sourcing**: Events are the source of truth
3. **CQRS**: Command-query separation in workflow operations
4. **Saga Pattern**: Long-running workflows with compensation
5. **Circuit Breaker**: Fault tolerance in agent communications
6. **Bulkhead**: Resource isolation between agents
7. **Retry Logic**: Automatic retry with exponential backoff
8. **Circuit Breaker**: Prevent cascade failures

This comprehensive business logic analysis reveals a sophisticated, enterprise-grade workflow management system designed for AI agent coordination, with strong emphasis on reliability, scalability, and human oversight.
# Business Logic Knowledge Repository

This file maintains knowledge about business workflows, rules engines, and automation systems in the TokenRing project.

## Discovered Business Logic

### Project Overview

The TokenRing AI project contains multiple packages focused on workflow management, automation, and business logic processing. It's a comprehensive AI-powered development and content creation ecosystem with 50+ specialized packages.

### Key Workflow-Related Packages

- **@tokenring-ai/tasks** - Task management and execution
- **@tokenring-ai/scripting** - Scripting language implementation  
- **@tokenring-ai/iterables** - Iteration patterns and data processing
- **@tokenring-ai/queue** - Queue-based workflow orchestration
- **@tokenring-ai/agent** - Multi-agent coordination and orchestration
- **@tokenring-ai/testing** - Testing framework with auto-repair
- **@tokenring-ai/memory** - Short-term memory and context storage
- **@tokenring-ai/feedback** - Human-in-the-loop feedback systems

### Core Business Logic Components

#### 1. Task Orchestration (@tokenring-ai/tasks)

**TaskService Features:**
- Multi-step workflow execution with configurable parallelism
- Auto-approval mechanism with configurable timeout
- Sub-agent execution via `runSubAgent`
- Task status tracking (pending, running, completed, failed)
- Checkpoint preservation for task execution
- Configurable parallel task execution (`parallelTasks` setting)

**Key Workflow Patterns:**
- Sequential and parallel task execution using `async.mapLimit`
- Agent delegation and coordination
- Status monitoring and error handling
- Context preservation across task execution
- Automatic cleanup and resource management

**Business Rules:**
- Tasks have configurable timeout and max response length
- Auto-approval prevents human intervention delays
- Failed tasks can be retried with preserved context
- Parallel execution is controlled and limited
- Task results are cached and can be retrieved

**Chat Command Interface:**
```bash
/tasks list                    # Display all tasks with status
/tasks clear                   # Remove all tasks
/tasks execute                 # Execute pending tasks
/tasks auto-approve 30         # Set auto-approval timeout
/tasks parallel 5              # Set parallel execution count
```

#### 2. Scripting Language (@tokenring-ai/scripting)

**ScriptingService Features:**
- Custom scripting language with variables, functions, control flow
- Multiple function types: static, LLM, JavaScript, native
- Script registration and management
- Context-aware execution with variable interpolation
- Chat command integration

**Scripting Workflows:**
- Reusable command sequences
- Dynamic function execution with parameter binding
- LLM-powered function execution
- JavaScript function integration
- Native function execution for specialized operations

**Business Logic Patterns:**
- Function overloading support
- Variable scoping and context management
- Error handling and rollback mechanisms
- Integration with chat-based workflows

**Chat Command Interface:**
```bash
/script list                   # List available scripts
/script run <name> [input]     # Execute script
/script info <name>            # Show script details
/call functionName("arg1", "arg2")  # Call functions directly
/var name="value"              # Set variables
/func name(params) { body }    # Define functions
```

#### 3. Iterable Processing (@tokenring-ai/iterables)

**IterableService Features:**
- Named iterables for batch operations
- Provider-based iterable generation
- Asynchronous iteration patterns
- State persistence for iterables

**Batch Processing Workflows:**
- Pattern-based data generation
- Provider-agnostic iteration
- Stateful iteration with checkpointing
- Integration with `/foreach` commands

**Business Rules:**
- Iterable specifications define data generation rules
- Providers can be swapped without changing business logic
- Iteration state is preserved across agent restarts
- Batch operations can be cancelled or resumed

#### 4. Queue Management (@tokenring-ai/queue)

**WorkQueueService Features:**
- FIFO queue operations with configurable maximum size
- Work item tracking and management
- Checkpoint preservation for queue state
- Start/stop functionality for queue processing

**Queue Workflows:**
- Sequential work item processing
- Queue state persistence
- Initial checkpoint restoration
- Current item tracking

**Business Logic:**
- Queue size limits prevent memory overflow
- Checkpoint preservation enables recovery
- Start/stop controls enable controlled execution
- Items can be inserted, removed, or modified

### Multi-Agent Coordination Architecture

#### Agent Management System (@tokenring-ai/agent)

**AgentManager Features:**
- Dynamic agent creation and destruction
- Agent configuration management
- Idle agent cleanup with configurable timeouts
- Sub-agent creation with state inheritance

**Coordination Patterns:**
- Parent-child agent relationships
- State sharing between agents (filtered by `persistToSubAgents`)
- Event-driven communication via EventEmitter
- Service-based dependency injection

**Key Business Logic:**
- Agents are automatically cleaned up after idle timeout
- Sub-agents inherit selective state from parent
- Agent lifecycle events trigger hook execution
- Service registry enables dynamic service discovery

#### Sub-Agent Execution Engine

**runSubAgent Function Features:**
- Configurable output forwarding (chat, system, reasoning, human requests)
- Timeout handling with custom configurations
- Response truncation with context preservation
- Automatic cleanup options
- Silent execution mode for background tasks

**Execution Workflows:**
- Sub-agent spawning with context injection
- Event forwarding to parent agents
- Human-in-the-loop request handling
- Error propagation and recovery
- Response truncation for large outputs

**Business Rules:**
- Human requests can be forwarded or blocked based on context
- System errors are always included in responses for debugging
- Timeout handling prevents hanging agents
- Automatic cleanup prevents resource leaks

**Chat Command Interface:**
```bash
/work <message>               # Execute work with agent
/reset                       # Reset agent state
/settings <key> <value>       # Configure agent
/hook <name> <action>        # Manage lifecycle hooks
/debug <command>             # Debug operations
/help                        # Show help
/logs                        # View execution logs
```

### Event-Driven Architecture

**AgentEventState Features:**
- Event cursor-based iteration
- Event type classification (chat, reasoning, system, human requests)
- Serialization for checkpoint persistence
- Event filtering and forwarding

**Event Processing Patterns:**
- Cursor-based event consumption
- Real-time event forwarding
- Event type-specific routing
- State persistence across agent restarts

**Business Logic:**
- Events are immutable and timestamp-ordered
- Event cursors enable replay and recovery
- Event forwarding can be selectively enabled/disabled
- System errors are always captured for debugging

### Testing and Quality Assurance (@tokenring-ai/testing)

**TestingService Features:**
- Registry-based testing resource management
- Resource activation/deactivation
- Test result aggregation
- Auto-repair capabilities

**Testing Workflows:**
- Configurable test resource activation
- Parallel test execution
- Result aggregation and reporting
- Integration with git for auto-commit

**Business Rules:**
- Only active resources are tested
- Test results are cached for performance
- Failed tests can trigger auto-repair workflows
- Integration with development workflows (git hooks)

### Memory and Context Management (@tokenring-ai/memory)

**ShortTermMemoryService Features:**
- Memory addition and retrieval
- Context injection for scripts
- Integration with scripting functions
- State persistence across sessions

**Memory Workflows:**
- Memory-based context enhancement
- Script function integration
- Context-aware processing
- State persistence and recovery

**Business Logic:**
- Memory is automatically injected into context
- Scripts can access and manipulate memory
- Memory state survives agent restarts
- Integration with external memory systems

**Chat Command Interface:**
```bash
/memory add <content>         # Add memory item
/memory list                  # List memories
/memory clear                 # Clear all memory
/attention <focus>            # Set attention focus
```

### Approval and Feedback Systems (@tokenring-ai/feedback)

**Human-in-the-Loop Features:**
- File feedback and review systems
- Interactive approval workflows
- React component preview
- Question and response handling

**Approval Workflows:**
- Human feedback collection
- File review and approval
- Component preview and validation
- Request/response coordination

**Business Rules:**
- Human requests can be forwarded or blocked
- File feedback requires human interaction
- Component previews require browser integration
- Response handling is coordinated across agents

### Workflow Orchestration Patterns

1. **Sequential Processing**: Tasks executed in order with dependency tracking
2. **Parallel Processing**: Multiple tasks processed simultaneously with controlled concurrency
3. **Approval Workflows**: Human-in-the-loop validation points
4. **Recovery Mechanisms**: Checkpoint-based recovery for failed workflows

### Business Rule Engine Characteristics

1. **Declarative Configuration**: Business rules defined via configuration files
2. **Runtime Validation**: Rule validation at execution time
3. **Context Injection**: Rules can access agent context and state
4. **Extensible Rule Types**: Support for custom rule implementations

### Integration Patterns

1. **Service Registry**: Dynamic service discovery and injection
2. **Event Bus**: EventEmitter-based communication
3. **State Management**: Centralized state with checkpoint persistence
4. **Hook System**: Lifecycle event processing

### Advanced Workflow Examples

#### Multi-Agent Development Workflow
```typescript
// 1. Create team of specialized agents
const team = new AgentTeam();
await team.addAgent('fullstack-developer', { /* config */ });
await team.addAgent('test-engineer', { /* config */ });
await team.addAgent('devops-engineer', { /* config */ });

// 2. Execute complex workflow
const taskId = taskService.addTask({
  name: "Implement new feature",
  agentType: "fullstack-developer",
  message: "Build the new user authentication system"
}, team.leader);

// 3. Automatic testing and deployment
await taskService.executeTasks([taskId], team.leader);
```

#### Script-Based Automation
```javascript
// Define reusable automation script
script myDeployment = [
  "/test run",
  "/git commit -m 'Automated deployment'",
  "/deploy production",
  "/notify team 'Deployment complete'"
];

// Execute with parameters
/script run myDeployment "v1.2.3"
```

#### Batch Processing Workflow
```typescript
// Define iterable for batch processing
await iterableService.define(
  "user-list",
  "database-query",
  { query: "SELECT * FROM users WHERE active = true" },
  "Active users for processing"
);

// Process in batches
/for user in user-list
  /call sendWelcomeEmail(user.email)
```

### Key Architectural Insights

#### Agent-Centric Design
- All functionality is exposed through agents
- Services are injected into agents dynamically
- Agents coordinate through shared services and events
- State is managed centrally with persistence

#### Workflow Automation
- Scripts enable reusable automation patterns
- Tasks provide high-level workflow orchestration
- Queues enable batch and background processing
- Iterables support data-driven workflows

#### Human-in-the-Loop
- Approval workflows prevent automatic execution
- Feedback systems enable human validation
- Memory systems maintain context across interactions
- Testing ensures code quality and reliability

#### Scalability Features
- Parallel processing with configurable limits
- Automatic cleanup prevents resource leaks
- Checkpoint persistence enables recovery
- Event-driven architecture supports high throughput

### Business Logic Patterns Summary

1. **Command Pattern**: Chat commands encapsulate workflow operations
2. **Strategy Pattern**: Multiple providers for same functionality (filesystems, databases, etc.)
3. **Observer Pattern**: Event-driven updates and notifications
4. **State Pattern**: Agent state management with persistence
5. **Template Method**: Abstract workflows with concrete implementations
6. **Chain of Responsibility**: Command processing pipelines
7. **Facade Pattern**: Service abstractions for complex operations
8. **Factory Pattern**: Dynamic agent and service creation

### Workflow Engineering Practices

1. **Modular Design**: Each package has single responsibility
2. **Event Sourcing**: Events are the source of truth
3. **CQRS**: Command-query separation in workflow operations
4. **Saga Pattern**: Long-running workflows with compensation
5. **Circuit Breaker**: Fault tolerance in agent communications
6. **Bulkhead**: Resource isolation between agents
7. **Retry Logic**: Automatic retry with exponential backoff
8. **Circuit Breaker**: Prevent cascade failures

This comprehensive business logic analysis reveals a sophisticated, enterprise-grade workflow management system designed for AI agent coordination, with strong emphasis on reliability, scalability, and human oversight.# Business Logic Knowledge Repository

This file maintains knowledge about business workflows, rules engines, and automation systems in the TokenRing project.

## Discovered Business Logic

### Project Overview

The TokenRing AI project contains multiple packages focused on workflow management, automation, and business logic processing. It's a comprehensive AI-powered development and content creation ecosystem with 50+ specialized packages.

### Key Workflow-Related Packages

- **@tokenring-ai/tasks** - Task management and execution
- **@tokenring-ai/scripting** - Scripting language implementation  
- **@tokenring-ai/iterables** - Iteration patterns and data processing
- **@tokenring-ai/queue** - Queue-based workflow orchestration
- **@tokenring-ai/agent** - Multi-agent coordination and orchestration
- **@tokenring-ai/testing** - Testing framework with auto-repair
- **@tokenring-ai/memory** - Short-term memory and context storage
- **@tokenring-ai/feedback** - Human-in-the-loop feedback systems

### Core Business Logic Components

#### 1. Task Orchestration (@tokenring-ai/tasks)

**TaskService Features:**
- Multi-step workflow execution with configurable parallelism
- Auto-approval mechanism with configurable timeout
- Sub-agent execution via `runSubAgent`
- Task status tracking (pending, running, completed, failed)
- Checkpoint preservation for task execution
- Configurable parallel task execution (`parallelTasks` setting)

**Key Workflow Patterns:**
- Sequential and parallel task execution using `async.mapLimit`
- Agent delegation and coordination
- Status monitoring and error handling
- Context preservation across task execution
- Automatic cleanup and resource management

**Business Rules:**
- Tasks have configurable timeout and max response length
- Auto-approval prevents human intervention delays
- Failed tasks can be retried with preserved context
- Parallel execution is controlled and limited
- Task results are cached and can be retrieved

**Chat Command Interface:**
```bash
/tasks list                    # Display all tasks with status
/tasks clear                   # Remove all tasks
/tasks execute                 # Execute pending tasks
/tasks auto-approve 30         # Set auto-approval timeout
/tasks parallel 5              # Set parallel execution count
```

#### 2. Scripting Language (@tokenring-ai/scripting)

**ScriptingService Features:**
- Custom scripting language with variables, functions, control flow
- Multiple function types: static, LLM, JavaScript, native
- Script registration and management
- Context-aware execution with variable interpolation
- Chat command integration

**Scripting Workflows:**
- Reusable command sequences
- Dynamic function execution with parameter binding
- LLM-powered function execution
- JavaScript function integration
- Native function execution for specialized operations

**Business Logic Patterns:**
- Function overloading support
- Variable scoping and context management
- Error handling and rollback mechanisms
- Integration with chat-based workflows

**Chat Command Interface:**
```bash
/script list                   # List available scripts
/script run <name> [input]     # Execute script
/script info <name>            # Show script details
/call functionName("arg1", "arg2")  # Call functions directly
/var name="value"              # Set variables
/func name(params) { body }    # Define functions
```

#### 3. Iterable Processing (@tokenring-ai/iterables)

**IterableService Features:**
- Named iterables for batch operations
- Provider-based iterable generation
- Asynchronous iteration patterns
- State persistence for iterables

**Batch Processing Workflows:**
- Pattern-based data generation
- Provider-agnostic iteration
- Stateful iteration with checkpointing
- Integration with `/foreach` commands

**Business Rules:**
- Iterable specifications define data generation rules
- Providers can be swapped without changing business logic
- Iteration state is preserved across agent restarts
- Batch operations can be cancelled or resumed

#### 4. Queue Management (@tokenring-ai/queue)

**WorkQueueService Features:**
- FIFO queue operations with configurable maximum size
- Work item tracking and management
- Checkpoint preservation for queue state
- Start/stop functionality for queue processing

**Queue Workflows:**
- Sequential work item processing
- Queue state persistence
- Initial checkpoint restoration
- Current item tracking

**Business Logic:**
- Queue size limits prevent memory overflow
- Checkpoint preservation enables recovery
- Start/stop controls enable controlled execution
- Items can be inserted, removed, or modified

### Multi-Agent Coordination Architecture

#### Agent Management System (@tokenring-ai/agent)

**AgentManager Features:**
- Dynamic agent creation and destruction
- Agent configuration management
- Idle agent cleanup with configurable timeouts
- Sub-agent creation with state inheritance

**Coordination Patterns:**
- Parent-child agent relationships
- State sharing between agents (filtered by `persistToSubAgents`)
- Event-driven communication via EventEmitter
- Service-based dependency injection

**Key Business Logic:**
- Agents are automatically cleaned up after idle timeout
- Sub-agents inherit selective state from parent
- Agent lifecycle events trigger hook execution
- Service registry enables dynamic service discovery

#### Sub-Agent Execution Engine

**runSubAgent Function Features:**
- Configurable output forwarding (chat, system, reasoning, human requests)
- Timeout handling with custom configurations
- Response truncation with context preservation
- Automatic cleanup options
- Silent execution mode for background tasks

**Execution Workflows:**
- Sub-agent spawning with context injection
- Event forwarding to parent agents
- Human-in-the-loop request handling
- Error propagation and recovery
- Response truncation for large outputs

**Business Rules:**
- Human requests can be forwarded or blocked based on context
- System errors are always included in responses for debugging
- Timeout handling prevents hanging agents
- Automatic cleanup prevents resource leaks

**Chat Command Interface:**
```bash
/work <message>               # Execute work with agent
/reset                       # Reset agent state
/settings <key> <value>       # Configure agent
/hook <name> <action>        # Manage lifecycle hooks
/debug <command>             # Debug operations
/help                        # Show help
/logs                        # View execution logs
```

### Event-Driven Architecture

**AgentEventState Features:**
- Event cursor-based iteration
- Event type classification (chat, reasoning, system, human requests)
- Serialization for checkpoint persistence
- Event filtering and forwarding

**Event Processing Patterns:**
- Cursor-based event consumption
- Real-time event forwarding
- Event type-specific routing
- State persistence across agent restarts

**Business Logic:**
- Events are immutable and timestamp-ordered
- Event cursors enable replay and recovery
- Event forwarding can be selectively enabled/disabled
- System errors are always captured for debugging

### Testing and Quality Assurance (@tokenring-ai/testing)

**TestingService Features:**
- Registry-based testing resource management
- Resource activation/deactivation
- Test result aggregation
- Auto-repair capabilities

**Testing Workflows:**
- Configurable test resource activation
- Parallel test execution
- Result aggregation and reporting
- Integration with git for auto-commit

**Business Rules:**
- Only active resources are tested
- Test results are cached for performance
- Failed tests can trigger auto-repair workflows
- Integration with development workflows (git hooks)

### Memory and Context Management (@tokenring-ai/memory)

**ShortTermMemoryService Features:**
- Memory addition and retrieval
- Context injection for scripts
- Integration with scripting functions
- State persistence across sessions

**Memory Workflows:**
- Memory-based context enhancement
- Script function integration
- Context-aware processing
- State persistence and recovery

**Business Logic:**
- Memory is automatically injected into context
- Scripts can access and manipulate memory
- Memory state survives agent restarts
- Integration with external memory systems

**Chat Command Interface:**
```bash
/memory add <content>         # Add memory item
/memory list                  # List memories
/memory clear                 # Clear all memory
/attention <focus>            # Set attention focus
```

### Approval and Feedback Systems (@tokenring-ai/feedback)

**Human-in-the-Loop Features:**
- File feedback and review systems
- Interactive approval workflows
- React component preview
- Question and response handling

**Approval Workflows:**
- Human feedback collection
- File review and approval
- Component preview and validation
- Request/response coordination

**Business Rules:**
- Human requests can be forwarded or blocked
- File feedback requires human interaction
- Component previews require browser integration
- Response handling is coordinated across agents

### State Management Architecture

#### State Persistence Patterns

**TaskState Implementation:**
```typescript
class TaskState implements AgentStateSlice {
  tasks: Task[];
  autoApprove: number;
  parallelTasks: number;
  persistToSubAgents = true;

  // Checkpoint-based persistence
  serialize(): object
  deserialize(data: any): void
  reset(what: ResetWhat[]): void
}
```

**ScriptingContext Implementation:**
```typescript
class ScriptingContext implements AgentStateSlice {
  variables = new Map<string, string>();
  lists = new Map<string, string[]>();
  functions = new Map<string, FunctionDefinition>();

  // Variable interpolation and context management
  interpolate(text: string): string
}
```

**IterableState Implementation:**
```typescript
class IterableState implements AgentStateSlice {
  iterables: Map<string, StoredIterable>;

  // Persistent iterable definitions across sessions
}
```

**WorkQueueState Implementation:**
```typescript
class WorkQueueState implements AgentStateSlice {
  queue: QueueItem[];
  started: boolean;
  initialCheckpoint: AgentCheckpointData;
  currentItem: QueueItem;

  // Queue state preservation across processing
}
```

#### Agent State Architecture

**Core Agent State Management:**
```typescript
class Agent implements AskHumanInterface, ChatOutputStream, ServiceRegistryInterface {
  stateManager = new StateManager<AgentStateSlice>();
  
  // State operations
  initializeState = this.stateManager.initializeState.bind(this.stateManager);
  mutateState = this.stateManager.mutateState.bind(this.stateManager);
  getState = this.stateManager.getState.bind(this.stateManager);
  subscribeState = this.stateManager.subscribe.bind(this.stateManager);
  waitForState = this.stateManager.waitForState.bind(this.stateManager);
  
  // Checkpoint operations
  generateCheckpoint(): AgentCheckpointData
  restoreCheckpoint({state}: AgentCheckpointData): void
}
```

**Event Processing Architecture:**
```typescript
class AgentEventState implements SerializableStateSlice {
  events: AgentEventEnvelope[];
  busyWith: string | null;
  idle: boolean;
  waitingOn: HumanRequestEnvelope | null;

  // Event emission and cursor-based consumption
  emit(event: AgentEventEnvelope): void
  getEventCursorFromCurrentPosition(): AgentEventCursor
  *yieldEventsByCursor(cursor: AgentEventCursor): Generator<AgentEventEnvelope>
}
```

### Workflow Orchestration Patterns

1. **Sequential Processing**: Tasks executed in order with dependency tracking
2. **Parallel Processing**: Multiple tasks processed simultaneously with controlled concurrency
3. **Approval Workflows**: Human-in-the-loop validation points
4. **Recovery Mechanisms**: Checkpoint-based recovery for failed workflows

### Business Rule Engine Characteristics

1. **Declarative Configuration**: Business rules defined via configuration files
2. **Runtime Validation**: Rule validation at execution time
3. **Context Injection**: Rules can access agent context and state
4. **Extensible Rule Types**: Support for custom rule implementations

### Integration Patterns

1. **Service Registry**: Dynamic service discovery and injection
2. **Event Bus**: EventEmitter-based communication
3. **State Management**: Centralized state with checkpoint persistence
4. **Hook System**: Lifecycle event processing

### Advanced Workflow Examples

#### Multi-Agent Development Workflow
```typescript
// 1. Create team of specialized agents
const team = new AgentTeam();
await team.addAgent('fullstack-developer', { /* config */ });
await team.addAgent('test-engineer', { /* config */ });
await team.addAgent('devops-engineer', { /* config */ });

// 2. Execute complex workflow
const taskId = taskService.addTask({
  name: "Implement new feature",
  agentType: "fullstack-developer",
  message: "Build the new user authentication system"
}, team.leader);

// 3. Automatic testing and deployment
await taskService.executeTasks([taskId], team.leader);
```

#### Script-Based Automation
```javascript
// Define reusable automation script
script myDeployment = [
  "/test run",
  "/git commit -m 'Automated deployment'",
  "/deploy production",
  "/notify team 'Deployment complete'"
];

// Execute with parameters
/script run myDeployment "v1.2.3"
```

#### Batch Processing Workflow
```typescript
// Define iterable for batch processing
await iterableService.define(
  "user-list",
  "database-query",
  { query: "SELECT * FROM users WHERE active = true" },
  "Active users for processing"
);

// Process in batches
/for user in user-list
  /call sendWelcomeEmail(user.email)
```

### Key Architectural Insights

#### Agent-Centric Design
- All functionality is exposed through agents
- Services are injected into agents dynamically
- Agents coordinate through shared services and events
- State is managed centrally with persistence

#### Workflow Automation
- Scripts enable reusable automation patterns
- Tasks provide high-level workflow orchestration
- Queues enable batch and background processing
- Iterables support data-driven workflows

#### Human-in-the-Loop
- Approval workflows prevent automatic execution
- Feedback systems enable human validation
- Memory systems maintain context across interactions
- Testing ensures code quality and reliability

#### Scalability Features
- Parallel processing with configurable limits
- Automatic cleanup prevents resource leaks
- Checkpoint persistence enables recovery
- Event-driven architecture supports high throughput

### Business Logic Patterns Summary

1. **Command Pattern**: Chat commands encapsulate workflow operations
2. **Strategy Pattern**: Multiple providers for same functionality (filesystems, databases, etc.)
3. **Observer Pattern**: Event-driven updates and notifications
4. **State Pattern**: Agent state management with persistence
5. **Template Method**: Abstract workflows with concrete implementations
6. **Chain of Responsibility**: Command processing pipelines
7. **Facade Pattern**: Service abstractions for complex operations
8. **Factory Pattern**: Dynamic agent and service creation

### Workflow Engineering Practices

1. **Modular Design**: Each package has single responsibility
2. **Event Sourcing**: Events are the source of truth
3. **CQRS**: Command-query separation in workflow operations
4. **Saga Pattern**: Long-running workflows with compensation
5. **Circuit Breaker**: Fault tolerance in agent communications
6. **Bulkhead**: Resource isolation between agents
7. **Retry Logic**: Automatic retry with exponential backoff
8. **Circuit Breaker**: Prevent cascade failures

### Comprehensive Package Analysis

#### @tokenring-ai/tasks Deep Dive

**Task Planning Workflow:**
1. **Planning Phase**: Create comprehensive task plans with detailed context
2. **Approval Phase**: Task plan presented to user with clear descriptions and agent assignments
3. **Execution Phase**: Upon approval, tasks are added and executed immediately
4. **Tracking Phase**: Task status updated in real-time as agents complete work
5. **Results Phase**: Execution results collected and reported back

**Task Interface Design:**
```typescript
interface Task {
  id: string;                    // Unique identifier
  name: string;                  // Descriptive task name
  agentType: string;             // Type of agent to handle the task
  message: string;               // Main task description (1 paragraph)
  context: string;               // Detailed execution instructions (3+ paragraphs)
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;               // Execution result if completed
}
```

**Parallel Execution Engine:**
```typescript
async executeTasks(taskIds: string[], parentAgent: Agent): Promise<string[]> {
  const parallelTasks = state.parallelTasks || 1;
  // Execute tasks with controlled parallelism using async.mapLimit
  return await async.mapLimit(taskIds, parallelTasks, executeTask);
}
```

#### @tokenring-ai/scripting Deep Dive

**Scripting Language Features:**

**Variable System:**
- Static values with `/var $name = "value"`
- LLM responses with `/var $response = llm("prompt")`
- Function calls with `/var $result = functionName("args")`
- List variables with `/list @name = ["item1", "item2"]`

**Function System:**
- Static functions: `/func static greet($name) => "Hello, $name!"`
- LLM functions: `/func llm search($query) => "Search for $query"`
- JavaScript functions: `/func js process($data) { return JSON.parse($data) }`
- Native functions: Custom implementations

**Control Flow:**
- Conditional execution: `/if $condition { commands }`
- Looping: `/for $item in @list { commands }`
- While loops: `/while $condition { commands }`

**Context Integration:**
- Variable interpolation: `$variable` and `@list`
- Function parameter binding
- Context injection into LLM prompts
- State persistence across script execution

#### @tokenring-ai/iterables Deep Dive

**Provider Architecture:**
```typescript
interface IterableProvider {
  readonly type: string;
  readonly description: string;
  getArgsConfig(): { options: Record<string, { type: 'string' | 'boolean', multiple?: boolean }> };
  generate(spec: IterableSpec, agent: Agent): AsyncGenerator<IterableItem>;
}
```

**Built-in Providers:**

**Glob Provider:**
- File pattern matching with glob syntax
- Variable injection: `{file}`, `{path}`, `{basename}`, `{ext}`, `{content}`, `{size}`, `{modified}`
- Options: `--pattern`, `--includeDirectories`, `--absolute`

**Batch Processing:**
```typescript
/foreach @iterable-name "Process {variable} with template"
```

#### @tokenring-ai/queue Deep Dive

**Queue Operations:**
- FIFO queuing with configurable maximum size
- Checkpoint-based state preservation
- Start/stop functionality for controlled execution
- Interactive management via `/queue` commands

**State Preservation:**
```typescript
interface QueueItem {
  checkpoint: AgentCheckpointData;
  name: string;
  input: string;
}
```

**Queue Workflow:**
1. Add items to queue
2. Start queue processing (preserves current state)
3. Load next item (checkpoint restoration)
4. Execute item via runChat
5. Move to next item or complete

### Enterprise-Grade Features

#### Reliability Patterns

**Checkpoint Persistence:**
- All workflow states can be checkpointed and restored
- Enables recovery from failures
- Supports long-running workflow resumption
- Cross-agent state sharing

**Error Handling:**
- Comprehensive error propagation
- Circuit breaker patterns in agent communications
- Retry logic with exponential backoff
- Graceful degradation

**Resource Management:**
- Automatic agent cleanup based on idle timeouts
- Memory-bounded queue operations
- Garbage collection of completed workflows
- Resource isolation between agents

#### Scalability Features

**Parallel Processing:**
- Configurable parallelism limits
- Load balancing across agents
- Async/await patterns for non-blocking operations
- Event-driven architecture for high throughput

**State Distribution:**
- Shared state across agent hierarchies
- Selective state inheritance for sub-agents
- Event sourcing for audit trails
- CQRS patterns for complex workflows

#### Human-in-the-Loop Integration

**Approval Workflows:**
- Task plan approval before execution
- File review and feedback systems
- Component preview and validation
- Interactive decision points

**Feedback Systems:**
- React component preview with browser integration
- File feedback with accept/reject workflows
- Question and response handling
- Human request forwarding and blocking

### Advanced Business Logic Patterns

#### Workflow Composition Patterns

**Sequential Workflows:**
```typescript
// Tasks executed in sequence with dependencies
const task1 = taskService.addTask({...}, agent);
const task2 = taskService.addTask({...}, agent);
await taskService.executeTasks([task1, task2], agent);
```

**Parallel Workflows:**
```typescript
// Multiple agents working simultaneously
const results = await Promise.all([
  runSubAgent({agentType: "agent1", message: "task1"}, agent),
  runSubAgent({agentType: "agent2", message: "task2"}, agent)
]);
```

**Hybrid Workflows:**
```typescript
// Sequential planning with parallel execution
const plan = await createPlan(agent);
const tasks = await decomposePlan(plan);
await taskService.executeTasks(tasks, agent);
```

#### Context Management Patterns

**State Accumulation:**
```typescript
// Memory-based context building
memoryService.addMemory("Context item 1", agent);
memoryService.addMemory("Context item 2", agent);
// Context automatically available to agents
```

**Context Injection:**
```typescript
// Scripts automatically receive context
/var $context = memory.get("project_context")
/func llm analyze($input) => "Analyze $input with context: $context"
```

#### Error Recovery Patterns

**Checkpoint Recovery:**
```typescript
// Restore to previous state on failure
try {
  await riskyOperation(agent);
} catch (error) {
  agent.restoreState(checkpoint.state);
}
```

**Circuit Breaker:**
```typescript
// Prevent cascade failures
if (failureCount > threshold) {
  circuitBreaker.open = true;
  // Block requests until timeout
}
```

This comprehensive business logic analysis reveals a sophisticated, enterprise-grade workflow management system designed for AI agent coordination, with strong emphasis on reliability, scalability, and human oversight.