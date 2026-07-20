# UI/UX Knowledge Repository

This file maintains knowledge about user interface design, user experience patterns, and design systems in the TokenRing project.

## Project Overview

### Main Applications
1. **Web Frontend** (@tokenring-ai/web-frontend) - Interactive web-based interfaces
2. **CLI Applications** (@tokenring-ai/cli, @tokenring-ai/cli-ink) - Command-line interfaces  
3. **Feedback Systems** (@tokenring-ai/feedback) - User feedback and interaction capture

### Key UI/UX Packages
- **@tokenring-ai/cli**: REPL service with interactive prompts
- **@tokenring-ai/cli-ink**: React Ink-based CLI interface
- **@tokenring-ai/web-frontend**: React frontend with CLI-style interface
- **@tokenring-ai/feedback**: Human feedback tools (questions, file previews, React UI)
- **@tokenring-ai/inquirer-command-prompt**: Interactive command prompt with history
- **@tokenring-ai/inquirer-tree-selector**: Tree-based selections for hierarchical data

## Discovered UI/UX Information

### 1. Package Architecture and Design Patterns

#### Agent-Centric Architecture
The UI design follows an **agent-centric approach** where all functionality is exposed through agent tools and commands. This creates a unified interface pattern across different interaction modalities.

#### Multi-Modal Interface Support
- **Command-Line Interface (CLI)**: REPL-based interactions using Inquirer.js
- **React Ink**: Terminal UI using React components
- **Web Frontend**: Browser-based interface with CLI-style interactions
- **Feedback Systems**: Human-in-the-loop interactions for review and approval

#### Cross-Package UI Integration
The ecosystem shows sophisticated UI integration across packages:
- CLI uses Inquirer.js for interactive prompts (command-prompt, tree-selector)
- Feedback systems integrate with browser previews for file review
- Web-frontend provides unified interface combining CLI and web patterns

### 2. Interaction Design Patterns

#### Command-Based Workflows
- **Slash Commands**: `/help`, `/edit`, `/multi`, `/git`, `/memory`, `/queue`, etc.
- **Agent Selection**: Dynamic agent switching in REPL
- **Context Injection**: Tools for injecting codebases, files, and context into conversations
- **Keyboard Shortcuts**: Ctrl-T for quick actions and navigation

#### Human-in-the-Loop Design
- **File Feedback**: Preview and review files (text/MD/HTML/JSON)
- **React Component Preview**: Browser-based component testing
- **Approval Workflows**: User approval for tasks and modifications
- **Question Systems**: Text, single-choice, and multiple-choice questioning

#### Multi-Agent Orchestration
- **Team Coordination**: Multiple specialized agents working together
- **Agent Communication**: Inter-agent messaging and task delegation
- **Role-Based Interfaces**: Different UI patterns for different agent roles

### 3. User Experience Principles

#### Consistent Interaction Model
All interfaces maintain consistent command patterns and interaction flows across CLI, web, and feedback systems.

#### Progressive Disclosure
- **Tool Registration**: Dynamic tool registration based on available packages
- **Contextual Help**: Agent-specific help and documentation
- **Layered Complexity**: Simple interactions with advanced features available as needed

#### Persistent State
- **Chat Sessions**: Persistent conversations in SQLite
- **Checkpoints**: Agent state persistence across sessions
- **History Management**: Command and conversation history

### 4. Context Injection Design Patterns

#### Three Sophisticated Approaches

**Registry-Based Context Providers**
- Centralized registry system with explicit provider registration
- Priority-based context ordering
- Selective enabling/disabling of context sources
- Token estimation and metadata tracking

**Pipeline-Based Context Assembly**
- Pipeline architecture with stages of processors, filters, transformers
- Composable context processing with collectors, enrichers, filters
- Token budget management and relevance scoring
- Configurable pipeline stages

**Declarative Context Configuration**
- Query language for context requirements
- Declarative specification of context sources
- Runtime query overrides
- Constraint-based context filtering

### 5. Real-Time Communication Architecture

#### WebSocket-Based Communication
```typescript
// Real-time event handling in web frontend
client.on('event:output.chat', (data) => setMessages(m => [...m, {type: 'chat', content: data.content}]));
client.on('event:output.reasoning', (data) => setMessages(m => [...m, {type: 'reasoning', content: data.content}]));
client.on('event:state.busy', (data) => setBusy(true));
client.on('event:human.request', (data) => handleHumanInput(data));
```

#### Event-Driven UI Updates
- **Chat Messages**: Green color for agent responses
- **Reasoning Output**: Yellow for agent thinking process
- **System Messages**: Blue for info, yellow for warnings, red for errors
- **User Input**: Cyan for user messages
- **Busy States**: Loading indicators during processing

### 6. Specialized Design Agents

#### UI/UX Designer Agent
- **Purpose**: Design user interfaces, user experiences, and visual prototypes
- **Capabilities**: Wireframes, design systems, user flows, accessibility guidelines
- **Knowledge Repository**: Maintains `.tokenring/knowledge/ui-ux.md`

#### Product Design Engineer Agent
- **Purpose**: Product enhancement and PRD creation
- **Capabilities**: User experience optimization, feature specification, competitive analysis
- **Focus**: User-centric design thinking with technical constraints

#### API Designer Agent
- **Purpose**: Design and implement REST/GraphQL APIs
- **Capabilities**: API specifications, endpoint design, service contracts
- **Knowledge Repository**: Maintains `.tokenring/knowledge/apis.md`

### 7. Web Frontend Architecture

#### React-Based Interface
```typescript
// Component structure
export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
}
```

#### Features
- **Agent Management**: Select from running agents or create new ones
- **Real-time Display**: All agent events (chat, reasoning, system, input)
- **Responsive Design**: Adapts to different screen sizes
- **Dark Theme**: Terminal-inspired interface for comfortable extended use

### 8. Feedback System Architecture

#### Human Interaction Tools
```typescript
// askHuman tool for human questioning
const result = await askHuman.execute({
  question: "What improvements would you suggest?",
  choices: ["Option A", "Option B", "Option C"],
  response_type: "multiple"
}, agent);

// getFileFeedback for file review
const result = await getFileFeedback.execute({
  filePath: "docs/sample.md",
  content: content,
  contentType: "text/markdown"
}, agent);
```

#### Supported Content Types
- **Text**: Plain text display
- **Markdown**: Rendering with syntax highlighting
- **HTML**: Content in iframe
- **JSON**: Syntax highlighted JSON display
- **React Components**: Browser-based component preview

### 9. CLI Design Patterns

#### Interactive Commands
| Command | Description | Usage |
|---------|-------------|-------|
| `/help` | Show available commands | `/help` |
| `/exit` | Exit current agent | `/exit` |
| `/multi` | Open editor for multiline input | `/multi` |
| `/edit` | Open system editor for prompt | `/edit [text]` |

#### Keyboard Shortcuts
- **Ctrl-T Actions**: Help, create agent, switch agents, exit, detach
- **Navigation**: Arrow keys for command history
- **Cancellation**: Esc and Ctrl-C for operation abort

### 10. Accessibility and Responsive Design

#### Accessibility Features
- **Keyboard Navigation**: Full keyboard support across all interfaces
- **Screen Reader Support**: Semantic HTML and ARIA labels
- **Color Contrast**: Dark theme with appropriate contrast ratios
- **Focus Management**: Automatic focus restoration

#### Responsive Patterns
- **Adaptive Layouts**: Different UI patterns for CLI, web, and mobile
- **Progressive Enhancement**: Core functionality works across all devices
- **Touch-Friendly**: Appropriate touch targets for mobile interfaces

### 11. Design System Components

#### Consistent UI Elements
- **Message Types**: Consistent styling for chat, reasoning, system, input messages
- **Agent Cards**: Unified agent selection and management interface
- **Command Prompts**: Standardized input handling across interfaces
- **Status Indicators**: Consistent busy, idle, and error state displays

#### Theme and Styling
- **Dark Theme**: Primary theme for comfortable extended use
- **Syntax Highlighting**: Code and content highlighting
- **Consistent Colors**: Green (chat), yellow (reasoning), blue (system), cyan (input)
- **Typography**: Consistent font families and sizing

### 12. User Journey Mapping

#### Typical User Flows

**Developer Workflow**:
1. Start CLI or web interface
2. Select or create appropriate agent
3. Ask questions or issue commands
4. Receive AI responses with reasoning
5. Request file modifications or reviews
6. Approve or reject changes
7. Continue conversation or switch agents

**Content Creator Workflow**:
1. Access Writer application
2. Select writing agent
3. Provide content requirements
4. Review generated content
5. Request revisions or edits
6. Publish to target platforms

### 13. Integration with Development Tools

#### File System Integration
- **File Tree Selection**: Hierarchical file browsing with tree-selector
- **Content Preview**: Real-time file content display
- **Edit Integration**: Direct editor integration for file modifications

#### Version Control Integration
- **Git Commands**: Built-in git operations through CLI
- **Change Visualization**: Diff viewing and change tracking
- **Commit Management**: Automated commits with AI-generated messages

### 14. Performance and UX Optimization

#### Real-Time Performance
- **WebSocket Communication**: Low-latency agent communication
- **Incremental Updates**: Partial message rendering for better responsiveness
- **Auto-scroll**: Automatic scrolling to latest messages
- **Focus Management**: Smart input focus restoration

#### Loading States
- **Busy Indicators**: Spinners and progress messages
- **Lazy Loading**: Progressive content loading
- **Error Handling**: Graceful error recovery and user feedback

### 15. Modern WebTerminal Design Analysis

#### Dark Mode UI Design Philosophy
The WebTerminal application implements a sophisticated dark mode interface with:

**Color Palette**:
- **Background**: `#0f0f14` (Deep blue-black)
- **Surfaces**: `#1a1b26` (Slightly lighter dark blue)
- **Hover States**: `#252638` (Mid-tone for interaction feedback)
- **Primary Text**: `#e0e0e0` (Light gray for readability)
- **Secondary Text**: `#a0a0b0` (Dimmed for hierarchy)
- **Accent Color**: `#7c3aed` (Vibrant purple for highlights)
- **Success**: `#4ade80` (Green for positive states)
- **Borders**: `#2a2b3a` (Subtle definition)

#### Layout Architecture
- **Top Navigation Bar**: Clean gradient background with branding and user controls
- **Sidebar Navigation**: Icon-based vertical navigation with tooltips
- **File Explorer**: Tree view with expandable folders and color-coded icons
- **Terminal Interface**: Dockable terminal with command history
- **Chat Interface**: Message bubbles with syntax highlighting
- **Settings Panel**: Organized settings with toggle switches and sliders

#### Interactive Elements
- **Hover States**: Subtle animations and visual feedback
- **Glassmorphism Effects**: Modern UI elements with transparency
- **Smooth Animations**: Micro-interactions and transitions
- **Custom Form Controls**: Styled range sliders, input fields, and buttons
- **Context-Sensitive Menus**: Dynamic menus based on current context

### 16. Human Interface Request Patterns

#### Structured Interaction Types
The system implements a comprehensive human interface request system:

```typescript
export type HumanInterfaceDefinitions = {
  askForConfirmation: {
    request: { message: string; default?: boolean; timeout?: number };
    response: boolean;
  };
  openWebPage: {
    request: { url: string };
    response: boolean;
  };
  askForText: {
    request: { message: string };
    response: string | null;
  };
  askForPassword: {
    request: { message: string };
    response: string | null;
  };
  askForSingleTreeSelection: {
    request: { message?: string; tree: TreeLeaf; initialSelection?: string; loop?: boolean };
    response: string | null;
  };
  askForMultipleTreeSelection: {
    request: { message?: string; tree: TreeLeaf; initialSelection?: Iterable<string>; loop?: boolean };
    response: string[] | null;
  };
};
```

#### Tree-Based Selection Patterns
- **Hierarchical Data**: Tree structures for complex data selection
- **Single Selection**: Pick one item from tree hierarchy
- **Multiple Selection**: Select multiple items with iteration support
- **Initial Selection**: Pre-select items based on context
- **Looping**: Allow users to cycle through options

### 17. Template System UI Patterns

#### AI Template Integration
The template system provides structured prompt management:

**User Stories**:
- **Run Templates**: `/template run <templateName> <input>`
- **List Templates**: `/template list`
- **Template Info**: `/template info <templateName>`

**Template Chaining**:
- Multi-step processing workflows
- Output passing between templates
- Circular reference prevention
- Combined result presentation

#### Command Line Interface Design
```typescript
// Template execution flow
const template = templateRegistry.get("translateToFrench");
const chatRequest = await template("Hello world");
const response = await aiClient.streamChat(chatRequest);
```

### 18. Context Handler Integration Patterns

#### File System Context
The codebase integration provides rich file system context:

**File Tree Display**:
```typescript
// Directory tree generation
yield {
  role: "user",
  content: `// Directory Tree of project files:\n${Array.from(fileTreeFiles).sort().join("\n")}`
};
```

**Complete File Content**:
```typescript
// Full file content with syntax
yield {
  role: "user",
  content: `// Complete contents of file: ${file}\n${content}`
};
```

#### Database Context Integration
Available databases are presented as structured context:

```typescript
yield {
  role: "user",
  content: "/* These are the databases available for the database tool */:\n" +
    available.map((name) => `- ${name}`).join("\n")
};
```

### 19. CLI Vault Interface Design

#### Secure CLI Patterns
The vault CLI implements secure password handling:

**Interactive Password Entry**:
```typescript
async function askPassword(message: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    process.stdin.setRawMode(true);
    // Secure password handling with raw mode
  });
}
```

**Command Structure**:
- `vault init` - Initialize new vault
- `vault get <key>` - Retrieve secret value
- `vault set <key> <value>` - Set secret value
- `vault list` - List all keys
- `vault remove <key>` - Remove secret
- `vault change-password` - Update password
- `vault run <command>` - Execute with secrets

### 20. Documentation Engineering Patterns

#### Hierarchical Documentation Architecture
- **Root Level**: README.md, PACKAGES.md, DEPENDENCIES.md
- **Package Level**: Individual package documentation
- **Application Level**: App-specific documentation
- **Comprehensive Site**: 94+ markdown files with navigation

#### Consistent Documentation Templates
Universal structure pattern across 50+ packages:
- Overview/Purpose
- Installation/Setup
- Package Structure
- Core Components
- Usage Examples
- API Reference
- Tools/Commands
- Configuration
- Dependencies
- Development

#### Cross-Package Integration Documentation
- **Agent-Centric Architecture**: All packages integrate through @tokenring-ai/agent
- **Service Registry Patterns**: Clear service contracts and lifecycle
- **Tool Registration**: Standardized tool interfaces
- **Hook System Integration**: Documented integration patterns

### 21. Visual Design System Standards

#### Border Radius Consistency

- `rounded-sm`: 2px - Small interactive elements, chips
- `rounded-md`: 4px - Default for buttons, inputs, cards (standard)
- `rounded-lg`: 8px - Larger containers, panels, modals, **alerts/toasts**
- `rounded-xl`: 12px - Major containers, overlays
- `rounded-2xl`: 16px - Special decorative elements
- `rounded-full`: 50% - Circular elements, avatars, badges

#### Shadow Hierarchy

- `shadow-sm`: Subtle elevation for inline elements
- `shadow-md`: Standard elevation for cards, panels (primary)
- `shadow-lg`: High elevation for overlays, dropdowns, **toasts**
- `shadow-xl`: Maximum elevation for modals, dialogs
- `shadow-button`: Custom button shadows with color tints

#### Consistent Spacing Patterns

- `p-0.5`/`px-0.5`: 2px - Tight spacing for icons, badges
- `p-1`/`px-1`: 4px - Icon buttons
- `p-1.5`/`px-1.5`: 6px - Small buttons, chips, **icon buttons (standard)**
- `p-2`/`px-2`: 8px - Standard buttons, inputs
- `p-3`/`px-3`: 12px - Medium containers
- `p-4`/`px-4`: 16px - Large containers, panels
- `p-6`/`px-6`: 24px - Major sections

#### Typography Scale

- `text-2xs`: 0.625rem (10px) - Metadata, captions
- `text-xs`: 0.75rem (12px) - Small labels, secondary text
- `text-sm`: 0.875rem (14px) - Standard body text
- `text-base`: 1rem (16px) - Primary content
- `text-lg`: 1.125rem (18px) - Headings, emphasis

#### Focus Ring Standards

- All interactive elements use `.focus-ring` utility
- Consistent ring color: `ring-indigo-500`
- Ring width: 2px
- Ring offset: 2px (when needed)

#### Button Styles

- Primary buttons: `bg-accent hover:bg-accent/90 disabled:bg-accent/50 rounded-lg shadow-button-primary` - *
  *Use `text-primary` for text color, NOT `text-white`, to ensure theme consistency across light and dark modes**
- Secondary buttons: `bg-tertiary hover:bg-hover rounded-md border border-primary`
- Icon buttons: `p-1.5 rounded-md hover:bg-hover`
- Ghost buttons: `p-1.5 rounded-md hover:bg-hover text-muted`
- **Close buttons**: `p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10`

#### Input Styles

- Text inputs: `rounded-md border border-primary bg-input`
- Focus state: `focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20`
- Disabled state: `opacity-50 cursor-not-allowed`

#### Card/Container Styles

- Standard cards: `rounded-xl border border-primary bg-secondary shadow-md`
- Panels: `rounded-lg border border-primary bg-tertiary`
- Overlays: `rounded-xl border border-primary bg-secondary shadow-xl`

#### Message/Content Styles

- Chat messages: `border-l-2 border-transparent hover:border-primary`
- Code blocks: `rounded-lg bg-tertiary p-4 border border-primary shadow-md`
- Inline code: `rounded bg-tertiary px-1.5 py-0.5 border border-primary`

#### Status Indicators

- Online: `bg-indigo-500`
- Busy: `bg-amber-500`
- Error: `bg-red-500`
- Success: `bg-emerald-500`

#### Animation Standards

- Transitions: `transition-colors duration-200`
- Hover states: `hover:bg-hover`
- Active states: `active:scale-[0.98]`
- Loading: `animate-spin`, `animate-pulse`

### 22. Agent Discovery and Selection Patterns

#### Available Agent Context Display
The system presents available agents with clear descriptions:

```typescript
yield {
  role: "user",
  content: '/* The following agents are available for use with agent & task planning tools */\n' +
    Object.entries(agentTypes)
      .filter(([name, config]) => config.callable)
      .map(([name, config]) => `- ${name}: ${config.description}`)
      .join("\n")
};
```

#### Agent Type Filtering
- **Callable Agents**: Only agents that can be invoked are shown
- **Description Integration**: Clear purpose and capabilities for each agent
- **Dynamic Discovery**: Real-time agent availability based on configuration

### 23. External Service Integration Patterns

#### Ghost.io Integration Architecture
Sophisticated external service integration with:

**Service-Based Architecture**:
- **GhostIOService**: Manages API connections and current state
- **Admin API**: For creating/updating/publishing posts
- **Content API**: For reading published posts
- **currentPost**: State management for post selection

**User Interface Patterns**:
- **Post Selection**: Tree-based selection interface
- **Status Display**: Draft/published status with metadata
- **Command Structure**: `/ghost post select`, `/ghost post info`, `/ghost post new`
- **Context Awareness**: Current post state influences available operations

#### State Management for External Services
- **Current Post**: Complete post object with metadata
- **Null State**: Indicates no post selected for creation
- **State Persistence**: Maintained across commands
- **Validation**: Ensures operations match state expectations

### 24. Docker Tool Integration Patterns

#### Complex CLI Tool Integration
Docker container management demonstrates advanced CLI integration:

**Structured Input Validation**:
```typescript
const inputSchema = z.object({
  containers: z.union([z.string(), z.array(z.string())]),
  attach: z.boolean().optional().default(false),
  interactive: z.boolean().optional().default(false),
  timeoutSeconds: z.number().int().optional().default(30),
}).strict();
```

**Progress Feedback Patterns**:
```typescript
agent.infoMessage(`[${name}] Starting container(s): ${containerList.join(", ")}...`);
agent.infoMessage(`[${name}] Executing: ${cmd}`);
agent.infoMessage(`[${name}] Successfully started container(s): ${containerList.join(", ")}`);
```

#### Error Handling and User Feedback
- **Timeout Management**: Configurable timeouts with limits
- **Exit Code Handling**: Proper exit code propagation
- **Output Capture**: STDOUT/STDERR capture and display
- **Container Validation**: Single container to array conversion

### 25. Multi-Modal Interface Consistency

#### Unified Command Patterns
Across all interfaces, consistent command structures:
- **Slash Commands**: `/command [subcommand] [parameters]`
- **Parameter Parsing**: Consistent parameter extraction
- **Help Integration**: Built-in help for all commands
- **Error Messages**: Standardized error response formats

#### Cross-Platform User Experience
- **CLI**: Terminal-based interaction with rich formatting
- **Web**: Browser-based interface with real-time updates
- **Hybrid**: WebTerminal combining both paradigms
- **Service Integration**: External service integration across all platforms

### 26. Advanced User Interaction Patterns

#### Contextual Command Execution
- **Agent-Aware Commands**: Commands adapt based on current agent
- **State-Aware Operations**: Operations validate state before execution
- **Progressive Enhancement**: Advanced features unlock based on context
- **Error Recovery**: Graceful error handling with suggested fixes

#### Dynamic Interface Generation
- **Agent-Specific Tools**: Tools appear based on agent capabilities
- **Context-Aware Menus**: Menus adapt to current context
- **Progressive Disclosure**: Advanced options hidden until needed
- **Intelligent Defaults**: Smart defaults based on user patterns

### 27. Chat Frontend Design System

#### Color Theme Architecture

**CSS Custom Properties (Light Mode)**:

```css
--bg-primary: #fafaf9;
--bg-secondary: #f5f5f4;
--bg-sidebar: #ffffff;
--bg-tertiary: #e7e5e4;
--bg-hover: rgba(0, 0, 0, 0.05);
--border-primary: #e7e5e4;
--accent-primary: #6366f1;
--text-primary: #1c1917;
--text-secondary: #44403c;
--text-muted: #78716c;
--text-dim: #a8a29e;
```

**CSS Custom Properties (Dark Mode)**:

```css
--bg-primary: #171717;
--bg-secondary: #242424;
--bg-sidebar: #242424;
--bg-tertiary: #1a1a1a;
--bg-hover: rgba(255, 255, 255, 0.05);
--border-primary: #444;
--accent-primary: #6366f1;
--text-primary: #fafafa;
--text-secondary: #e5e5e5;
--text-muted: #a3a3a3;
--text-dim: #737373;
```

#### Component Styling Standards

**Warning/Alert Components**:

- Use `AlertTriangle` icon from lucide-react
- Background: `bg-amber-500/10` (subtle) or `bg-amber-50 dark:bg-amber-900/20` (banner)
- Border: `border-amber-500/30`
- Text: `text-primary` for theme consistency
- Close button: `p-1.5 rounded-md` with `focus-ring` utility
- Icon size: `w-4 h-4` or `w-5 h-5`

**Message Components**:

- Container: `flex flex-row items-start gap-3 px-3 py-3`
- Border-left: `border-l-2` with color coding by message type
- Background by type:
 - User input: `bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500/50`
 - Question with response: `bg-cyan-50/30 dark:bg-cyan-500/5 border-cyan-500/30`
 - Interaction: `bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-500/30`
 - Default: `hover:bg-hover border-transparent hover:border-primary`

**Code Blocks**:

- Container: `bg-tertiary p-4 rounded-lg border border-primary shadow-md`
- Copy button: `p-1.5 rounded-md bg-secondary hover:bg-hover opacity-0 group-hover:opacity-100`
- Inline code: `rounded bg-tertiary px-1.5 py-0.5 border border-primary`

**Button Standards**:

- All interactive elements use `.focus-ring` utility
- Icon buttons: `p-1.5 rounded-md hover:bg-hover`
- Close buttons: `p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10`

#### Icon Usage Standards

**Lucide React Icons**:

- Always use lucide-react icons (no inline SVGs)
- Standard sizes: `w-3 h-3`, `w-3.5 h-3.5`, `w-4 h-4`, `w-5 h-5`
- Color classes use theme colors: `text-muted`, `text-primary`, `text-amber-500`
- Avoid `fill="currentColor"` on lucide icons (use default stroke)

#### Consistency Guidelines

**Typography Consistency**:

- Use theme color classes (`text-primary`, `text-muted`, `text-dim`) instead of hardcoded colors
- Avoid `text-slate-*` or other Tailwind default colors
- Use `text-2xs` for metadata, `text-xs` for small labels, `text-sm` for body

**Border Consistency**:

- Use `border-primary` for theme-consistent borders
- Avoid hardcoded border colors like `border-yellow-500/30`
- Use `border-amber-500/30` for warning states

**Shadow Consistency**:

- Use predefined shadow utilities: `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-card`, `shadow-button`
- Custom shadows follow pattern: `shadow-lg shadow-indigo-600/20`

**Spacing Consistency**:

- Follow established spacing scale: `p-0.5`, `p-1`, `p-1.5`, `p-2`, `p-3`, `p-4`, `p-6`
- Use gap utilities consistently: `gap-2`, `gap-3`, `gap-2.5`

#### Recent Fixes Applied

**StorageErrorBanner Component** (Fixed):

- **Border Radius**: Added `rounded-lg` for consistent alert styling (was missing)
- **Border Style**: Changed from `border-b` only to full `border border-amber-500/30 dark:border-amber-500/50` for
  better visual definition
- **Button Padding**: Updated from `p-0.5 rounded` to `p-1.5 rounded-md` per design system standards
- **Text Colors**: Changed from inherited colors to explicit `text-primary` for theme consistency
- **Icon Color**: Close icon now uses `text-primary` for consistency
- **Shadow**: Added `shadow-md` for proper visual elevation of banner
- **Typography**: Maintained `text-sm` for body, `text-2xs` for metadata with `text-primary/70`
- **Accessibility**: Maintained `focus-ring` utility and proper ARIA attributes
- **Layout**: Used `gap-3` for consistent spacing between elements

**StorageWarning Component** (Previously Fixed):

- **Border Radius**: Changed from `rounded-md` to `rounded-lg` for alert components
- **Button Padding**: Updated from `p-0.5 rounded` to `p-1.5 rounded-md` per design system
- **Icon Sizing**: Standardized close icon to `w-4 h-4` (was `w-3.5 h-3.5`)
- **Text Color**: Changed from `text-amber-200` to `text-primary` for theme consistency
- **Icon Color**: AlertTriangle now uses `text-amber-600 dark:text-amber-400` for better contrast
- **Spacing**: Updated from `px-3 py-2 gap-2` to `px-4 py-3 gap-3` for better visual balance
- **Typography**: Changed from `text-xs` to `text-sm` for improved readability
- **Removed Shadow**: Inline warnings don't need shadows (banners use shadows)
- **Accessibility**: Maintained `focus-ring` utility and proper ARIA attributes

**PendingQuestions Component** (Fixed):

- **Color Classes**: Replaced undefined `text-warning` and `bg-warning` classes with proper Tailwind colors (
  `text-amber-600 dark:text-amber-400`, `bg-amber-500/10`)
- **Consistency**: All warning states now use amber color palette consistently

**InlineQuestion Component** (Fixed):

- **Color Classes**: Replaced undefined `text-success`, `text-warning`, and `bg-success` classes with proper Tailwind
  colors
- **Text Colors**: `text-amber-600 dark:text-amber-400` for warning states, `text-emerald-600 dark:text-emerald-400` for
  success
- **Background**: `bg-emerald-500/10` for success states
- **Border**: Changed `bg-dim/30` to `bg-primary/30 dark:bg-primary/20` for theme consistency

**MessageComponent**:

- Updated question text from `text-slate-800 dark:text-slate-300` to `text-primary`
- Improved code formatting and consistency

**ChatInputContext**:

- Updated error message text for clarity and consistency

**Toast Component** (Fixed):

- **Border Radius**: Changed from `rounded-card` (rounded-xl) to `rounded-lg` for proper alert/toast sizing per design
  system (section 21)
- **Border Style**: Updated semantic color borders from `/50` to `/30` opacity for more subtle, consistent borders
- **Background**: Updated dark mode backgrounds from `/90` to `/20` opacity for more subtle, non-distracting alerts
- **Button Padding**: Updated close button from `p-0.5 rounded` to `p-1.5 rounded-md` per icon button standards (section
  21)
- **Button Hover**: Changed from `hover:bg-black/20` to `hover:bg-black/10 dark:hover:bg-white/10` for better
  cross-theme consistency
- **Icon Sizing**: Maintained `w-4 h-4` for close icon (consistent with design system), `w-5 h-5` for type indicator
  icons
- **Spacing**: Maintained `gap-3`, `px-4 py-3` for proper visual balance
- **Typography**: `text-sm` for both title and message (consistent body text sizing per section 21)
- **Accessibility**: Maintained `focus-ring` utility, proper ARIA labels (`role="alert"`, `aria-live`)
- **Shadow**: Uses `shadow-lg` for proper toast elevation per shadow hierarchy (section 21)
- **Layout**: `min-w-75 max-w-md` for responsive width constraints

#### Visual Consistency Checklist

When reviewing or creating UI components, verify:

- [ ] **Border Radius**: Use appropriate radius for component type (rounded-md for buttons, rounded-lg for
  alerts/panels)
- [ ] **Icon Sizing**: Use standard sizes (w-4 h-4 for icons in alerts, w-3.5 h-3.5 for small buttons)
- [ ] **Button Padding**: Use p-1.5 for icon buttons, p-0.5 for tight close buttons
- [ ] **Text Colors**: Use theme colors (text-primary, text-muted) instead of hardcoded colors
- [ ] **Border Colors**: Use border-primary or semantic colors (border-amber-500/30 for warnings)
- [ ] **Spacing**: Follow established scale (px-4 py-3 for alerts, gap-3 for flex containers)
- [ ] **Typography**: Use text-sm for body text in alerts, text-xs for metadata
- [ ] **Accessibility**: All interactive elements have focus-ring and proper ARIA labels
- [ ] **Hover States**: Consistent hover:bg-hover with transition-colors
- [ ] **Shadow Usage**: Apply shadows appropriately (none for inline, shadow-md for cards/panels, shadow-lg for toasts)

### 28. Semantic Color System

#### Design Token Utilities

The chat frontend (`frontend/chat/src/index.css`) provides a comprehensive set of semantic color utilities for
consistent theming:

**Background Utilities**:

```css
.bg-primary     /* var(--bg-primary) - Main page background */
.bg-secondary   /* var(--bg-secondary) - Secondary surfaces */
.bg-tertiary    /* var(--bg-tertiary) - Tertiary surfaces */
.bg-hover       /* var(--bg-hover) - Hover states */
.bg-active      /* var(--bg-active) - Active/selected states */
.bg-accent      /* var(--accent-primary) - Primary accent color */
```

**Semantic Background Colors**:

```css
.bg-error       /* bg-red-500 */
.bg-error/10    /* bg-red-500/10 - Subtle error background */
.bg-error/20    /* bg-red-500/20 - Medium error background */
.bg-warning     /* bg-amber-500 */
.bg-warning/10  /* bg-amber-500/10 - Subtle warning background */
.bg-warning/20  /* bg-amber-500/20 - Medium warning background */
.bg-success     /* bg-emerald-500 */
.bg-success/10  /* bg-emerald-500/10 - Subtle success background */
.bg-success/20  /* bg-emerald-500/20 - Medium success background */
```

**Border Utilities**:

```css
.border-primary   /* var(--border-primary) - Theme-consistent borders */
.border-error     /* border-red-500 */
.border-warning   /* border-amber-500 */
.border-success   /* border-emerald-500 */
```

**Text Utilities**:

```css
.text-primary     /* var(--text-primary) - Primary text */
.text-secondary   /* var(--text-secondary) - Secondary text */
.text-muted       /* var(--text-muted) - Muted/dimmed text */
.text-dim         /* var(--text-dim) - Very dimmed text */
.text-accent      /* var(--accent-primary) - Accent text */
.text-error       /* text-red-500 */
.text-warning     /* text-amber-500 */
.text-success     /* text-emerald-500 */
```

**Toast-Specific Utilities** (with WCAG AA contrast ratios):

```css
.bg-toast-success   /* bg-emerald-50 dark:bg-emerald-900/20 */
.bg-toast-error     /* bg-red-50 dark:bg-red-900/20 */
.bg-toast-info      /* bg-blue-50 dark:bg-blue-900/20 */
.bg-toast-warning   /* bg-amber-50 dark:bg-amber-900/20 */

.text-toast-success /* text-emerald-900 dark:text-emerald-100 */
.text-toast-error   /* text-red-900 dark:text-red-100 */
.text-toast-info    /* text-blue-900 dark:text-blue-100 */
.text-toast-warning /* text-amber-900 dark:text-amber-100 */

.border-toast-success /* border-emerald-500/30 */
.border-toast-error   /* border-red-500/30 */
.border-toast-info    /* border-blue-500/30 */
.border-toast-warning /* border-amber-500/30 */
```

#### Color Usage Guidelines

**Primary Theme Colors** (`--bg-primary`, `--text-primary`, etc.):

- Use for main UI elements that follow the theme (light/dark)
- Always prefer these over hardcoded Tailwind colors
- Ensure consistency across parent and child components

**Semantic Colors** (error, warning, success):

- Use for status indicators, alerts, and feedback messages
- Background opacity variants (`/10`, `/20`) for subtle backgrounds
- Direct color classes (`text-error`, `border-warning`) for icons and borders

**Toast Colors**:

- Use toast-specific utilities for toast notifications
- These provide proper WCAG AA contrast ratios in both light and dark modes
- Combine `bg-toast-*`, `text-toast-*`, and `border-toast-*` for complete toast styling

**Accent Color**:

- Use `bg-accent` and `text-accent` for primary actions and highlights
- Hover states: `hover:bg-accent/90`
- Disabled states: `disabled:bg-accent/50`

**Recent Color System Updates (2024)**

**App.tsx Refactoring**:

- Replaced `bg-red-500/10` with `bg-error/10`
- Replaced `text-red-500` with `text-error`
- Replaced `bg-indigo-600` with `bg-accent`
- Replaced `hover:bg-indigo-700` with `hover:bg-accent/90`
- Replaced `disabled:bg-indigo-400` with `disabled:bg-accent/50`
- Replaced `bg-amber-500/10` with `bg-warning/10`
- Replaced `text-amber-500` with `text-warning`
- Replaced gradient `from-cyan-500 via-indigo-500 to-indigo-600` with `from-accent via-accent to-accent`
- Replaced `selection:bg-indigo-500/30` with `selection:bg-active`
- **Replaced hardcoded `text-white` with `text-primary` on accent buttons** - Ensures theme consistency and proper
  contrast in both light and dark modes. Primary buttons with `bg-accent` backgrounds should use `text-primary` instead
  of hardcoded `text-white` to maintain visual coherence across themes.

**StorageErrorBanner Component**:

- Replaced `bg-amber-50 dark:bg-amber-900/90` with `bg-warning/10`
- Replaced `border-amber-500/30 dark:border-amber-500/50` with `border-warning/30`
- Replaced `text-amber-600 dark:text-amber-400` with `text-warning`
- Replaced `hover:bg-amber-200/50 dark:hover:bg-amber-800/50` with `hover:bg-warning/20`

**StorageWarning Component**:

- Replaced `bg-amber-500/10` with `bg-warning/10`
- Replaced `border-amber-500/30` with `border-warning/30`
- Replaced `text-amber-600 dark:text-amber-400` with `text-warning`
- Replaced `hover:bg-amber-500/20` with `hover:bg-warning/20`

**Toast Component**:

- Now uses toast-specific utilities for proper contrast
- `border-toast-success`, `bg-toast-success`, `text-toast-success` pattern
- Maintains WCAG AA contrast ratios in both light and dark modes

#### Accessibility Considerations

**Contrast Ratios**:

- All text colors meet WCAG AA minimum contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Toast colors use darker text on light backgrounds and lighter text on dark backgrounds
- Semantic color backgrounds use low opacity (`/10`, `/20`) to maintain text readability

**Color Blindness**:

- Semantic states (error, warning, success) should always include icons in addition to color
- Never rely solely on color to convey information
- Use patterns, icons, and text labels alongside color indicators

**Focus Indicators**:

- All interactive elements must have visible focus rings
- Use `.focus-ring` utility for consistent focus styling
- Focus rings use `ring-gray-500/15` for subtle but visible indication

This comprehensive UI/UX architecture demonstrates a sophisticated, multi-modal approach to AI agent interaction, emphasizing human-centered design, accessibility, and consistent user experiences across different platforms and interaction modes.
