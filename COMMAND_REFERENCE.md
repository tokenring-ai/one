# Complete Command Reference

This document provides a comprehensive reference for all available chat commands
in the TokenRing One application. Commands are organized by category based on
their functionality and the packages they belong to.

## Command Categories

### AI and Chat Commands

| Command    | Description                    | Usage                       |
| ---------- | ------------------------------ | --------------------------- |
| `/tools`   | Manage chat session tools      | `/tools [enable\|disable]`  |
| `/model`   | Set or show target model       | `/model [model_name]`       |
| `/compact` | Compact context via summary    | `/compact`                  |
| `/chat`    | Send message to chat service   | `/chat [message]`           |
| `/ai`      | Update AI configuration        | `/ai settings key=value`    |

### Agent Control Commands

| Command     | Description                    | Usage                        |
| ----------- | ------------------------------ | ---------------------------- |
| `/work`     | Run agent work handler         | `/work [message]`            |
| `/settings` | Show current chat settings     | `/settings`                  |
| `/reset`    | Clear chat state/memory        | `/reset [chat\|memory]`      |
| `/hooks`    | List or manage hooks           | `/hooks [list\|enable]`      |
| `/debug`    | Toggle debug logging           | `/debug [on\|off]`           |

### System Commands

| Command   | Description                    | Usage                    |
| --------- | ------------------------------ | ------------------------ |
| `/help`   | Show this help message         | `/help`                  |
| `/exit`   | Exit current agent             | `/exit`                  |
| `/quit`   | Quit current agent             | `/quit`                  |
| `/edit`   | Open editor for prompt         | `/edit [text]`           |
| `/multi`  | Open multiline input editor    | `/multi`                 |

### Scripting Commands

| Command    | Description           | Usage                          |
| ---------- | --------------------- | ------------------------------ |
| `/var`     | Define variables      | `/var $name = value`           |
| `/vars`    | List variables        | `/vars [$name]`                |
| `/list`    | Define lists          | `/list @name = ["item1"]`      |
| `/lists`   | List all lists        | `/lists [@name]`               |
| `/if`      | Conditional execution | `/if $cond { commands }`       |
| `/for`     | Iterate over lists    | `/for $i in @list { cmds }`    |
| `/while`   | Loop while condition  | `/while $cond { commands }`    |
| `/func`    | Define functions      | `/func name($p) => "text"`     |
| `/funcs`   | List functions        | `/funcs [name]`                |
| `/call`    | Call function         | `/call func("arg1", "arg2")`   |
| `/echo`    | Display text/variable | `/echo <text\|$var>`           |
| `/sleep`   | Sleep for seconds     | `/sleep <seconds\|$var>`       |
| `/prompt`  | Prompt for input      | `/prompt $var "message"`       |
| `/confirm` | Yes/no confirmation   | `/confirm $var "message"`      |
| `/script`  | Run command scripts   | `/script [list\|run\|info]`    |

### Git

| Command | Description      | Usage                               |
| ------- | ---------------- | ----------------------------------- |
| `/git`  | Git operations   | `/git <commit\|rollback\|branch>`   |

### Files

| Command | Description      | Usage                            |
| ------- | ---------------- | -------------------------------- |
| `/file` | Manage files     | `/file [action] [files...]`      |

### Search

| Command   | Description      | Usage                    |
| --------- | ---------------- | ------------------------ |
| `/search` | Search files     | `/search <query>`        |

### Testing

| Command   | Description    | Usage                              |
| --------- | -------------- | ---------------------------------- |
| `/test`   | Run tests      | `/test [test_name\|all]`           |
| `/repair` | Auto-fix tests | `/repair [--modify code\|test]`    |

### Queue

| Command   | Description    | Usage                              |
| --------- | -------------- | ---------------------------------- |
| `/queue`  | Manage work queue   | `/queue [list\|add\|results\|remove\|clear\|status\|queues\|create]`  |

### State

| Command       | Description    | Usage                              |
| ------------- | -------------- | ---------------------------------- |
| `/memory`     | Manage memory  | `/memory [list\|add\|clear]`       |
| `/checkpoint` | Checkpoints    | `/checkpoint [create\|restore]`    |
| `/history`    | Browse         | `/history`                         |

### Voice

| Command   | Description    | Usage                              |
| --------- | -------------- | ---------------------------------- |
| `/voice`  | Voice ops      | `/voice [action] <text\|file>`     |

### Sandbox

| Command     | Description    | Usage                    |
| ----------- | -------------- | ------------------------ |
| `/sandbox`  | Sandbox ops    | `/sandbox [action]`      |

### Web Search

| Command     | Description    | Usage                    |
| ----------- | -------------- | ------------------------ |
| `/websearch`| Web search     | `/websearch [action]`    |

### Tasks

| Command   | Description    | Usage                    |
| --------- | -------------- | ------------------------ |
| `/tasks`  | Manage tasks   | `/tasks [list\|clear]`   |

### Data Processing

| Command    | Description     | Usage                      |
| ---------- | --------------- | -------------------------- |
| `/iterable`| Manage iterables| `/iterable define or list` |
| `/foreach` | Foreach prompt  | `/foreach @iterable prompt`|

### Code Analysis

| Command     | Description    | Usage                               |
| ----------- | -------------- | ----------------------------------- |
| `/codebase` | Codebase res   | `/codebase [action] [resources]`    |

### Cloud

| Command | Description    | Usage                    |
| ------- | -------------- | ------------------------ |
| `/aws`  | AWS status     | `/aws status`            |

## Detailed Command Descriptions

### AI and Chat

#### `/tools`

Manage tools available for the chat session.

- **Interactive mode**: Shows tree selection for tools
- **Enable**: Enable specific tools
- **Disable**: Disable specific tools
- **Set**: Set exactly which tools are enabled

#### `/model`

Set or display the AI model used for chat.

- **Interactive mode**: Shows tree selection of models
- **Direct mode**: Set specific model by name
- **Special values**: `auto`, `auto:reasoning`, `auto:frontier`

#### `/compact`

Reduce conversation context by summarizing prior messages
to help with token usage.

#### `/chat`

Send a message to the AI chat service with current model
and system prompt.

#### `/ai`

Configure AI settings and manage model features.

- **Settings**: Update configuration parameters
- **Features**: List, enable, or disable model features
- **Context**: Show context items for chat requests

### Agent Control

#### `/work`

Invoke the agent's work handler with a specified message.

#### `/settings`

Display current agent settings for all configured items.

#### `/reset`

Clear various aspects of agent state.

- **Chat**: Reset conversation history
- **Memory**: Clear memory items
- **Settings**: Reset to defaults
- **All**: Reset everything

#### `/hooks`

Manage registered hooks for agent lifecycle events.

#### `/debug`

Toggle debug logging on/off.

### Scripting

#### `/var` and `/vars`

Variable management for scripting.

- **Define**: Create or assign variables
- **List**: Show all or specific variables
- **Delete**: Remove variables

#### `/list` and `/lists`

List management for scripting.

- **Define**: Create lists with items or from variables
- **List**: Show all or specific lists

#### Control Flow

- **`/if`**: Conditional execution with optional else
- **`/for`**: Iterate over lists with item variables
- **`/while`**: Loop while condition is truthy

#### Functions

- **`/func`**: Define static, LLM, or JavaScript functions
- **`/funcs`**: List and manage functions
- **`/call`**: Execute functions and display results

#### I/O Operations

- **`/echo`**: Display text or variables
- **`/sleep`**: Pause execution
- **`/prompt`**: Get user input
- **`/confirm`**: Get yes/no confirmation

#### Scripts

- **`/script`**: Run predefined command scripts

### Git Commands

#### `/git`

Comprehensive Git operations.

- **Commit**: Save changes with optional message
- **Rollback**: Revert by number of commits
- **Branch**: List, create, switch, or delete branches

### File Commands

#### `/file`

Manage files in the chat session.

- **Select**: Interactive file selection
- **Add/Remove**: Manage file list
- **List**: Show current files
- **Clear**: Remove all files
- **Default**: Reset to configuration defaults

### Search Commands

#### `/search`

Search for text across all files in the project.

### Testing Commands

#### `/test`

Run tests from available TestingServices.

- **List**: Show available tests
- **Specific**: Run individual tests
- **All**: Run all tests

#### `/repair`

Run tests and automatically fix failures using AI.

- **Code**: Only fix underlying code
- **Test**: Only fix test code
- **Either**: Let AI decide approach

### Queue Commands

#### `/queue`

Manage an app-level work queue. Each queue dispatches items to fresh agents of an assigned type,
up to a per-queue concurrency limit. A `default` queue always exists.

- **list**: Show pending items (`--all` to include running)
- **add**: Add a task to a queue
- **results**: Show recently completed results
- **remove**: Remove a pending item by position
- **clear**: Remove all pending items
- **status**: Show a queue's configuration and health
- **queues**: List all configured queues
- **create**: Create a new named queue (`--type`, `--concurrency`)

### State Management

#### `/memory`

Manage short-term memory items.

- **List**: Show all memory items
- **Add/Remove/Update**: Modify memory
- **Clear**: Remove all items

#### `/checkpoint` and `/history`

Save and restore conversation state.

- **Create**: Save current state
- **Restore**: Load previous state
- **List**: Browse available checkpoints

### Voice Commands

#### `/voice`

Voice operations using audio services.

- **Record**: Record from microphone
- **Transcribe**: Convert speech to text
- **Speak**: Convert text to speech
- **Playback**: Play audio files
- **Provider**: Manage audio service providers

### Sandbox Commands

#### `/sandbox`

Container-based development environment.

- **Create**: Start new containers
- **Exec**: Run commands in containers
- **Logs**: View container output
- **Stop/Remove**: Manage containers
- **Status**: Show active container info

### Web Search Commands

#### `/websearch`

Web search capabilities with multiple providers.

- **Search**: General web search
- **News**: Search news articles
- **Fetch**: Retrieve web page content
- **Deep**: Combined search and fetch
- **Provider**: Manage search service providers

### Task Commands

#### `/tasks`

Manage task lists for agent workflows.

- **List**: Show all tasks with status
- **Clear**: Remove all tasks
- **Execute**: Run pending tasks

### Iterables

#### `/iterable` and `/foreach`

Process collections of data.

- **Define**: Create named data collections
- **List/Show/Manage**: Browse iterables
- **Foreach**: Apply prompts to each item

### Codebase

#### `/codebase`

Manage code analysis resources.

- **Select**: Interactive resource selection
- **Enable/Disable**: Control available resources
- **List**: Show enabled resources
- **Repo-map**: Display repository structure

### AWS

#### `/aws`

AWS integration for cloud operations.

- **Status**: Check authentication and account info

## Usage Tips

1. **Interactive Mode**: Many commands support interactive
   selection when called without arguments
2. **Help**: Use `/help` to see all available commands
3. **Tab Completion**: Commands often support tab completion
4. **Multi-line**: Use `/multi` for complex multi-line inputs
5. **Context**: Commands like `/ai context` show what
   information will be sent to AI

## Command Sources

These commands are implemented across multiple packages:

- **Chat Package**: `/tools`, `/model`, `/compact`, `/chat`, `/ai`
- **Agent Package**: `/work`, `/settings`, `/reset`, `/hooks`, `/debug`
- **CLI Package**: `/help`, `/exit`, `/quit`, `/edit`, `/multi`
- **Scripting Package**: All scripting commands (`/var`, `/list`, `/if`)
- **Testing Package**: `/test`, `/repair`
- **Queue Package**: `/queue`
- **Memory Package**: `/memory`
- **Filesystem Packages**: `/file`, `/search`
- **Git Package**: `/git`
- **Voice Package**: `/voice`
- **Sandbox Package**: `/sandbox`
- **Web Search Package**: `/websearch`
- **Tasks Package**: `/tasks`
- **Checkpoint Package**: `/checkpoint`, `/history`
- **Iterables Package**: `/iterable`, `/foreach`
- **Codebase Package**: `/codebase`
- **AWS Package**: `/aws`

Total: **47 commands** across **17 categories**
