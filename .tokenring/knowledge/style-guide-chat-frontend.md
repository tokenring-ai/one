# Chat Frontend Style Guide

This document defines the visual and interactive design standards for the TokenRing chat frontend application.

## Table of Contents

- [Color Palette](#color-palette)
- [Typography](#typography)
- [Spacing & Sizing](#spacing--sizing)
- [Component Patterns](#component-patterns)
- [Animations & Transitions](#animations--transitions)
- [Accessibility](#accessibility)
- [Responsive Design](#responsive-design)
- [Common Utility Patterns](#common-utility-patterns)

---

## Color Palette

### Background Colors (CSS Variables)

The application uses a dual-mode theme system with CSS variables for light and dark modes.

**Dark Mode (Default)**

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| Deep Black | `#0a0a0a` | `--bg-primary` | Main background |
| Surface | `#141414` | `--bg-secondary` | Card backgrounds, panels |
| Hover Surface | `rgba(255, 255, 255, 0.05)` | `--bg-hover` | Hover states, interactive elements |
| Border | `#262626` | `--border-primary` | Borders, dividers |
| Panel Background | `#1a1a1a` | `--bg-tertiary` | Modal backgrounds, overlays |
| Input Background | `#1a1a1a` | `--bg-input` | Input field backgrounds |

**Light Mode (Paper Theme)**

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| Paper White | `#fafaf9` | `--bg-primary` | Main background with subtle texture |
| Light Paper | `#f5f5f4` | `--bg-secondary` | Card backgrounds, panels |
| Paper Hover | `rgba(0, 0, 0, 0.05)` | `--bg-hover` | Hover states, interactive elements |
| Paper Border | `#e7e5e4` | `--border-primary` | Borders, dividers |
| Tertiary | `#e7e5e4` | `--bg-tertiary` | Modal backgrounds, overlays |
| Input Background | `#ffffff` | `--bg-input` | Input field backgrounds |

### Text Colors

**Dark Mode**

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| Primary Text | `#fafafa` | `--text-primary` | Main content text |
| Secondary Text | `#e5e5e5` | `--text-secondary` | Labels, metadata |
| Muted Text | `#a3a3a3` | `--text-muted` | Disabled states, placeholders |
| Dimmed Text | `#737373` | `--text-dim` | Subtle hints, icons |

**Light Mode**

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| Primary Text | `#1c1917` | `--text-primary` | Main content text |
| Secondary Text | `#44403c` | `--text-secondary` | Labels, metadata |
| Muted Text | `#78716c` | `--text-muted` | Disabled states, placeholders |
| Dimmed Text | `#a8a29e` | `--text-dim` | Subtle hints, icons |

### Accent Colors

| Color Name | Hex Code | CSS Variable | Usage |
|------------|----------|--------------|-------|
| Indigo (Primary) | `#6366f1` | `--accent-primary` | Primary buttons, active states, focus rings |
| Cyan (Info) | `#06b6d4` | — | Information, system messages |
| Purple (Secondary) | `#a855f7` | — | Secondary actions, highlights |
| Amber (Warning) | `#f59e0b` | — | Warnings, busy states |
| Emerald (Success) | `#10b981` | — | Success states, checkmarks |
| Red (Error) | `#ef4444` | — | Errors, alerts |

### Message Types

```tsx
// Chat messages with specific styling
const messageStyles = {
  chat: 'text-primary',              // Default text for chat messages
  reasoning: 'text-secondary italic', // Yellow-tinged - reasoning steps
  system: 'text-muted',              // Subtle - system messages
  input: 'text-indigo-900 dark:text-indigo-100 font-medium', // User input
  error: 'text-red-700 dark:text-red-400', // Error states
  warning: 'text-amber-700 dark:text-amber-400', // Warning states
  info: 'text-secondary',            // Information messages
  artifact: 'text-blue-700 dark:text-blue-400', // Artifact output
  question: 'text-cyan-800 dark:text-cyan-300', // Question requests
  response: 'text-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 px-2 py-1 rounded', // Question responses
};
```

### Status Colors

| Status | Color | Usage |
|--------|-------|-------|
| Idle | `#6366f1` (Indigo) | Agent idle, online state |
| Busy | `#f59e0b` (Amber) | Agent busy, processing state |
| Available | `#10b981` (Emerald) | Model/tool available state |
| Selected | `#6366f1` (Indigo) | Currently selected item |
| Disabled | `#737373` (Gray) | Disabled states |
| Error | `#ef4444` (Red) | Error states |
| Warning | `#f59e0b` (Amber) | Warning states |

---

## Typography

### Font Family

**Configuration** (from `vite.config.ts` and `index.css`)

```tsx
// Primary font - System sans-serif with Inter fallback
font-family: "Inter", system-ui, -apple-system, sans-serif

// Monospace - JetBrains Mono / Fira Code fallback
font-family: "JetBrains Mono", "Fira Code", monospace
```

**Usage:**
```tsx
// Primary font (default)
className="font-sans"

// Monospace for code/terminal elements
className="font-mono"
```

### Font Sizes (Tailwind + Custom)

| Size | Class | Usage | Pixels |
|------|-------|-------|--------|
| Extra Small | `text-xs` | Labels, metadata, badges | 12px |
| Small | `text-sm` | Body text, inputs | 14px |
| Medium | `text-base` | Headings, important text | 16px |
| Large | `text-lg` | Section headers | 18px |
| XL | `text-xl` | Page titles | 20px |
| 2XS (Custom) | `text-2xs` | Tiny text, badges | 10px |

### Font Weights

```tsx
// Body text
className="font-normal"

// Emphasized text
className="font-medium"

// Headings
className="font-semibold"

// Important text
className="font-bold"

// Code elements
className="font-mono font-medium"
```

### Line Heights

```tsx
// Tight for headings
className="leading-tight"

// Normal for body
className="leading-normal"

// Relaxed for long text
className="leading-relaxed"

// Custom line height for chat elements
className="h-lh" // Heroic line height
```

### Text Colors Utility

```tsx
// Primary text
className="text-primary"

// Secondary text
className="text-secondary"

// Muted text
className="text-muted"

// Dimmed text
className="text-dim"

// Accent primary
className="accent-primary"
```

---

## Spacing & Sizing

### Spacing Scale (Tailwind)

```tsx
// Margin and padding scale
className="p-1"   // 4px
className="p-2"   // 8px
className="p-3"   // 12px
className="p-4"   // 16px
className="p-6"   // 24px
className="p-8"   // 32px

className="m-1"   // 4px
className="m-2"   // 8px
className="m-4"   // 16px
className="m-6"   // 24px
className="m-8"   // 32px

// Gap scale (for flexbox/grid)
className="gap-1" // 4px
className="gap-2" // 8px
className="gap-3" // 12px
className="gap-4" // 16px
```

### Component Sizing

```tsx
// Input fields
className="h-10 px-3 py-2 text-sm"

// Buttons
className="h-9 px-4 text-sm"

// Small buttons
className="h-8 px-3 text-xs"

// Large buttons
className="h-12 px-6 text-base"

// Icons
className="w-4 h-4"   // Small icons
className="w-5 h-5"   // Medium icons
className="w-6 h-6"   // Large icons
className="w-8 h-8"   // Extra large icons
className="w-12 h-12" // Hero icons

// Avatars
className="w-8 h-8 rounded-full"
className="w-10 h-10 rounded-full"
className="w-12 h-12 rounded-full"

// Borders
className="border-2"
className="border"
className="border-t"
className="border-b"
className="border-l"
className="border-r"
```

### Border Radius

```tsx
// Small radius
className="rounded-md"   // 4px - Buttons, inputs

// Medium radius
className="rounded-lg"   // 8px - Cards, panels

// Large radius
className="rounded-xl"   // 12px - Modal dialogs

// Full radius
className="rounded-full" // 9999px - Avatars, badges

// Rounded button
className="rounded-button" // Custom utility for rounded-lg
```

### Custom Utility Classes

```css
/* From index.css */
.text-2xs { font-size: 0.625rem; line-height: 0.875rem; }
.icon-xs { width: 0.75rem; height: 0.75rem; }
.icon-sm { width: 0.875rem; height: 0.875rem; }
.icon-md { width: 1rem; height: 1rem; }
.icon-lg { width: 1.25rem; height: 1.25rem; }
.icon-xl { width: 1.5rem; height: 1.5rem; }

.rounded-card { @apply rounded-xl; }
.rounded-button { @apply rounded-lg; }
.rounded-input { @apply rounded-md; }

.btn-ghost { @apply transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2; }
.btn-icon { @apply p-2 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2; }
```

---

## Component Patterns

### Chat Layout Structure

**Location:** `frontend/chat/src/pages/ChatPage.tsx`

**Structure:**
```tsx
<div className="h-full flex flex-col">
  {/* Toast Container */}
  <ToastContainer toasts={toasts || []} onRemove={removeToast} />
  
  {/* Overlay Components */}
  <FileBrowserOverlay
    agentId={agentId}
    isOpen={showFileBrowser}
    onClose={() => setShowFileBrowser(false)}
  />
  
  {/* Main Chat Interface */}
  <ChatHeader agentId={agentId} idle={idle} />
  
  <div className="flex flex-col flex-1 overflow-hidden">
    <AutoScrollContainer>
      <MessageList messages={messages} agentId={agentId} busyWith={busyWith} />
    </AutoScrollContainer>
    
    <ChatFooter
      agentId={agentId}
      input={input}
      setInput={setInput}
      inputError={inputError}
      setInputError={setInputError}
      idle={idle}
      waitingOn={waitingOn}
      statusLine={statusLine}
      availableCommands={filteredAvailableCommands}
      commandHistory={commandHistory}
      showHistory={showHistory}
      setShowHistory={setShowHistory}
      setShowFileBrowser={setShowFileBrowser}
      onSubmit={handleSubmit}
    />
  </div>
</div>
```

**Key Design Elements:**
- Full-height flex container
- Header and footer with fixed positioning (shrink-0)
- Auto-scroll container for message list
- Overlay system for modals and file browser
- Responsive layout with flex-1 for content area

---

### Chat Header

**Location:** `frontend/chat/src/components/chat/ChatHeader.tsx`

**Features:**
- Responsive header with mobile menu button
- Agent status indicator (idle/busy)
- Model selector, tool selector, theme toggle, notifications
- Connection status indicator

**Implementation:**

```tsx
<header 
  aria-label="Chat controls" 
  className="h-14 border-b border-primary flex items-center justify-between px-6 bg-secondary z-10 shrink-0"
>
  <div className="flex items-center gap-4">
    {/* Mobile menu button */}
    <button
      onClick={toggleMobileSidebar}
      className="md:hidden w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/10 active:scale-95 transition-transform focus-ring"
      aria-label="Toggle sidebar menu"
    >
      <Zap className="w-4 h-4 text-white" fill="currentColor"/>
    </button>

    {/* Agent status indicator */}
    <div className="flex items-center gap-2.5">
      <div className={`w-2 h-2 rounded-full ${idle ? 'bg-indigo-500' : 'bg-amber-500'} animate-pulse`} 
           aria-label={idle ? 'Agent is idle' : 'Agent is busy'} 
           role="status" />
      <span className="text-xs font-medium text-muted">
        {agent.data?.config.name}
      </span>
    </div>
  </div>

  {/* Right side controls */}
  <div className="flex items-center gap-3">
    {!isOnline && (
      <div className="flex items-center gap-1.5 text-red-400 text-xs">
        <WifiOff size={14} />
        <span>Offline</span>
      </div>
    )}
    <ModelSelector agentId={agentId} />
    <ToolSelector agentId={agentId} />
    <LightDarkSelector />
    <NotificationMenu />
  </div>
</header>
```

**Key Design Elements:**
- Gradient button for mobile menu (cyan to purple)
- Status indicator with pulse animation
- Consistent spacing (gap-3, gap-4)
- Focus-visible rings for accessibility
- Connection status indicator (WiFi icon for offline)
- Responsive design with mobile-only menu button

---

### Chat Footer

**Location:** `frontend/chat/src/components/chat/ChatFooter.tsx`

**Features:**
- Command input with auto-resize textarea
- Command suggestions dropdown
- Send/abort button (contextual)
- Status bar with keyboard shortcuts
- Command history panel
- File attachment button

**Implementation:**

```tsx
<footer className="shrink-0 bg-secondary border-t border-primary relative">
  <div className="relative">
    <div className="flex items-start gap-4 px-6 py-4">
      {/* Prompt character */}
      <div className="shrink-0 h-lh items-center flex justify-center select-none text-lg">
        <span className="text-indigo-500 font-bold">&gt;</span>
      </div>

      {/* Textarea */}
      <div className="flex-1 relative pt-0.75">
        <label htmlFor="chat-input" className="sr-only">Command or message input</label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setInputError(false);
          }}
          onKeyDown={handleKeyDown}
          disabled={!idle || !!waitingOn}
          rows={1}
          className={`w-full bg-transparent border-none focus:ring-0 resize-none text-sm font-mono text-primary placeholder-muted p-0 leading-relaxed outline-none disabled:opacity-50 ${
            inputError ? 'placeholder:text-red-400/50' : ''
          }`}
          placeholder={inputError ? 'Please enter a message or command...' : 'Execute command or send message...'}
          spellCheck="false"
          aria-label="Command or message input"
          aria-describedby={availableCommands.length > 0 ? 'command-suggestions' : undefined}
          aria-invalid={inputError}
          aria-required="true"
          style={{ height: 'auto', minHeight: '1.5rem', maxHeight: '12rem' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${target.scrollHeight}px`;
          }}
        />

        {/* Command suggestions */}
        <AnimatePresence>
          {availableCommands.length > 0 && (
            <motion.div
              id="command-suggestions"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full left-0 right-0 mb-2 flex flex-wrap gap-2 p-3 bg-secondary/95 border border-primary rounded-md shadow-xl z-20"
              role="listbox"
              aria-label="Command suggestions"
              aria-activedescendant={`cmd-${selectedSuggestion}`}
            >
              {availableCommands.map((cmd, idx) => (
                <button
                  key={cmd}
                  id={`cmd-${idx}`}
                  onClick={() => {
                    setInput(`/${cmd} `);
                    textareaRef.current?.focus();
                  }}
                  className={`text-2xs font-mono px-2 py-1 rounded transition-colors cursor-pointer ${
                    idx === selectedSuggestion ? 'bg-indigo-600 text-white' : 'bg-tertiary hover:bg-hover text-indigo-400'
                  }`}
                  role="option"
                  aria-selected={idx === selectedSuggestion}
                >
                  /{cmd}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Send/Abort button */}
      <div className="shrink-0">
        {idle ? (
          <button
            aria-label="Send message"
            onClick={onSubmit}
            className="p-2 rounded hover:bg-hover transition-colors text-muted hover:text-primary focus-ring"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            aria-label="Abort agent"
            onClick={() => agentRPCClient.abortAgent({ agentId, reason: 'User abort' })}
            className="p-2 rounded hover:bg-hover transition-colors text-muted hover:text-red-400 focus-ring"
          >
            <Square className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>

    {/* Status bar */}
    <div className="min-h-10 py-2 bg-secondary border-t border-primary flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 gap-2 sm:gap-0">
      <div className="flex items-center gap-2 order-2 sm:order-1">
        {/* File attachment button */}
        <button
          aria-label="Attach file or context"
          onClick={() => setShowFileBrowser(true)}
          className="p-1.5 rounded hover:bg-hover transition-colors text-muted hover:text-primary focus-ring"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <button
          aria-label={showHistory ? 'Hide command history' : 'Show command history'}
          onClick={() => setShowHistory(!showHistory)}
          disabled={commandHistory.length === 0}
          className="p-1.5 rounded hover:bg-hover transition-colors text-muted hover:text-primary focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <History className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex items-center gap-2 order-1 sm:order-2" aria-live="polite" aria-atomic="true">
        {/* Status indicator */}
        <div className={`w-2 h-2 ${idle ? 'bg-indigo-500' : 'bg-amber-500'} rounded-full animate-pulse`} 
             aria-label={idle ? 'Agent is online' : 'Agent is busy'} 
             role="status" />
        <span className={`text-2xs ${idle ? 'text-indigo-400' : 'text-amber-400'} font-mono uppercase`}>
          {idle ? 'Online' : 'Busy'}
        </span>
      </div>
    </div>
  </div>

  {/* Keyboard shortcuts info */}
  <div className="h-6 bg-tertiary flex items-center justify-between px-6 select-none">
    <div className="flex items-center gap-4">
      <span className="text-2xs text-muted font-mono line-clamp-1">{statusLine || 'Ready'}</span>
      <span className="text-2xs text-dim font-mono">{input.length} chars</span>
    </div>
    <div className="hidden sm:flex items-center gap-2 text-2xs text-dim">
      <span className="hidden md:inline">
        <kbd className="px-1.5 py-0.5 bg-tertiary rounded text-primary font-mono">Enter</kbd> 
        Send • 
        <kbd className="px-1.5 py-0.5 bg-tertiary rounded text-primary font-mono">Shift+Enter</kbd> 
        New line
      </span>
      <span className="md:hidden">⏎ Send</span>
    </div>
  </div>
</footer>
```

**Key Design Elements:**
- Monospace font for input consistency
- Auto-resize textarea with dynamic height calculation
- Command suggestions with Framer Motion animations
- Contextual Send/Abort button based on agent state
- Status bar with keyboard shortcuts
- Color-coded status indicator (indigo/amber)
- File attachment button with clipboard icon
- Character count display
- Responsive keyboard shortcut display

---

### Message List

**Location:** `frontend/chat/src/components/chat/MessageList.tsx`

**Features:**
- Session start divider
- Message components with animations
- Busy state indicator with bouncing dots
- Virtualized rendering with react-virtuoso

**Implementation:**

```tsx
<Virtuoso
  data={allItems}
  followOutput="smooth"
  initialTopMostItemIndex={allItems.length - 1}
  itemContent={(index, item) => {
    if (item.type === 'header') {
      return (
        <>
          <div className="h-4" />
          <div className="px-6 py-4 flex items-center gap-4 text-zinc-300 select-none">
            <div className="h-px bg-zinc-600 flex-1" />
            <span className="text-[10px] uppercase tracking-widest">
              Session Start • {messages[0]?.timestamp ? new Date(messages[0].timestamp).toLocaleDateString() : 'New Session'}
            </span>
            <div className="h-px bg-zinc-600 flex-1" />
          </div>
        </>
      );
    }
    if (item.type === 'busy') {
      return (
        <div className="flex items-center gap-4 px-6 py-2 animate-pulse">
          <div className="mt-0.5 shrink-0 w-4 flex justify-center">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
          <div className="text-zinc-300 text-sm leading-relaxed">{item.data}...</div>
        </div>
      );
    }
    const msg = item.data;
    return (
      <MessageComponent
        msg={msg}
        agentId={agentId}
        hasResponse={msg.type === 'question.request' ? answeredQuestions.has(msg.requestId) : false}
      />
    );
  }}
/>
```

**Key Design Elements:**
- Virtualized rendering for performance
- Session divider with date
- PopLayout animation for smooth message transitions
- Bouncing dots for busy state (0ms, 150ms, 300ms delay)
- Consistent spacing (gap-4, px-6, py-4)
- Answered question tracking

---

### Auto Scroll Container

**Location:** `frontend/chat/src/components/chat/AutoScrollContainer.tsx`

**Features:**
- Auto-scroll to bottom on new messages
- Manual scroll-to-bottom button
- Resize observer for dynamic content
- Mutation observer for DOM changes
- Persistent scroll position when user scrolls up

**Implementation:**

```tsx
<div className="relative flex-1 overflow-hidden">
  <main
    ref={scrollRef}
    onScroll={handleScroll}
    className={`flex-1 overflow-y-auto p-0 flex flex-col font-mono text-sm relative scroll-smooth bg-primary h-full ${className}`}
  >
    <div ref={contentRef} className="flex flex-col min-h-full pb-4">
      {children}
    </div>
  </main>

  {/* Scroll to bottom button */}
  <AnimatePresence>
    {showScrollButton && (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        onClick={scrollToBottom}
        className="absolute right-4 bottom-4 p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors z-20 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        title="Scroll to bottom"
        aria-label="Scroll to bottom of chat"
      >
        <ChevronDown className="w-4 h-4" />
      </motion.button>
    )}
  </AnimatePresence>
</div>
```

**Key Design Elements:**
- Fixed position scroll button with Framer Motion
- Indigo background with hover state
- Shadow for depth
- Focus-visible ring for accessibility
- Smart scroll detection (at bottom threshold)
- Resize and mutation observers for content changes

---

### Message Component

**Location:** `frontend/chat/src/components/chat/MessageComponent.tsx`

**Features:**
- Message type-specific styling
- Copy to clipboard functionality
- Framer Motion animations
- Markdown rendering with GFM support
- Code block syntax highlighting
- Artifact display (images, code, JSON, HTML, diffs)
- Downloadable artifacts
- Timestamp formatting

**Implementation:**

```tsx
<motion.div
  variants={{
    hidden: { opacity: 0, x: -4 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' as any } },
  }}
  initial="hidden"
  animate="visible"
  className={`group relative flex flex-row items-start gap-3 px-3 py-3 transition-colors border-l-2 ${
    msg.type === 'input.received' 
      ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500/50' 
      : 'hover:bg-hover border-transparent hover:border-primary'
  }`}
>
  {/* Icon */}
  <div className="shrink-0 w-6 flex justify-center items-center prose prose-sm">
    {messageIcon}
  </div>

  {/* Content */}
  <div className={`prose prose-sm dark:prose-invert ${events[msg.type].style}`}>
    {msg.type === 'output.artifact' ? (
      <ArtifactDisplay artifact={msg} />
    ) : msg.type === 'question.response' ? (
      <p>Response: {JSON.stringify(msg.result)}</p>
    ) : msg.type === 'reset' ? (
      <p>Reset: {msg.what.join(', ')}</p>
    ) : msg.type === 'abort' ? (
      <p>Aborted{msg.reason ? `: ${msg.reason}` : ''}</p>
    ) : msg.type === 'input.handled' ? (
      <p>[{msg.status}] {msg.message}</p>
    ) : msg.type === 'input.received' ? (
      <p>{msg.message}</p>
    ) : msg.type === 'question.request' && !hasResponse ? (
      <InlineQuestion request={msg} agentId={agentId} />
    ) : 'message' in msg ? (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ node, inline, className, children, ...props }: any) => {
            const content = String(children).replace(/\n$/, '');
            return inline ? (
              <code className={className} {...props}>{children}</code>
            ) : (
              <CodeBlock className={className}>{content}</CodeBlock>
            );
          }
        }}
      >
        {msg.message}
      </ReactMarkdown>
    ) : null}

    <MessageFooter 
      msg={msg} 
      onDownload={msg.type === 'output.artifact' ? () => {
        const decodedBody = msg.encoding === 'base64' ? Buffer.from(msg.body, 'base64') : msg.body;
        const blob = new Blob([decodedBody], { type: msg.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = msg.name;
        a.click();
        URL.revokeObjectURL(url);
      } : undefined}
    />
  </div>
</motion.div>
```

**Message Type Styles:**

```tsx
const events: Record<AgentEventEnvelope['type'], EventConfig> = {
  'agent.created': {
    style: 'text-emerald-700 dark:text-emerald-400 font-medium',
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-emerald-500" />,
  },
  'agent.stopped': {
    style: 'text-rose-800 dark:text-rose-400 font-medium',
    icon: <div className="w-[1em] h-[1em] mt-1 rounded-full bg-rose-500" />,
  },
  'output.info': {
    style: 'text-secondary',
    icon: <Info className="w-[1em] text-blue-500/70" />,
  },
  'output.warning': {
    style: 'text-amber-700 dark:text-amber-400',
    icon: <Info className="w-[1em] text-amber-500/70" />,
  },
  'output.error': {
    style: 'text-red-700 dark:text-red-400',
    icon: <Info className="w-[1em] text-red-500/70" />,
  },
  'output.artifact': {
    style: 'text-blue-700 dark:text-blue-400',
    icon: <FileCode className="w-[1em] text-muted" />,
  },
  'output.chat': {
    style: 'text-primary',
    icon: <Bot className="w-[1em] text-muted" />,
  },
  'output.reasoning': {
    style: 'text-secondary italic',
    icon: <Zap className="w-[1em] text-amber-500" />,
  },
  'input.received': {
    style: 'text-indigo-900 dark:text-indigo-100 font-medium',
    icon: <span className="text-indigo-500 font-bold flex items-center">&gt;</span>,
  },
  'input.handled': {
    style: 'text-emerald-700 dark:text-emerald-400 font-medium',
    icon: <span className="text-emerald-500 font-bold flex items-center">✓</span>,
  },
  'question.request': {
    style: 'text-cyan-800 dark:text-cyan-300',
    icon: <span className="text-cyan-500 font-bold flex items-center">?</span>,
  },
  'question.response': {
    style: 'text-cyan-800 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-950/30 px-2 py-1 rounded border border-cyan-100 dark:border-cyan-900/50',
    icon: <span className="text-cyan-500 font-bold flex items-center">!</span>,
  },
  'reset': {
    style: 'text-purple-700 dark:text-purple-400',
    icon: <span className="text-purple-500 font-bold flex items-center">↺</span>,
  },
  'abort': {
    style: 'text-red-700 dark:text-red-400 font-medium',
    icon: <Square className="w-[1em] text-red-500" />,
  },
};
```

**Key Design Elements:**
- Slide-in animation from left
- Type-specific background colors and icons
- Copy button with state feedback (copied highlight)
- Monospace timestamps with format: `HH:MM:SS`
- Markdown rendering with GFM support
- Code block syntax highlighting
- Artifact display with type-specific icons
- Download functionality for artifacts

---

### Toast Notification System

**Location:** `frontend/chat/src/components/ui/toast.tsx`

**Features:**
- Multiple toast types (success, error, info, warning)
- Auto-dismiss with configurable duration
- Stacking support
- Framer Motion animations
- ARIA live regions
- Keyboard accessible (ESC to close)

**Implementation:**

```tsx
// Toast component
<motion.div
  initial={{ opacity: 0, x: 100, scale: 0.95 }}
  animate={{ opacity: 1, x: 0, scale: 1 }}
  exit={{ opacity: 0, x: 100, scale: 0.95 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className={cn(
    'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-75 max-w-md',
    toastStyles[type]
  )}
  role="alert"
  aria-live={type === 'error' ? 'assertive' : 'polite'}
>
  <Icon className="w-5 h-5 shrink-0 mt-0.5" />
  <div className="flex-1 min-w-0">
    {title && <h4 className="font-medium text-sm mb-1">{title}</h4>}
    <p className="text-sm leading-relaxed wrap-break-word">{message}</p>
  </div>
  {onClose && (
    <button
      onClick={() => setIsVisible(false)}
      className="shrink-0 p-0.5 rounded hover:bg-black/20 transition-colors"
      aria-label="Close toast"
    >
      <X className="w-4 h-4" />
    </button>
  )}
</motion.div>

// Toast container
<div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 pointer-events-none">
  <AnimatePresence mode="popLayout">
    {toasts.map((toast) => (
      <div key={toast.id} className="pointer-events-auto">
        <Toast {...toast} onClose={() => toast.id && onRemove(toast.id)} />
      </div>
    ))}
  </AnimatePresence>
</div>
```

**Toast Types:**

```tsx
const toastStyles = {
  success: 'border-emerald-500/50 bg-emerald-900/90 text-emerald-100',
  error: 'border-red-500/50 bg-red-900/90 text-red-100',
  info: 'border-blue-500/50 bg-blue-900/90 text-blue-100',
  warning: 'border-amber-500/50 bg-amber-900/90 text-amber-100',
};

// Usage
toastManager.success('Operation completed');
toastManager.error('Something went wrong');
toastManager.info('New message received');
toastManager.warning('Action required');

// With options
toastManager.error('Failed to save', {
  duration: 5000,
  title: 'Error'
});
```

**Key Design Elements:**
- Slide-in from right with scale effect
- Type-specific colors and borders
- Close button with hover state
- Stacking from bottom-right
- ARIA live regions for screen readers
- Auto-dismiss functionality
- Keyboard accessible (ESC to close)

---

### Dropdown Menu

**Location:** `frontend/chat/src/components/ui/dropdown-menu.tsx`

**Features:**
- Radix UI primitives
- Custom styling with dark theme
- Focus management
- Keyboard navigation
- Portal for proper z-index

**Implementation:**

```tsx
const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuContent = React.forwardRef<...>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-32 overflow-hidden rounded-lg border bg-secondary border-primary p-1 shadow-lg",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))

const DropdownMenuItem = React.forwardRef<...>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm outline-none transition-colors hover:bg-hover focus:bg-hover text-primary",
      className
    )}
    {...props}
  />
))
```

**Key Design Elements:**
- Portal for proper z-index stacking
- Side offset for visibility
- Hover and focus states
- Consistent padding and spacing
- Keyboard navigation support
- Focus management

---

### Select Component

**Location:** `frontend/chat/src/components/ui/select.tsx`

**Features:**
- Radix UI primitives
- Custom styling
- Checkmark indicator
- Search functionality
- Disabled state support

**Implementation:**

```tsx
const SelectTrigger = React.forwardRef<...>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-lg border bg-input border-primary px-3 py-2 text-sm text-primary focus:outline-none focus:border-focus disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))

const SelectItem = React.forwardRef<...>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none hover:bg-hover focus:bg-hover text-primary transition-colors",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-accent" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
```

**Key Design Elements:**
- Consistent height (h-9)
- Checkmark indicator for selected items
- ChevronDown icon
- Disabled state styling
- Hover and focus states

---

### File Browser Overlay

**Location:** `frontend/chat/src/components/overlay/file-browser.tsx`

**Features:**
- File browser overlay with focus trap
- Directory navigation with breadcrumbs
- File search functionality (debounced)
- File upload capability (max 5MB)
- Hidden file toggle
- File selection for chat context
- File preview with markdown/code editing
- Download functionality
- File metadata display
- Resizable preview pane
- Keyboard accessible navigation

**Implementation:**

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
  <div ref={initialFocusRef} tabIndex={-1} className="w-full max-w-6xl h-[85vh] bg-secondary border border-primary rounded-card shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/5 relative file-browser-container">
    
    {/* Window Controls & Header */}
    <div className="h-12 border-b border-primary flex items-center justify-between px-4 bg-secondary shrink-0 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted">
          <Folder size={16} />
          <span className="text-xs font-medium tracking-wide">File Browser</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-input border border-primary rounded-md py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 w-48 transition-all focus-ring"
          />
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-primary transition-colors focus-ring"
          aria-label="Close file browser"
        >
          <X size={20} />
        </button>
      </div>
    </div>
    
    {/* Browser Body */}
    <div className="flex flex-1 min-h-0">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-primary min-w-0">
        {/* Breadcrumbs & Toolbar */}
        <div className="h-10 border-b border-primary flex  px-4 shrink-0">
          <div className="flex flex-1 items-center gap-1 text-xs text-muted min-w-0">
            <button
              className="hover:text-primary cursor-pointer shrink-0 focus-ring rounded px-1"
              onClick={() => setPath('.')}
              aria-label="Go to root directory"
            >
              root
            </button>
            {/* Breadcrumb navigation */}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHiddenFiles(!showHiddenFiles)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-button hover:bg-hover text-muted text-2xs transition-colors focus-ring"
              aria-label={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
            >
              {showHiddenFiles ? <EyeOff size={12} /> : <Eye size={12} />}
              {showHiddenFiles ? 'Hide' : 'Show'} Hidden
            </button>
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <table className="w-full text-left border-collapse">
            {/* Table header and rows */}
          </table>
        </div>
      </div>
      
      {/* Right Sidebar - File Info */}
      <div className="w-80 bg-tertiary border-l border-primary flex flex-col shrink-0 hidden md:flex">
        {/* File info and preview */}
      </div>
    </div>
    
    {/* Bottom Preview Pane */}
    {selectedFile && (
      <div style={{ height: `${previewHeight}px` }} className="bg-tertiary border-t border-primary flex flex-col shrink-0 relative">
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-indigo-500/50 transition-colors z-10"
          aria-label="Resize preview pane"
        />
        {/* Preview content */}
      </div>
    )}
  </div>
</div>
```

**File Type Icons:**

```tsx
const getFileIcon = (file: string, isDir: boolean, size = 16) => {
  if (isDir) return <Folder className="text-indigo-400" size={size} />;
  if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.jsx')) {
    return <FileText className="text-cyan-500" size={size} />;
  }
  if (file.endsWith('.json')) return <Code className="text-amber-500" size={size} />;
  if (file.endsWith('.md')) return <FileText className="text-purple-400" size={size} />;
  if (file.match(/\.(png|jpe?g|gif|svg|webp)$/i)) return <ImageIcon className="text-purple-400" size={size} />;
  return <FileText className="text-muted" size={size} />;
};
```

**Key Design Elements:**
- Modal overlay with backdrop blur
- File tree with expand/collapse
- Checkboxes for selection
- File type color coding
- Search functionality with debounce
- Preview pane with resize handle
- Upload functionality with file size limit (5MB)
- Hidden file toggle

---

### Model Selector

**Location:** `frontend/chat/src/components/ModelSelector.tsx`

**Features:**
- Provider-based grouping
- Search functionality
- Availability indicators
- Currently selected model highlighting
- Auto-expand with selected model
- Provider icons and color coding

**Implementation:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-hover transition-colors cursor-pointer group focus-ring" role="button" aria-haspopup="true" aria-expanded="false">
      {isSelecting || currentModel.isLoading ? (
        <>
          <Cpu className="w-3.5 h-3.5 text-muted animate-spin" />
          <span className="text-xs font-mono text-muted truncate max-w-64">Loading...</span>
        </>
      ) : (
        <>
          <Cpu className="w-3.5 h-3.5 text-muted group-hover:text-primary" />
          <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-64">
            {currentModel.data?.model ?? 'Select model...'}
          </span>
        </>
      )}
    </div>
  </DropdownMenuTrigger>

  {hasModels && (
    <DropdownMenuContent className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-xl" style={{ width: '560px' }} aria-label="Select AI model">
      {/* Search Box */}
      <div className="relative group px-3 py-2 shrink-0 border-b border-primary">
        <div className="relative">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Filter models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input border border-primary rounded-lg py-1.5 pl-9 pr-3 text-xs text-primary placeholder-muted focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Tree List Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 space-y-0.5">
        {Object.entries(groupedModels).map(([provider, models]) => (
          <div key={provider} className="flex flex-col">
            {/* Provider Header */}
            <div
              className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-2 transition-colors group select-none focus-ring"
              onClick={() => {
                setExpandedProviders(prev => {
                  const next = new Set(prev);
                  if (next.has(provider)) {
                    next.delete(provider);
                  } else {
                    next.add(provider);
                  }
                  return next;
                });
              }}
              tabIndex={0}
              role="button"
              aria-expanded={isProviderExpanded}
            >
              <span className="w-5 flex items-center justify-center text-muted group-hover:text-primary">
                <svg className="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isProviderExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  )}
                </svg>
              </span>
              <div className="flex-1 flex items-center gap-2 text-primary text-xs font-medium">
                <span className={providerColor}>{providerIcon}</span>
                {provider}
              </div>
              <span className="text-2xs font-mono text-muted px-1.5">
                {models.length}
              </span>
            </div>

            {/* Model List */}
            <AnimatePresence>
              {isProviderExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col pl-5 mt-0.5 space-y-0.5 border-l border-primary ml-2 overflow-hidden"
                >
                  {models.map((model) => (
                    <div
                      key={model.modelId}
                      onClick={() => handleSelectModel(model.modelId)}
                      className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-3 transition-colors group focus-ring"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectModel(model.modelId);
                        }
                      }}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 shadow-[0_0_6px_rgba(0,0,0,0.1)] dark:shadow-[0_0_6px_rgba(0,0,0,0.3)] ${
                          currentModel.data?.model === model.modelId
                            ? 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]'
                            : model.available
                              ? 'bg-emerald-500'
                              : 'bg-tertiary'
                        }`}
                      />
                      <span className={`flex-1 text-xs font-mono truncate ${
                        currentModel.data?.model === model.modelId 
                          ? 'text-indigo-600 dark:text-indigo-400 font-medium' 
                          : 'text-muted group-hover:text-primary'
                      }`}>
                        {model.modelName}
                      </span>
                      {currentModel.data?.model === model.modelId && (
                        <Check className="w-3 h-3 text-indigo-400 ml-2 shrink-0" aria-label="Currently selected" />
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </DropdownMenuContent>
  )}
</DropdownMenu>
```

**Provider Colors:**

```tsx
const providerIcons: Record<string, React.ReactNode> = {
  anthropic: <RiAnthropicFill />,
  azure: <TbBrandAzure />,
  cerebras: <RiCpuFill />,
  deepseek: <RiCodeBoxFill />,
  google: <RiGeminiFill />,
  groq: <RiFlashlightFill />,
  openai: <RiOpenaiFill />,
  openrouter: <TbArrowsSplit2 />,
  qwen: <RiAlibabaCloudFill />,
  xai: <RiCloudFill />,
  zai: <RiZhihuFill />
};

const providerColors: Record<string, string> = {
  anthropic: 'text-indigo-600 dark:text-indigo-400',
  azure: 'text-blue-600 dark:text-blue-400',
  cerebras: 'text-amber-600 dark:text-amber-500',
  deepseek: 'text-cyan-600 dark:text-cyan-500',
  google: 'text-blue-500 dark:text-blue-400',
  groq: 'text-orange-600 dark:text-orange-500',
  openai: 'text-zinc-900 dark:text-white',
  openrouter: 'text-purple-600 dark:text-purple-400',
  qwen: 'text-pink-600 dark:text-pink-500',
  xai: 'text-zinc-800 dark:text-zinc-100',
  zai: 'text-green-600 dark:text-green-500',
};
```

**Key Design Elements:**
- Provider grouping with expand/collapse
- Search functionality across all models
- Availability indicators (green = available, gray = unavailable)
- Currently selected model with checkmark and indigo styling
- Provider-specific colors and icons
- Auto-expand provider with currently selected model
- Keyboard accessible navigation

---

### Tool Selector

**Location:** `frontend/chat/src/components/ToolSelector.tsx`

**Features:**
- Package-based grouping
- Enable/disable functionality
- Search functionality
- Selection count indicators
- Category-level toggle
- Package icons and color coding

**Implementation:**

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded hover:bg-hover transition-colors cursor-pointer group">
      <RiStackFill className="w-3.5 h-3.5 text-muted group-hover:text-primary" />
      <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">
        {enabledTools.data?.tools?.length ?? 0} enabled
      </span>
    </div>
  </DropdownMenuTrigger>

  <DropdownMenuContent className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-xl" style={{ width: '560px' }} aria-label="Select AI tools">
    <div className="relative group px-3 py-2 shrink-0 border-b border-primary">
      <div className="relative">
        <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Filter tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-input border border-primary rounded-lg py-1.5 pl-9 pr-3 text-xs text-primary placeholder-muted focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 space-y-0.5">
      {Object.keys(filteredToolsByCategory.grouped).sort().map((category) => {
        const isPackageExpanded = expandedCategories.has(category);
        const packageIcon = packageIcons[category] || <RiDatabaseFill />;
        const packageColor = packageColors[category] || packageColors.default;

        let categoryTools = filteredToolsByCategory.grouped[category];
        let toolCount = Object.keys(categoryTools).length;
        let enabledToolCount = 0;
        for (const [, toolName] of Object.entries(categoryTools)) {
          if (enabledTools.data?.tools?.includes(toolName)) enabledToolCount++;
        }

        const allEnabled = enabledToolCount === toolCount;
        const allDisabled = enabledToolCount === 0;

        return (
          <div key={category} className="flex flex-col">
            <div className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-2 transition-colors group select-none">
              <div
                className="w-5 flex items-center justify-center text-muted group-hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(category)) {
                      next.delete(category);
                    } else {
                      next.add(category);
                    }
                    return next;
                  });
                }}
              >
                <svg className="w-3 h-3 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPackageExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  )}
                </svg>
              </div>

              <div
                className="flex-1 flex items-center gap-2 text-primary text-xs font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(category)) {
                      next.delete(category);
                    } else {
                      next.add(category);
                    }
                    return next;
                  });
                }}
              >
                <span className={packageColor}>{packageIcon}</span>
                {category}
              </div>

              <div
                className="flex items-center gap-1.5 cursor-pointer hover:bg-hover rounded px-1.5 py-0.5 transition-colors border border-transparent hover:border-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCategory(category, categoryTools);
                }}
                title={allEnabled ? "Disable all tools" : allDisabled ? "Enable all tools" : "Toggle all tools"}
              >
                <span className="text-2xs font-mono text-muted">
                  {enabledToolCount}/{toolCount}
                </span>
                {allEnabled ? (
                  <RiCheckboxCircleFill className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                ) : allDisabled ? (
                  <RiCheckboxBlankCircleLine className="w-3.5 h-3.5 text-muted hover:text-emerald-500" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded border-2 border-muted flex items-center justify-center">
                    <span className="text-[8px] text-muted leading-none">{enabledToolCount}</span>
                  </div>
                )}
              </div>
            </div>

            {isPackageExpanded && (
              <div className="flex flex-col pl-5 mt-0.5 space-y-0.5 border-l border-primary ml-2">
                {Object.entries(categoryTools).map(([displayName, toolName]) => {
                  const isEnabled = enabledSet.has(toolName);
                  return (
                    <div
                      key={toolName}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTool(toolName);
                      }}
                      className="flex items-center cursor-pointer py-1.5 hover:bg-hover rounded-md px-3 transition-colors group"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 shadow-[0_0_6px_rgba(0,0,0,0.1)] dark:shadow-[0_0_6px_rgba(0,0,0,0.3)] ${
                          isEnabled
                            ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                            : 'bg-zinc-300 dark:bg-zinc-600'
                        }`}
                      />
                      <span className={`flex-1 text-xs font-mono truncate ${
                        isEnabled
                          ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-muted group-hover:text-primary'
                      }`}>
                        {displayName}
                      </span>
                      {isEnabled ? (
                        <RiCheckLine className="w-3 h-3 text-emerald-600 dark:text-emerald-500 ml-2 shrink-0" aria-label="Enabled" />
                      ) : (
                        <RiCloseLine className="w-3 h-3 text-muted ml-2 shrink-0" aria-label="Disabled" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {filteredToolsByCategory.categories.size === 0 && (
        <div className="px-3 py-4 text-center text-xs text-muted">
          No tools found matching "{searchQuery}"
        </div>
      )}
    </div>
  </DropdownMenuContent>
</DropdownMenu>
```

**Package Colors:**

```tsx
const packageIcons: Record<string, React.ReactNode> = {
  '@tokenring-ai/agent': <RiRobotFill />,
  '@tokenring-ai/ai-client': <RiDatabaseFill />,
  '@tokenring-ai/websearch': <RiGlobeFill />,
  '@tokenring-ai/filesystem': <RiCodeBoxFill />,
  '@tokenring-ai/memory': <RiCloudFill />,
  '@tokenring-ai/git': <RiGitBranchFill />,
  '@tokenring-ai/testing': <RiBugFill />,
  '@tokenring-ai/codebase': <RiFileCodeFill />,
  '@tokenring-ai/code-watch': <RiEyeFill />,
  '@tokenring-ai/file-index': <RiFileSearchFill />,
  '@tokenring-ai/iterables': <RiRepeatFill />,
  '@tokenring-ai/scripting': <RiCodeSSlashFill />,
  '@tokenring-ai/tasks': <RiTaskFill />,
  '@tokenring-ai/slack': <RiSlackFill />,
  '@tokenring-ai/telegram': <RiTelegramFill />,
  '@tokenring-ai/feedback': <RiQuestionAnswerFill />,
  '@tokenring-ai/blog': <RiArticleFill />,
  '@tokenring-ai/ghost-io': <RiArticleFill />,
  '@tokenring-ai/wordpress': <RiWordpressFill />,
  '@tokenring-ai/newsrpm': <RiNewsFill />,
  '@tokenring-ai/reddit': <RiRedditFill />,
  '@tokenring-ai/audio': <RiMicFill />,
  '@tokenring-ai/linux-audio': <RiMicFill />,
  '@tokenring-ai/sandbox': <RiCodeBoxFill />,
  '@tokenring-ai/docker': <RiServerFill />,
  '@tokenring-ai/kubernetes': <RiServerFill />,
  '@tokenring-ai/aws': <RiAmazonFill />,
  '@tokenring-ai/mcp': <RiDatabaseFill />,
  '@tokenring-ai/research': <RiSparklingFill />,
  '@tokenring-ai/cli': <RiTerminalBoxFill />,
  '@tokenring-ai/cli-ink': <RiTerminalBoxFill />,
  '@tokenring-ai/web-host': <RiServerFill />,
};

const packageColors: Record<string, string> = {
  '@tokenring-ai/agent': 'text-indigo-600 dark:text-indigo-400',
  '@tokenring-ai/ai-client': 'text-blue-600 dark:text-blue-400',
  '@tokenring-ai/websearch': 'text-cyan-600 dark:text-cyan-400',
  '@tokenring-ai/filesystem': 'text-emerald-600 dark:text-emerald-400',
  '@tokenring-ai/memory': 'text-purple-600 dark:text-purple-400',
  '@tokenring-ai/git': 'text-orange-600 dark:text-orange-500',
  '@tokenring-ai/testing': 'text-pink-600 dark:text-pink-500',
  '@tokenring-ai/codebase': 'text-amber-600 dark:text-amber-500',
  '@tokenring-ai/code-watch': 'text-yellow-600 dark:text-yellow-500',
  '@tokenring-ai/file-index': 'text-red-600 dark:text-red-500',
  '@tokenring-ai/iterables': 'text-teal-600 dark:text-teal-500',
  '@tokenring-ai/scripting': 'text-lime-600 dark:text-lime-500',
  '@tokenring-ai/tasks': 'text-green-600 dark:text-green-500',
  '@tokenring-ai/slack': 'text-indigo-600 dark:text-indigo-500',
  '@tokenring-ai/telegram': 'text-blue-600 dark:text-blue-500',
  '@tokenring-ai/feedback': 'text-purple-600 dark:text-purple-500',
  '@tokenring-ai/blog': 'text-cyan-600 dark:text-cyan-500',
  '@tokenring-ai/ghost-io': 'text-rose-600 dark:text-rose-500',
  '@tokenring-ai/wordpress': 'text-blue-500 dark:text-blue-400',
  '@tokenring-ai/newsrpm': 'text-orange-600 dark:text-orange-500',
  '@tokenring-ai/reddit': 'text-red-600 dark:text-red-500',
  '@tokenring-ai/audio': 'text-violet-600 dark:text-violet-500',
  '@tokenring-ai/linux-audio': 'text-violet-600 dark:text-violet-500',
  '@tokenring-ai/sandbox': 'text-blue-600 dark:text-blue-500',
  '@tokenring-ai/docker': 'text-blue-600 dark:text-blue-500',
  '@tokenring-ai/kubernetes': 'text-cyan-600 dark:text-cyan-500',
  '@tokenring-ai/aws': 'text-orange-600 dark:text-orange-500',
  '@tokenring-ai/mcp': 'text-pink-600 dark:text-pink-500',
  '@tokenring-ai/research': 'text-purple-600 dark:text-purple-500',
  '@tokenring-ai/cli': 'text-emerald-600 dark:text-emerald-500',
  '@tokenring-ai/cli-ink': 'text-emerald-600 dark:text-emerald-500',
  '@tokenring-ai/web-host': 'text-orange-600 dark:text-orange-500',
  default: 'text-muted',
};
```

**Key Design Elements:**
- Package grouping with expand/collapse
- Search functionality across all tools
- Enable/disable toggle with state feedback
- Selection count indicators (green = all enabled, yellow = partial, gray = all disabled)
- Package-specific colors and icons
- Category-level enable/disable functionality
- Keyboard accessible navigation

---

### Sidebar

**Location:** `frontend/chat/src/components/Sidebar.tsx`

**Features:**
- Responsive (collapsible on desktop, slide-in on mobile)
- Loading states for all sections
- Keyboard navigation support
- ARIA labels and roles
- Active state indicators for current agent
- Agent status (idle/busy) with animated spinners
- Mobile menu toggle with keyboard support

**Implementation:**

```tsx
<aside
  aria-label="Navigation sidebar"
  className={`fixed md:relative border-r border-primary bg-primary flex flex-col shrink-0 overflow-hidden h-full z-40 transition-all duration-300 ease-in-out md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarExpanded ? 'w-80' : 'w-16'} top-0 left-0 md:static`}
>
  {/* Header */}
  <div className={`p-4 flex items-center shrink-0 ${isSidebarExpanded ? 'justify-between' : 'justify-between md:justify-center'}`}>
    <div
      className="flex items-center gap-3 cursor-pointer group"
      onClick={isSidebarExpanded ? () => navigateAndClose('/') : toggleSidebar}
    >
      <div className={`w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/10 shrink-0 transition-transform duration-200 ${!isSidebarExpanded ? 'group-hover:scale-110' : ''}`}>
        <Zap className="w-5 h-5 text-white" fill="currentColor" />
      </div>
      {isSidebarExpanded && (
        <h1 className="text-primary font-bold tracking-tight text-lg">TokenRing</h1>
      )}
    </div>

    {isSidebarExpanded && (
      <button onClick={toggleSidebar} className="hidden md:block text-muted hover:text-primary transition-colors p-1">
        <PanelLeftClose className="w-5 h-5" />
      </button>
    )}
  </div>

  {/* Content */}
  {isSidebarExpanded ? (
    <div className="flex-1 px-3 py-2 space-y-6 overflow-y-auto">
      {/* Active Agents */}
      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <h2 className="text-[10px] font-bold text-amber-600/90 uppercase tracking-widest flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Active Agents
          </h2>
          <span className="text-[9px] text-muted">{activeAgentsList.length} running</span>
        </div>
        {agents.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-muted animate-spin" />
          </div>
        ) : (
          <div className="space-y-1">
            {activeAgentsList.map((agent) => (
              <div
                key={agent.id}
                onClick={() => navigateAndClose(`/agent/${agent.id}`)}
                className={`group flex items-center gap-3 px-3 py-2 rounded transition-colors cursor-pointer ${currentAgentId === agent.id ? 'bg-secondary/50' : 'hover:bg-secondary/30'}`}
              >
                <div className="shrink-0">
                  {agent.idle ? (
                    <Pause className="w-3.5 h-3.5 text-muted" />
                  ) : (
                    <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${currentAgentId === agent.id ? 'text-primary' : 'text-secondary'}`}>{agent.name}</div>
                  <div className="text-[9px] text-muted mt-0.5 truncate">{agent.statusMessage || (agent.idle ? 'Agent is idle' : 'Agent is busy')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflows */}
      <div>
        <h2 className="text-[10px] font-bold text-cyan-600/90 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
          <Play className="w-4 h-4" />
          Workflows
        </h2>
        {/* Workflow items */}
      </div>

      {/* Agent Templates */}
      <div>
        <h2 className="text-[10px] font-bold text-purple-400/90 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
          <User className="w-4 h-4" />
          Agent Templates
        </h2>
        {/* Template items */}
      </div>
    </div>
  ) : (
    <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto">
      {/* Collapsed mode: Show icons only */}
      <div className="group flex items-center justify-center p-2 rounded transition-colors cursor-pointer">
        <Cpu className="w-5 h-5 text-amber-600" />
      </div>
    </div>
  )}

  {/* Footer */}
  {isSidebarExpanded && (
    <div className="p-4 border-t border-primary shrink-0 hidden md:block">
      <button className="flex items-center gap-3 w-full px-3 py-2 text-muted hover:text-secondary transition-colors cursor-pointer">
        <Settings className="w-4 h-4" />
        <span className="text-sm">Preferences</span>
      </button>
    </div>
  )}
</aside>
```

**Key Design Elements:**
- Gradient logo button
- Collapsible sidebar with smooth transition
- Status indicators (idle/busy with spinners)
- Loading states with spinners
- Section headers with uppercase tracking
- Hover effects on interactive items
- Responsive design with mobile slide-in

---

### Inline Question Component

**Location:** `frontend/chat/src/components/question/InlineQuestion.tsx`

**Features:**
- Expandable/collapsible question panels
- Multiple input types (text, file, tree, form)
- Auto-submit countdown timer
- Keyboard navigation
- Focus management

**Implementation:**

```tsx
<div ref={containerRef} className="mt-3 border border-primary rounded-lg overflow-hidden bg-secondary/50" role="region" aria-labelledby={`question-title-${request.requestId}`}>
  {/* Header */}
  <div
    ref={headerRef}
    onClick={() => setIsExpanded(!isExpanded)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsExpanded(!isExpanded);
      }
    }}
    className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    tabIndex={0}
    role="button"
    aria-expanded={isExpanded}
    aria-controls={`question-content-${request.requestId}`}
    id={`question-title-${request.requestId}`}
  >
    <div className="flex items-center gap-2">
      <span className="text-accent text-sm font-medium">
        {request.message || 'Please provide input'}
      </span>
    </div>
    <div className="flex items-center gap-2">
      {countdown !== null && countdown > 0 && (
        <span className="text-[10px] text-accent font-medium">
          {countdown}s
        </span>
      )}
      <span className="text-[10px] text-muted uppercase font-medium">
        {question.type}
      </span>
      {isExpanded ? (
        <ChevronDown size={14} className="text-tertiary" aria-hidden="true" />
      ) : (
        <ChevronRight size={14} className="text-tertiary" aria-hidden="true" />
      )}
    </div>
  </div>

  {/* Content */}
  {isExpanded && (
    <div
      id={`question-content-${request.requestId}`}
      className="border-t border-primary"
      role="region"
      aria-labelledby={`question-title-${request.requestId}`}
      onKeyDown={handleKeyDown}
    >
      {question.type === 'treeSelect' && (
        <TreeInlineQuestion question={question} agentId={agentId} requestId={request.requestId} onClose={() => setIsExpanded(false)} />
      )}
      {question.type === 'text' && (
        <TextInlineQuestion question={question} agentId={agentId} requestId={request.requestId} onClose={() => setIsExpanded(false)} />
      )}
      {question.type === 'fileSelect' && (
        <FileInlineQuestion question={question} agentId={agentId} requestId={request.requestId} onClose={() => setIsExpanded(false)} />
      )}
      {question.type === 'form' && (
        <FormInlineQuestion question={question} agentId={agentId} requestId={request.requestId} onClose={() => setIsExpanded(false)} />
      )}
    </div>
  )}
</div>
```

**Key Design Elements:**
- Expandable/collapsible with chevron icon
- Countdown timer display
- Type indicator
- Focus management
- Auto-scroll into view

---

### Text Input Question

**Location:** `frontend/chat/src/components/question/inputs/text-inline.tsx`

**Features:**
- Single or multi-line text input
- Masked input support
- Required field validation
- Submit/Cancel buttons

**Implementation:**

```tsx
<div className="p-4 space-y-3">
  {label && (
    <label className="block text-sm text-primary">
      {label}
      {required && <span className="text-error ml-1">*</span>}
    </label>
  )}
  <div className="relative">
    {expectedLines > 1 ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={Math.min(expectedLines, 4)}
        style={masked ? { WebkitTextSecurity: 'disc' } as React.CSSProperties & { WebkitTextSecurity: string } : {}}
        placeholder={required ? "Required..." : "Optional..."}
        disabled={isSubmitting}
        className="w-full bg-primary border border-primary rounded-lg text-primary text-sm p-3 outline-none focus:border-accent transition-colors resize-none disabled:opacity-50"
        aria-required={required}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        type={masked ? 'password' : 'text'}
        placeholder={required ? "Required..." : "Optional..."}
        disabled={isSubmitting}
        className="w-full bg-primary border border-primary rounded-lg text-primary text-sm p-2.5 outline-none focus:border-accent transition-colors disabled:opacity-50"
        aria-required={required}
      />
    )}
  </div>
  <div className="flex items-center justify-between">
    <button
      onClick={handleCancel}
      disabled={isSubmitting}
      className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      <X size={14} />
      Cancel
    </button>
    <button
      onClick={handleSubmit}
      disabled={isSubmitting || (required && !value.trim())}
      className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      {isSubmitting ? 'Sending...' : 'Submit'}
      <Send size={14} />
    </button>
  </div>
</div>
```

**Key Design Elements:**
- Single or multi-line input
- Masked input support (password field)
- Required field indicator (*)
- Submit/Cancel buttons
- Disabled state styling

---

### File Selection Question

**Location:** `frontend/chat/src/components/question/inputs/file-inline.tsx`

**Features:**
- File tree view
- File/directory selection
- Selection validation (min/max)
- Loading states

**Implementation:**

```tsx
<div ref={containerRef} className="p-3 space-y-3">
  <div
    role="tree"
    aria-label="File browser"
    className="max-h-75 overflow-y-auto custom-scrollbar border border-primary/50 rounded-lg bg-primary p-2"
  >
    {files.has('.') ? renderTree('.', 0) : (
      <div className="text-center text-muted text-sm py-8">Loading files...</div>
    )}
  </div>
  {error && <div className="text-error text-xs px-1" role="alert">{error}</div>}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className={`text-xs ${isSelectionValid() ? 'text-primary' : 'text-error'}`} aria-live="polite">
        {selected.size} selected
      </span>
      {(minimumSelections !== undefined || maximumSelections !== undefined) && (
        <span className="text-xs text-muted">
          {minimumSelections !== undefined && `min ${minimumSelections}`}
          {minimumSelections !== undefined && maximumSelections !== undefined && ' · '}
          {maximumSelections !== undefined && `max ${maximumSelections}`}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={handleCancel}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        <X size={14} />
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !isSelectionValid()}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        {isSubmitting ? 'Sending...' : 'Submit'}
        <Send size={14} />
      </button>
    </div>
  </div>
</div>
```

**Key Design Elements:**
- File tree with expand/collapse
- Selection count display
- Validation messages
- Min/max selection limits
- Loading states

---

### Tree Selection Question

**Location:** `frontend/chat/src/components/question/inputs/tree-inline.tsx`

**Features:**
- Hierarchical tree selection
- Multiple selection support
- Selection validation
- Keyboard navigation

**Implementation:**

```tsx
<div ref={containerRef} className="p-3 space-y-3">
  <div
    role="tree"
    aria-label="Select from tree"
    className="max-h-75 overflow-y-auto custom-scrollbar border border-primary/50 rounded-lg bg-primary"
  >
    {question.tree.map((root, index) => (
      <CompactTreeNode
        key={index}
        node={root}
        depth={0}
        selected={selected}
        onToggle={handleToggle}
        onExpand={() => toggleExpand(index)}
        isExpanded={expandedNodes.has(index)}
        multiple={multiple}
        canSelect={canSelect}
        isFirstNode={index === 0}
      />
    ))}
  </div>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <span className={`text-xs ${isValid ? 'text-primary' : 'text-error'}`} aria-live="polite">
        {selectionCount} selected
      </span>
      {(minimumSelections !== undefined || maximumSelections !== undefined) && (
        <span className="text-xs text-muted">
          {minimumSelections !== undefined && `min ${minimumSelections}`}
          {minimumSelections !== undefined && maximumSelections !== undefined && ' · '}
          {maximumSelections !== undefined && `max ${maximumSelections}`}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={handleCancel}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        <X size={14} />
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !isValid}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        {isSubmitting ? 'Sending...' : 'Submit'}
        <Send size={14} />
      </button>
    </div>
  </div>
</div>
```

**Key Design Elements:**
- Hierarchical tree structure
- Multiple selection support
- Selection validation
- Keyboard navigation (Arrow keys)
- Checkmark indicators

---

### Form Question

**Location:** `frontend/chat/src/components/question/inputs/form-inline.tsx`

**Features:**
- Multi-section wizard
- Field-by-field navigation
- Progress indicator
- Multiple field types

**Implementation:**

```tsx
<div ref={containerRef} className="p-4 space-y-3">
  {/* Progress indicator */}
  <div className="flex items-center justify-between text-xs" aria-live="polite">
    <div className="flex items-center gap-2">
      <span className="text-muted">Section {currentSection + 1} of {question.sections.length}</span>
      <span className="text-muted">·</span>
      <span className="text-muted">Field {currentField + 1} of {totalFields}</span>
    </div>
    <span className="text-accent font-medium">{section.name}</span>
  </div>

  {/* Description */}
  {section.description && (
    <p className="text-xs text-muted italic">{section.description}</p>
  )}

  {/* Field content */}
  <div className="min-h-37.5 flex flex-col">
    {field.type === 'text' && (
      <div className="flex-1 flex flex-col space-y-2">
        <label className="block text-sm text-primary" htmlFor={`form-field-${fieldKey}`}>
          {field.label}
          {field.required && <span className="text-error ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-muted">{field.description}</p>}
        <input
          ref={inputRef}
          id={`form-field-${fieldKey}`}
          type={field.masked ? 'password' : 'text'}
          defaultValue={currentFieldValue || field.defaultValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (e.currentTarget.value) {
                handleFieldSubmit(e.currentTarget.value);
              }
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          className="w-full bg-primary border border-primary rounded-lg text-primary text-sm p-2.5 outline-none focus:border-accent transition-colors"
          aria-required={field.required}
        />
      </div>
    )}

    {field.type === 'treeSelect' && (
      <div className="flex-1 flex flex-col space-y-2 min-h-37.5">
        <label className="block text-sm text-primary">{field.label}</label>
        <div className="border border-primary/50 rounded-lg flex-1 flex flex-col overflow-hidden">
          <TreeInlineQuestion question={field} agentId={agentId} requestId={requestId} onClose={() => handleFieldSubmit(null)} autoFocus={autoFocus} />
        </div>
      </div>
    )}

    {field.type === 'fileSelect' && (
      <div className="flex-1 flex flex-col space-y-2 min-h-37.5">
        <label className="block text-sm text-primary">{field.label}</label>
        {field.description && <p className="text-xs text-muted">{field.description}</p>}
        <div className="border border-primary/50 rounded-lg flex-1 flex flex-col overflow-hidden">
          <FileInlineQuestion question={field} agentId={agentId} requestId={requestId} onClose={() => handleFieldSubmit(null)} autoFocus={autoFocus} />
        </div>
      </div>
    )}
  </div>

  {/* Actions */}
  <div className="flex items-center justify-between pt-2">
    <div className="flex gap-2">
      <button
        onClick={handleCancel}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        <X size={14} />
        Cancel
      </button>
      {canGoPrevious && (
        <button
          onClick={handlePrevious}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-accent transition-colors disabled:opacity-50 bg-tertiary px-2 py-1.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
        >
          <ChevronLeft size={14} />
          Previous
        </button>
      )}
    </div>
    {field.type === 'text' && (
      <button
        onClick={(e) => {
          const input = e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement;
          if (input?.value) handleFieldSubmit(input.value);
        }}
        className="flex items-center gap-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
      >
        {isLastField && isLastSection ? 'Submit' : 'Next'}
        <ChevronRight size={14} />
      </button>
    )}
  </div>
</div>
```

**Key Design Elements:**
- Progress indicator (section/field count)
- Section name display
- Field description
- Previous/Next navigation
- Submit button for final section

---

### Code Editor

**Location:** `frontend/chat/src/components/editor/CodeEditor.tsx`

**Features:**
- Monaco editor integration
- Syntax highlighting
- Line numbers
- Minimap
- Auto-layout
- Light/dark theme support

**Implementation:**

```tsx
<Editor
  height="100%"
  language={getLanguage(file)}
  value={editorContent}
  onChange={handleContentChange}
  theme={theme === "light" ? "vs-light" : "vs-dark"}
  options={{
    minimap: { enabled: true },
    fontSize: 14,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
  }}
/>
```

**Language Mapping:**

```tsx
const getLanguage = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', java: 'java', cpp: 'cpp', c: 'c', cs: 'csharp',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift',
    kt: 'kotlin', scala: 'scala', sql: 'sql', sh: 'shell', bash: 'shell',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
  };
  return langMap[ext || ''] || 'plaintext';
};
```

**Key Design Elements:**
- Full-featured code editor
- Syntax highlighting by file extension
- Line numbers and minimap
- Light/dark theme support
- Auto-layout for responsive sizing

---

### Markdown Editor

**Location:** `frontend/chat/src/components/editor/MarkdownEditor.tsx`

**Features:**
- React-MD-Editor integration
- Split preview/editor mode
- GFM support
- Live preview
- Markdown rendering

**Implementation:**

```tsx
<MDEditor 
  className="flex-1 flex flex-row h-full"
  preview="preview"
  value={editorContent}
  onChange={handleContentChange}
/>
```

**Key Design Elements:**
- Split editor with live preview
- Markdown rendering with GFM
- Responsive split-view
- Clean UI with minimal controls

---

### Error Boundary

**Location:** `frontend/chat/src/components/ErrorBoundary.tsx`

**Features:**
- Catch React rendering errors
- Customizable fallback UI
- Display error message and stack trace
- Try-again button for recovery

**Implementation:**

```tsx
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

**Fallback UI:**

```tsx
<div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#050505]">
  <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
  <h2 className="text-xl font-bold text-zinc-200 mb-2">Something went wrong</h2>
  <p className="text-sm text-zinc-400 mb-4 max-w-md">
    {this.state.error?.message || 'An unexpected error occurred'}
  </p>
  <button
    onClick={() => this.setState({ hasError: false, error: undefined })}
    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
  >
    Try Again
  </button>
</div>
```

**Key Design Elements:**
- Clean error display
- Try-again functionality
- Error message display
- Centered layout

---

### Confirm Dialog

**Location:** `frontend/chat/src/components/overlay/confirm-dialog.tsx`

**Features:**
- Focus trap for accessibility
- Backdrop blur effect
- Variant styling (danger, warning, info)
- Customizable confirm/cancel buttons
- Keyboard navigation

**Implementation:**

```tsx
<ConfirmDialog
  title="Delete Agent"
  message="Are you sure you want to delete this agent?"
  confirmText="Delete"
  variant="danger"
  onConfirm={handleConfirmDelete}
  onCancel={() => setConfirmDelete(null)}
/>
```

**Variants:**

```tsx
const variantStyles = {
  danger: 'bg-red-600 hover:bg-red-500',
  warning: 'bg-amber-600 hover:bg-amber-500',
  info: 'bg-indigo-600 hover:bg-indigo-500'
};
```

**Key Design Elements:**
- Modal overlay with backdrop blur
- Focus trap for accessibility
- Variant-based styling
- Keyboard navigation
- Customizable text

---

## Animations & Transitions

### Smooth Transitions

```tsx
// Color transitions
className="transition-colors duration-200"

// Transform transitions
className="transition-transform duration-200"

// All transitions
className="transition-all duration-200 ease-in-out"

// Slow transitions for large elements
className="transition-all duration-300 ease-in-out"

// Fast transitions for small elements
className="transition-colors duration-100"
```

### Hover Effects

```tsx
// Background color change
className="hover:bg-secondary/30 transition-colors"

// Scale effect
className="hover:scale-105 transition-transform duration-200"

// Border highlight
className="hover:border-indigo-500 transition-colors"

// Text color change
className="hover:text-primary transition-colors"

// Opacity change
className="hover:opacity-80 transition-opacity"
```

### Framer Motion Animations

```tsx
import { motion } from 'framer-motion';

// Toast enter animation
<motion.div
  initial={{ opacity: 0, x: 100, scale: 0.95 }}
  animate={{ opacity: 1, x: 0, scale: 1 }}
  exit={{ opacity: 0, x: 100, scale: 0.95 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
>
  {/* Toast content */}
</motion.div>

// Sidebar slide animation
<motion.div
  initial={{ x: '-100%' }}
  animate={{ x: 0 }}
  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
>
  {/* Sidebar content */}
</motion.div>

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  {/* Content */}
</motion.div>

// Message slide in
<motion.div
  variants={{
    hidden: { opacity: 0, x: -4 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  }}
  initial="hidden"
  animate="visible"
>
  {/* Message content */}
</motion.div>

// Provider expand animation
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: 'auto', opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ duration: 0.15 }}
>
  {/* Expandable content */}
</motion.div>
```

### Loading States

```tsx
// Spinner
<div className="flex items-center justify-center">
  <Loader2 className="w-6 h-6 text-muted animate-spin" />
</div>

// Button spinner
<button disabled className="opacity-50">
  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
  Loading...
</button>

// Skeleton loading
<div className="animate-pulse">
  <div className="h-4 bg-tertiary rounded w-3/4 mb-2" />
  <div className="h-4 bg-tertiary rounded w-1/2" />
</div>

// Bouncing dots
<div className="flex gap-1">
  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
</div>
```

### Pulse Animations

```tsx
// Status indicator
<div className={`w-2 h-2 rounded-full ${idle ? 'bg-indigo-500' : 'bg-amber-500'} animate-pulse`} />

// Spinner pulse
<div className="flex items-center gap-2">
  <div className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
  <span>Loading...</span>
</div>

// Gradient pulse
<div className="animate-pulse-indigo">Content</div>
```

---

## Accessibility

### Focus Management

```tsx
// Skip link pattern
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-indigo-600 text-white rounded-lg"
>
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Main content */}
</main>

// Focus-visible rings
className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"

// Custom focus-ring utility
className="focus-ring" // shorthand for focus-visible ring
```

### ARIA Attributes

```tsx
// Labels
<label htmlFor="input-id" className="sr-only">
  Label text
</label>

// Live regions
<span aria-live="polite">{statusLine}</span>

<div role="status" aria-live="polite">
  {selectedCount} selected
</div>

// Icon-only buttons
<button aria-label="Send message">
  <Send className="w-4 h-4" />
</button>

// Error states
<input
  aria-invalid={hasError}
  aria-describedby={errorId}
/>

// Loading states
<div role="status" aria-live="polite">
  <Loader2 className="w-6 h-6 animate-spin" />
  <span className="sr-only">Loading...</span>
</div>

// Role attributes
<div role="button" tabIndex={0} aria-expanded={isOpen} />
<div role="listbox" aria-label="Command suggestions" />
<div role="option" aria-selected={isSelected} />
```

### Keyboard Navigation

```tsx
// Enter key handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
};

// Escape key handler
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') {
    handleCancel();
  }
};

// Tab order management
<button tabIndex={-1} />

// Arrow key navigation
if (e.key === 'ArrowUp') {
  e.preventDefault();
  setSelectedSuggestion(prev => (prev - 1 + length) % length);
}

// Space key handler
if (e.key === ' ') {
  e.preventDefault();
  handleToggle();
}
```

### Screen Reader Only

```tsx
// Hidden from visual but visible to screen readers
className="sr-only"

// Usage
<span className="sr-only">Loading...</span>
<label className="sr-only">Input label</label>

// Visually hidden but accessible
sr-only focus:not-sr-only
```

### Reduced Motion Support

```tsx
// CSS
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

// Component usage
motion.div({
  whileHover: !isReducedMotion ? { scale: 1.05 } : undefined,
  whileTap: !isReducedMotion ? { scale: 0.95 } : undefined
})
```

### Color Contrast

```tsx
// Ensure text meets WCAG AA contrast ratios
// Light text on dark backgrounds: min 4.5:1 contrast
// Dark text on light backgrounds: min 4.5:1 contrast

// Primary text colors pass contrast
text-primary on bg-secondary: ✅
text-secondary on bg-primary: ✅

// Muted text colors pass contrast
text-muted on bg-primary: ✅
text-muted on bg-secondary: ✅
```

---

## Responsive Design

### Breakpoints (Tailwind Default)

```tsx
// Custom breakpoints
xs: 480px   // Extra small screens
sm: 640px   // Small screens
md: 768px   // Medium screens (tablet)
lg: 1024px  // Large screens (desktop)
xl: 1280px  // Extra large screens
```

### Mobile-First Patterns

```tsx
// Responsive padding
className="p-2 sm:p-4 md:p-6"

// Responsive font sizes
className="text-xs sm:text-sm md:text-base"

// Responsive layouts
<div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
  {/* Content */}
</div>

// Responsive visibility
<div className="hidden sm:block">
  {/* Visible on mobile, hidden on desktop */}
</div>

<div className="block sm:hidden">
  {/* Visible on desktop, hidden on mobile */}
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Grid items */}
</div>

// Responsive order
<div className="flex flex-col sm:flex-row">
  <div className="order-2 sm:order-1">Second on mobile, first on desktop</div>
  <div className="order-1 sm:order-2">First on mobile, second on desktop</div>
</div>
```

### Mobile-Specific Components

```tsx
// Mobile menu button
<button onClick={onMenuClick} className="md:hidden p-1.5 shrink-0">
  <Menu size={18} />
</button>

// Mobile sidebar overlay
{isMobile && isMobileSidebarOpen && (
  <div className="fixed inset-0 bg-black/50 z-30" />
)}

// Collapsible sidebar
<div className={`
  ${isMobile ? 'fixed' : 'relative'}
  ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
`}>
  <Sidebar ... />
</div>
```

### Touch-Friendly Targets

```css
/* In index.css */
@media (max-width: 479px) {
  button, .cursor-pointer {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### Safe Area Insets for Notched Devices

```css
/* In index.css */
@supports (padding: env(safe-area-inset-bottom)) {
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### Responsive Text

```tsx
// Truncate long text
className="line-clamp-1" // Single line truncation
className="line-clamp-2" // Two line truncation
className="truncate" // Text truncation with ellipsis

// Responsive font sizes
className="text-2xs sm:text-xs md:text-sm"

// Responsive spacing
className="gap-1 sm:gap-2 md:gap-4"

// Responsive widths
className="w-full sm:w-1/2 md:w-1/3"
```

### Mobile Accessibility

- Minimum 44x44px touch targets
- Proper ARIA labels for mobile controls
- Focus management when opening/closing sidebar
- Reduced motion support via `prefers-reduced-motion`
- High contrast mode support
- Semantic HTML elements

---

## Common Utility Patterns

### Focus Management

```tsx
// Auto-focus on mount
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (autoFocus && inputRef.current) {
    inputRef.current.focus();
  }
}, [autoFocus]);

// Scroll into view
useEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}, []);

// Focus trap
import FocusTrap from 'focus-trap-react';

<FocusTrap active={isOpen}>
  {/* Modal content */}
</FocusTrap>
```

### Conditional Classes

```tsx
// Using cn utility
import { cn } from '../lib/utils';

<div className={cn(
  'base-classes',
  isActive && 'active-classes',
  isError && 'error-classes',
  isLoading && 'loading-classes'
)} />

// Complex conditional
<div className={cn(
  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
  status === 'active' && "bg-emerald-500/10 text-emerald-400",
  status === 'busy' && "bg-amber-500/10 text-amber-400",
  status === 'error' && "bg-red-500/10 text-red-400",
  status === 'idle' && "bg-indigo-500/10 text-indigo-400"
)}>
  {status}
</div>
```

### Loading States

```tsx
// Conditional rendering
{isLoading ? (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="w-6 h-6 text-muted animate-spin" />
  </div>
) : data ? (
  <div className="content">
    {/* Render data */}
  </div>
) : (
  <div className="text-center text-muted text-xs">
    No data available
  </div>
)}

// Skeleton loader
{isLoading && (
  <div className="animate-pulse space-y-3">
    <div className="h-4 bg-tertiary rounded w-3/4" />
    <div className="h-4 bg-tertiary rounded w-1/2" />
  </div>
)}

// Loading overlay
{isLoading && (
  <div className="absolute inset-0 bg-secondary/80 backdrop-blur-sm flex items-center justify-center z-10">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
)}
```

### Error Handling

```tsx
// Try-catch with toast
try {
  await chatRPCClient.sendInput({ agentId, message });
  toastManager.success('Message sent');
} catch (error: any) {
  toastManager.error(error.message || 'Failed to send message', { duration: 5000 });
}

// Form validation
const handleSubmit = () => {
  if (!input.trim()) {
    setInputError(true);
    setTimeout(() => setInputError(false), 1000);
    return;
  }
  // Submit logic
};

// API error handling
const handleError = (error: any, defaultMessage: string) => {
  const errorMessage = error.message || defaultMessage;
  toastManager.error(errorMessage, { duration: 5000 });
};
```

### Conditional Styling

```tsx
// Status-based styling
<div className={cn(
  'px-3 py-1 rounded-full text-xs font-medium',
  status === 'active' && 'bg-emerald-500/10 text-emerald-400',
  status === 'busy' && 'bg-amber-500/10 text-amber-400',
  status === 'error' && 'bg-red-500/10 text-red-400'
)}>
  {status}
</div>

// Selected state
<div className={cn(
  'px-3 py-2 rounded-md text-sm',
  isSelected ? 'bg-indigo-500/10 text-indigo-400' : 'hover:bg-hover'
)}>
  {item.name}
</div>

// Disabled state
<button
  className={cn(
    'px-4 py-2 rounded-md transition-colors',
    isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hover'
  )}
  disabled={isDisabled}
>
  {buttonText}
</button>
```

### Utility Functions

```tsx
// Format timestamps
const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

// Truncate text
const truncate = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// Get basename from path
const getBasename = (filePath: string): string => {
  const cleanPath = filePath.endsWith('/') ? filePath.slice(0, -1) : filePath;
  return cleanPath.split('/').pop() || filePath;
};

// Debounce function
const debounce = (fn: Function, ms: number) => {
  let timer: NodeJS.Timeout;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn();
    }, ms);
  };
};
```

---

## Component Structure

### ChatPage Structure

```tsx
export default function ChatPage({ agentId }: { agentId: string }) {
  // State
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [inputError, setInputError] = useState(false);

  // Hooks
  const { messages } = useAgentEventState(agentId);
  const { idle, busyWith, statusLine, waitingOn } = useAgentExecutionState(agentId);
  const commandHistory = useCommandHistory(agentId);
  const availableCommands = useAvailableCommands(agentId);

  // Handlers
  const handleSubmit = async () => {
    // Validation and submission logic
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toast Container */}
      <ToastContainer toasts={toasts || []} onRemove={removeToast} />

      {/* File Browser Overlay */}
      <FileBrowserOverlay
        agentId={agentId}
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
      />

      {/* Header */}
      <ChatHeader agentId={agentId} idle={idle} />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <AutoScrollContainer>
          <MessageList messages={messages} agentId={agentId} busyWith={busyWith} />
        </AutoScrollContainer>

        {/* Footer */}
        <ChatFooter
          agentId={agentId}
          input={input}
          setInput={setInput}
          inputError={inputError}
          setInputError={setInputError}
          idle={idle}
          waitingOn={waitingOn}
          statusLine={statusLine}
          availableCommands={filteredAvailableCommands}
          commandHistory={commandHistory}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          setShowFileBrowser={setShowFileBrowser}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
```

---

## Best Practices

1. **Always use semantic HTML** - Use `<main>`, `<header>`, `<footer>`, `<nav>` where appropriate
2. **Maintain consistent spacing** - Use the spacing scale consistently throughout the app
3. **Provide proper labels** - All interactive elements should have accessible labels
4. **Handle loading states** - Always show loading indicators for async operations
5. **Provide error feedback** - Use toasts or inline messages for errors
6. **Test keyboard navigation** - Ensure all interactive elements are keyboard accessible
7. **Use appropriate animations** - Keep animations smooth and consider reduced motion preferences
8. **Follow mobile-first approach** - Design for mobile first, then enhance for larger screens
9. **Use proper contrast ratios** - Ensure text is readable against backgrounds
10. **Document complex components** - Add comments for complex logic and interactions

### Additional Best Practices

11. **Use SWR for data fetching** - Benefits include caching, revalidation, and error handling
12. **Implement proper focus management** - Especially in modals and overlays
13. **Use consistent theming** - Leverage CSS variables for theme switching
14. **Optimize lists** - Use react-virtuoso for large message lists
15. **Provide user feedback** - Use toast notifications for important actions
16. **Support accessibility** - ARIA labels, keyboard navigation, focus rings
17. **Responsive design** - Mobile-first approach with responsive breakpoints
18. **Error boundaries** - Wrap components to catch rendering errors
19. **Conditional rendering** - Handle loading, error, and empty states
20. **Performance optimization** - Use virtualization, memoization, and lazy loading

---

## References

- [Frontend Knowledge Repository](./frontend.md)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [React Markdown Documentation](https://github.com/remarkjs/react-markdown)

---

*Last updated: Generated by TokenRing AI*