# TokenRing Rust CLI

A standalone Ratatui-powered terminal UI for TokenRing, ported from the
TypeScript CLI (`pkg/cli`). Connects to a running TokenRing instance over
WebSocket JSON-RPC and provides the same interactive experience as the
in-process `raw` CLI mode.

## Build

```bash
cargo build --manifest-path crates/cli-rs/Cargo.toml
```

For an optimized release build:

```bash
cargo build --release --manifest-path crates/cli-rs/Cargo.toml
```

## Run

Run `tokenring` with no URL to launch the installed TokenRing One backend from
the startup menu. The CLI discovers `tokenring-one` from its npm dependency,
`/usr/bin`, or `/usr/local/bin`. Backend stdout and stderr are captured so they
do not overwrite the TUI.

To connect to an already-running instance instead:

```bash
bun backend/tokenring.ts --listen 127.0.0.1 --port 3000
```

Then connect the Rust CLI:

```bash
cargo run --manifest-path crates/cli-rs/Cargo.toml -- ws://127.0.0.1:3000/rpc:ws
```

HTTP(S) URLs are auto-converted to WebSocket and `/rpc:ws` is appended if
missing:

```bash
cargo run --manifest-path crates/cli-rs/Cargo.toml -- http://127.0.0.1:3000
```

## Configuration

Optional TOML config at `~/.config/tokenring/cli-rs.toml`. CLI flags override
file values; use `--no-*` flags to disable a config default (e.g. `--no-verbose`).

```toml
url = "ws://127.0.0.1:3000/rpc:ws"
agent_type = "code"
verbose = false
theme = "material-dark"
panel_style = "flat"

[notifications]
bell = true
desktop = false
hook = "terminal-notifier -message 'Agent ready'"

[profile.work]
url = "wss://work.example.com/rpc:ws"
auth_bearer = "…"
```

Select a profile with `--profile work`. Use `--config /path/to.toml` for a
custom file path.

> **Auth flag migration:** Older docs or scripts may reference `--auth-pass`,
> `--auth-token`, `TR_AUTH_PASS`, or `TR_AUTH_TOKEN`. Use `--auth-password`,
> `--auth-bearer`, `TR_AUTH_PASSWORD`, and `TR_AUTH_BEARER` instead.

## Options

```text
URL                              TokenRing instance URL (ws://, wss://, http://, https://)
      --one-binary <PATH>        TokenRing One executable for local launch
      --project-directory <PATH> Project directory for local launch (default: .)
      --agent-id <ID>            Attach to an existing agent           [env: TR_AGENT_ID]
      --agent-type <TYPE>        Agent type to create                  [env: TR_AGENT_TYPE]
      --select                   Show agent selection on startup
      --no-select                Skip agent selection (overrides config)
      --auth-bearer <TOKEN>      Bearer token for WS auth              [env: TR_AUTH_BEARER]
      --auth-user <USER>         Basic-auth username                   [env: TR_AUTH_USER]
      --auth-password <PASS>     Basic-auth password                 [env: TR_AUTH_PASSWORD]
      --config <PATH>            Config file path
      --profile <NAME>           Named config profile
      --verbose                  Start in verbose transcript mode
      --no-verbose               Start in quiet mode (overrides config)
      --theme <NAME>             Theme preset (material-dark, framed-light, …)
      --panel-style <STYLE>      Panel chrome (flat or framed)
      --prompt <TEXT>            Send an initial message after attach
      --shutdown-when-done       Exit when the agent stops (with --prompt)
      --no-shutdown-when-done    Keep session open when agent stops
      --notify-bell              Bell when the agent finishes a run
      --no-notify-bell           Disable completion bell
      --notify-desktop           Desktop notification on completion
      --no-notify-desktop        Disable desktop notifications
  -h, --help                     Print help
```

One-shot automation example:

```bash
cargo run --manifest-path crates/cli-rs/Cargo.toml -- \
  ws://127.0.0.1:3000/rpc:ws \
  --prompt "Summarize this repo" \
  --shutdown-when-done \
  --notify-bell
```

## Keybindings

The CLI uses a **leader key** system (`Ctrl+X`) for chorded shortcuts. Press the leader key, then release, then press the action key within 2 seconds.

### Global (always available)

| Key | Action |
|-----|--------|
| `Ctrl+D` or `Ctrl+X q` | Quit the CLI |
| `Ctrl+C` | Cancel active work; press again to exit |
| `SIGINT` / `SIGTERM` / `SIGHUP` | Graceful shutdown (restore terminal, stop local backend) |
| `Ctrl+X a` | Open agent selection screen |
| `Ctrl+X m` | Open model picker (`/model select`) |
| `Ctrl+X t` | Open tools picker (`/tools select`) |
| `Ctrl+X v` | Toggle verbose mode (reasoning, artifacts, tool results) |
| `Alt+Q` or `F6` | Toggle optional-questions picker |
| `Ctrl+P` | Show command list |
| `?` | Context-sensitive keyboard shortcut help |

### Chat composer

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` / `Ctrl+J` | Insert newline |
| `Ctrl+P` / `Ctrl+N` | Browse command history (prev / next) |
| `Up` / `Down` | Browse command history |
| `Tab` | Accept completion / insert file |
| `Esc` | Cancel current activity / close picker |
| `Ctrl+R` then `1` / `2` / `3` | Quick-reply chips |

Mouse: scroll the transcript over the transcript pane; click picker rows to
select; click the composer to refocus it.

### Editor (emacs bindings)

| Key | Action |
|-----|--------|
| `Ctrl+A` / `Home` | Move to start of line |
| `Ctrl+E` / `End` | Move to end of line |
| `Ctrl+K` | Delete to end of line |
| `Ctrl+U` | Delete to start of line |
| `Ctrl+W` / `Ctrl+Backspace` / `Alt+Backspace` | Delete word backward |
| `Ctrl+D` / `Delete` / `Shift+Delete` | Delete character forward |
| `Backspace` / `Shift+Backspace` | Delete character backward |
| `Alt+B` / `Alt+Left` / `Ctrl+Left` | Move word backward |
| `Alt+F` / `Alt+Right` / `Ctrl+Right` | Move word forward |
| `Left` / `Right` | Move character left / right |
| `Up` / `Down` | Move line up / down (multiline) |
| `Ctrl+-` / `Super+Z` | Undo |
| `Ctrl+.` / `Super+Shift+Z` | Redo |

### Transcript scrolling

| Key | Action |
|-----|--------|
| `PageUp` / `Ctrl+Alt+B` | Scroll up one page |
| `PageDown` / `Ctrl+Alt+F` | Scroll down one page |
| `Ctrl+Alt+U` | Scroll up half page |
| `Ctrl+Alt+D` | Scroll down half page |
| `Ctrl+Alt+Y` | Scroll up one line |
| `Ctrl+Alt+E` | Scroll down one line |
| `Ctrl+G` / `Home` | Jump to first message |
| `Ctrl+Alt+G` / `End` | Jump to last message |
| `Enter` (empty composer) | Expand/collapse tool output |

### Slash-command completion (`/`)

| Key | Action |
|-----|--------|
| `Up` / `Down` / `Ctrl+P` / `Ctrl+N` | Navigate matches |
| `PageUp` / `PageDown` | Jump by 5 matches |
| `Tab` / `Enter` | Insert selected command |
| `Esc` | Close picker |

### File search (`@`)

| Key | Action |
|-----|--------|
| `Up` / `Down` / `Ctrl+P` / `Ctrl+N` | Navigate matches |
| `PageUp` / `PageDown` | Jump by 5 matches |
| `Tab` / `Enter` | Insert selected file path |
| `Esc` | Close picker |

### Inline questions

| Key | Action |
|-----|--------|
| `Enter` | Submit answer (or advance to next form field) |
| `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` | Insert newline (text questions) |
| `Esc` | Cancel question |

**Tree-select** questions: `Up`/`Down` to navigate, `Space`/`Enter` to toggle,
`Right`/`Left` to expand/collapse branches.

**File-select** questions: `Up`/`Down` to navigate, `Enter` to toggle/select,
`Right`/`Left` or `Space` to expand/collapse directories.

### Follow-up composer

| Key | Action |
|-----|--------|
| `Enter` | Send follow-up response |
| `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` | Insert newline |
| `Ctrl+R` then `1` / `2` / `3` | Quick-reply chips |
| `Esc` | Cancel (send null) |

### Optional-questions picker

| Key | Action |
|-----|--------|
| `Up` / `Down` / `Ctrl+P` / `Ctrl+N` | Navigate questions |
| `PageUp` / `PageDown` | Jump by 8 |
| `Enter` | Open selected question |
| `Esc` / `q` | Close picker |

## Architecture

```text
src/
  main.rs            Entry point (arg parsing → tui::run)
  args.rs            Clap args, URL normalization, auth, config merge
  config.rs          TOML config + profiles
  theme.rs           Theme colors & Tone enum
  models/
    events.rs        Typed AgentEvent enum (defensive JSON parsing)
    questions.rs     Question / Interaction / FormSection models
  rpc/
    client.rs        WebSocket JSON-RPC client (per-call sockets + event stream)
    methods.rs       Typed RPC method wrappers
  tui/
    mod.rs           Orchestrator: loading → selection → chat lifecycle
    chat.rs          ChatSession — main chat UI, key routing, drawing
    ui_layout.rs     Mouse hit regions from last draw pass
    workspace_search.rs  Backend @ search with stale-result guards
    transcript.rs    Streaming-merge transcript with verbose support
    editor.rs        Multiline InputEditor (emacs bindings)
    completion.rs    Slash-command completion (fuzzy match)
    filesearch.rs    @-mention fuzzy file search
    questions.rs     Text / Tree / File / Form question sessions
    markdown.rs      termimad + ansi-to-tui markdown rendering
    metrics.rs       Background status-metric polling (model/tools/tokens/cost)
    screens.rs       Loading screen & agent selection browser
    spinner.rs       Braille spinner, messages, ASCII banners
    text.rs          Text formatters (visible_len, wrap, currency, etc.)
```

The client uses dedicated WebSocket sockets: one long-lived socket for the
`streamAgentEvents` event stream, and fresh short-lived sockets for each
request/response RPC call. This avoids the deadlock issues that arise from
tungstenite's blocking I/O model.

`@` file search uses the backend `filesystem.searchWorkspaceFiles` RPC (requires
a current TokenRing build with that endpoint).

## Testing

```bash
cargo test --manifest-path frontend/cli-rs/Cargo.toml
```
