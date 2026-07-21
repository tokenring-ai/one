# TokenRing Rust CLI

A standalone Ratatui-powered terminal UI for TokenRing, ported from the
TypeScript CLI (`pkg/cli`). Connects to a running TokenRing instance over
WebSocket JSON-RPC and provides the same interactive experience as the
in-process `raw` CLI mode.

## Build

From this crate root (`cli/`):

```bash
cargo build
```

For an optimized release build:

```bash
cargo build --release
```

The package is `tokenring-one-cli`; the binary is `one` (help name
`tokenring-one-cli`).

## Run

Run `one` with no URL to launch the installed TokenRing One backend from the
startup menu. The CLI discovers `tokenring-one` from `TOKENRING_ONE_BINARY`,
`/usr/bin`, or `/usr/local/bin`. Backend stdout and stderr are captured so they
do not overwrite the TUI.

To connect to an already-running instance instead:

```bash
bun backend/tokenring.ts --listen 127.0.0.1 --port 3000
```

Then connect the CLI:

```bash
cargo run -- ws://127.0.0.1:3000/rpc:ws
```

HTTP(S) URLs are auto-converted to WebSocket and `/rpc:ws` is appended if
missing:

```bash
cargo run -- http://127.0.0.1:3000
```

## Configuration

Optional TOML config at the platform config dir (via the `dirs` crate), e.g.
`~/.config/tokenring/cli.toml` on Linux/XDG. Legacy `cli-rs.toml` and
`~/.config/tokenring/cli.toml` are still tried when present. On Unix, existing
config files are forced to mode `0600` on load. CLI flags override file values;
use `--no-*` flags to disable a config default (e.g. `--no-verbose`).

```toml
url = "ws://127.0.0.1:3000/rpc:ws"
agent_type = "code"
verbose = false
theme = "material-dark"
panel_style = "flat"

[notifications]
bell = true
desktop = false
hook = "terminal-notifier -message \"$TR_AGENT_LABEL is ready\""

[profile.work]
url = "wss://work.example.com/rpc:ws"
auth_bearer = "…"

[keybinds]
# Optional overrides (same spec syntax as defaults: ctrl+p, <leader>y, …)
# command_list = "ctrl+shift+p"
# leader = "ctrl+x"
```

Select a profile with `--profile work`. Use `--config /path/to.toml` for a
custom file path.

> **Auth:** Remote connections always use WebSocket session `auth` (not HTTP
> Basic). Username defaults to `--auth-user` / config / `TR_ADMIN_USER` / `admin`.
> Password is required via `--auth-password` / config / `TR_AUTH_PASSWORD` /
> `TR_ADMIN_PASSWORD`. Optional `--auth-bearer` is the sole upgrade
> `Authorization` header. Local launches use generated session credentials.

Notifications `hook` runs via the system shell (`sh -c` / `cmd /C`) so quoting
works; the agent label is available as `$TR_AGENT_LABEL` / `%TR_AGENT_LABEL%`.

## Options

```text
URL                              TokenRing instance URL (ws://, wss://, http://, https://)
      --one-binary <PATH>        TokenRing One executable for local launch
      --project-directory <PATH> Project directory for local launch (default: .)
      --agent-id <ID>            Attach to an existing agent           [env: TR_AGENT_ID]
      --agent-type <TYPE>        Agent type to create                  [env: TR_AGENT_TYPE]
      --select                   Show agent selection on startup
      --no-select                Skip agent selection (overrides config)
      --auth-bearer <TOKEN>      Bearer on WS upgrade (optional)       [env: TR_AUTH_BEARER]
      --auth-user <USER>         WS session auth username              [env: TR_AUTH_USER]
      --auth-password <PASS>     WS session auth password            [env: TR_AUTH_PASSWORD]
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
cargo run -- \
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
| `Ctrl+X q` | Quit the CLI |
| `Ctrl+C` | Cancel active work; press again to exit |
| `SIGINT` / `SIGTERM` / `SIGHUP` | Graceful shutdown (restore terminal, stop local backend) |
| `Ctrl+X a` | Open agent selection screen |
| `Ctrl+X d` | Delete the current agent and open selection |
| `Ctrl+X m` / `F2` | Open model (`/model`) |
| `Ctrl+X t` | Open tools picker (`/tools select`) |
| `Ctrl+X Shift+T` | Cycle theme preset |
| `Ctrl+X y` | Copy latest transcript message to clipboard |
| `Ctrl+X b` | Toggle metrics sidebar |
| `Ctrl+X s` | Toggle status detail overlay |
| `Ctrl+X v` | Toggle verbose mode (reasoning, artifacts, tool results) |
| `Ctrl+X d` | Delete current agent (confirm with second press) |
| `Ctrl+P` | Open full slash-command list |
| `Alt+Q` or `F6` | Toggle optional-questions picker |
| `?` (empty composer) | Context-sensitive keyboard shortcut help |

### Chat composer

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` / `Ctrl+Enter` / `Alt+Enter` / `Ctrl+J` | Insert newline |
| `Up` / `Down` | Browse command history (at first/last line of the composer) |
| `Tab` | Accept completion / insert file |
| `Esc` | Cancel current activity / close picker |
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Quick-reply chips |

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
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Quick-reply chips |
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
  config.rs          TOML config + profiles (~/.config/tokenring/cli.toml)
  theme.rs           Theme colors & Tone enum
  models/
    events.rs        Typed AgentEvent enum (defensive JSON parsing)
    questions.rs     Question / Interaction / FormSection models
  rpc/
    client.rs        WebSocket JSON-RPC (persistent RPC worker + event stream)
    methods.rs       Typed RPC method wrappers
  tui/
    mod.rs           Orchestrator: loading → selection → chat lifecycle
    chat/            ChatSession — keys, render, events, composer, panels, …
    ui_layout.rs     Mouse hit regions from last draw pass
    workspace_search.rs  Backend @ search with stale-result guards
    transcript.rs    Streaming-merge transcript with verbose support
    editor.rs        Multiline InputEditor (emacs bindings)
    completion.rs    Slash-command completion (fuzzy match)
    filesearch.rs    @-mention fuzzy file search
    questions.rs     Text / Tree / File / Form question sessions
    markdown.rs      termimad + ansi-to-tui markdown rendering
    metrics.rs       Live status-metric stream (model/tools/tokens/cost)
    screens.rs       Loading screen & agent selection browser
    spinner.rs       Braille spinner, messages, ASCII banners
    text.rs          Text formatters (visible_len, wrap, currency, etc.)
```

The client uses a **persistent RPC worker** thread that multiplexes
request/response calls on one shared socket. Agent events and status metrics
each use a separate long-lived stream socket, so background updates never stall
interactive calls.

`@` file search uses the backend `filesystem.searchWorkspaceFiles` RPC (requires
a current TokenRing build with that endpoint).

## Testing

```bash
cargo test --bin one
```
