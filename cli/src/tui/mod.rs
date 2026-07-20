//! Terminal UI orchestrator. Drives the loading screen → agent selection →
//! chat session lifecycle, mirroring `AgentCLI.run` / `AgentLoop`.

pub mod candy;
pub mod chat;
pub mod completion;
pub mod diff;
pub mod editor;
pub mod filesearch;
pub mod help;
pub mod keybinds;
pub mod markdown;
pub mod metrics;
pub mod notify;
pub mod questions;
pub mod screens;
pub mod spinner;
pub mod text;
pub mod transcript;
pub mod ui_layout;
pub mod workspace_cache;
pub mod workspace_search;

use crate::config::NotificationConfig;

use anyhow::{Context, Result};
use crossterm::event::{
    DisableBracketedPaste, DisableMouseCapture, EnableBracketedPaste, EnableMouseCapture,
};
use crossterm::{
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::env;
use std::io;
use std::path::Path;
use std::sync::mpsc::Receiver;

use crate::rpc::{self, RpcClient, StreamItem};
use crate::theme::Theme;
use crate::tui::chat::ChatSession;
use crate::tui::metrics::MetricsHandle;
use crate::tui::screens::{
    run_loading_screen, run_local_instance_screen, run_selection_screen, show_error_screen,
    ErrorScreenAction, SelectionOutcome,
};

/// A handle to the agent the UI is attached to.
#[derive(Clone)]
pub struct AgentHandle {
    pub id: String,
    pub label: String,
}

/// Resolved startup options (CLI + config file).
#[derive(Clone, Debug)]
pub struct RunOptions {
    pub agent_id: Option<String>,
    pub agent_type: String,
    pub select: bool,
    pub theme: Theme,
    pub verbose: bool,
    pub prompt: Option<String>,
    pub prompt_automation: bool,
    pub shutdown_when_done: bool,
    pub notifications: NotificationConfig,
}

/// How a chat session ended.
pub enum ChatExit {
    /// User requested a full exit (Ctrl+D, leader+q, or double Ctrl+C).
    Quit,
    /// Agent stopped or the user opened agent selection (Alt+A) — re-prompt.
    SelectAgent,
    /// Delete the agent then re-prompt (reserved).
    #[allow(dead_code)]
    DeleteAgent(String),
}

/// RAII guard enabling raw mode + alternate screen.
struct TerminalGuard;

impl TerminalGuard {
    fn enter() -> Result<Self> {
        use std::io::{stdin, stdout, IsTerminal};
        if !stdout().is_terminal() || !stdin().is_terminal() {
            anyhow::bail!(
                "tokenring requires an interactive terminal (stdin and stdout must be TTYs). \
                 Redirecting output or running under CI without a pseudo-TTY is not supported."
            );
        }
        enable_raw_mode().context("enable raw mode")?;
        execute!(
            stdout(),
            EnterAlternateScreen,
            EnableBracketedPaste,
            EnableMouseCapture
        )
        .context("enter alternate screen")?;
        Ok(Self)
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = execute!(
            io::stdout(),
            DisableMouseCapture,
            DisableBracketedPaste,
            LeaveAlternateScreen
        );
    }
}

/// Present the startup menu used when no remote instance URL was configured.
pub fn confirm_local_instance(
    binary: &Path,
    project_directory: &Path,
    theme: &Theme,
) -> Result<bool> {
    let _guard = TerminalGuard::enter()?;
    let backend = CrosstermBackend::new(io::stdout());
    let mut terminal = Terminal::new(backend).context("create terminal")?;
    run_local_instance_screen(&mut terminal, binary, project_directory, theme)
}

/// Top-level entry point: resolve an initial agent (or show loading + selection),
/// run the chat session, and re-prompt for a new agent until the user quits.
#[allow(dead_code)] // Public embedder API; main uses `run_with_options`.
pub fn run(
    client: RpcClient,
    agent_id: Option<String>,
    agent_type: String,
    select: bool,
) -> Result<()> {
    run_with_options(
        client,
        RunOptions {
            agent_id,
            agent_type,
            select,
            theme: Theme::material_dark(),
            verbose: false,
            prompt: None,
            prompt_automation: false,
            shutdown_when_done: false,
            notifications: NotificationConfig::default(),
        },
    )
}

/// Top-level entry with full startup options (nice-to-haves #1–#3, #17).
pub fn run_with_options(client: RpcClient, options: RunOptions) -> Result<()> {
    run_with_theme(
        client,
        options.agent_id,
        options.agent_type,
        options.select,
        options.theme,
        options.verbose,
        options.prompt,
        options.prompt_automation,
        options.shutdown_when_done,
        options.notifications,
    )
}

/// Same as [`run`] but with an explicit theme — exposed so callers (tests,
/// embedders) can customize the look & feel.
#[allow(clippy::too_many_arguments)]
pub fn run_with_theme(
    client: RpcClient,
    agent_id: Option<String>,
    agent_type: String,
    select: bool,
    theme: Theme,
    verbose: bool,
    prompt: Option<String>,
    prompt_automation: bool,
    shutdown_when_done: bool,
    notifications: NotificationConfig,
) -> Result<()> {
    let _guard = TerminalGuard::enter()?;
    let backend = CrosstermBackend::new(io::stdout());
    let mut terminal = Terminal::new(backend).context("create terminal")?;

    let mut current: Option<AgentHandle> = agent_id.map(|id| AgentHandle {
        label: format!("agent · {id}"),
        id,
    });
    // `--select` only applies to the first agent pick; returning from chat always
    // shows the selection browser.
    let mut use_selection = select;

    loop {
        let agent = match current.take() {
            Some(agent) => agent,
            None => {
                match resolve_agent(&mut terminal, &client, &agent_type, use_selection, &theme)? {
                    Some(agent) => agent,
                    None => break, // user quit the selection screen or error screen
                }
            }
        };

        match run_chat(
            &mut terminal,
            client.clone(),
            agent,
            theme.clone(),
            verbose,
            prompt.clone(),
            prompt_automation,
            shutdown_when_done,
            notifications.clone(),
        ) {
            Ok(ChatExit::Quit) => break,
            Ok(ChatExit::SelectAgent) => {
                use_selection = true;
                continue;
            }
            Ok(ChatExit::DeleteAgent(id)) => {
                let _ = rpc::delete_agent(&client, &id, "Agent was shut down from the CLI");
                use_selection = true;
                continue;
            }
            Err(e) => match show_error_screen(
                &mut terminal,
                "Session error",
                &format!("{e:#}"),
                &theme,
                false,
            )? {
                ErrorScreenAction::Quit => break,
                ErrorScreenAction::Dismiss | ErrorScreenAction::Retry => continue,
            },
        }
    }

    Ok(())
}

/// Show the loading screen, then either spawn [`agent_type`] or the selection
/// browser, and resolve the outcome into a concrete [`AgentHandle`].
fn resolve_agent<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: &RpcClient,
    agent_type: &str,
    select: bool,
    theme: &Theme,
) -> Result<Option<AgentHandle>>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    let data = match run_loading_screen(terminal, client, theme) {
        Ok(data) => data,
        Err(e) => {
            return match show_error_screen(
                terminal,
                "Connection failed",
                &format!("{e:#}"),
                theme,
                true,
            )? {
                ErrorScreenAction::Retry => {
                    resolve_agent(terminal, client, agent_type, select, theme)
                }
                ErrorScreenAction::Dismiss => Ok(None),
                ErrorScreenAction::Quit => Ok(None),
            };
        }
    };

    if !select {
        return spawn_agent_type(terminal, client, agent_type, theme);
    }

    let outcome = match run_selection_screen(terminal, client, data, theme)? {
        Some(outcome) => outcome,
        None => return Ok(None),
    };

    resolve_selection_outcome(terminal, client, outcome, theme)
}

/// Spawn an agent of the given type, retrying on failure (mirrors TS
/// `retryAgentSelection` error handling).
fn spawn_agent_type<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: &RpcClient,
    agent_type: &str,
    theme: &Theme,
) -> Result<Option<AgentHandle>>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    loop {
        match rpc::create_agent(client, agent_type, false) {
            Ok(created) => {
                return Ok(Some(AgentHandle {
                    label: format!("{} ({})", created.display_name, created.id),
                    id: created.id,
                }));
            }
            Err(e) => match show_error_screen(
                terminal,
                "Failed to create agent",
                &format!("Could not spawn a '{agent_type}' agent.\n\n{e:#}"),
                theme,
                true,
            )? {
                ErrorScreenAction::Retry => continue,
                ErrorScreenAction::Dismiss => return Ok(None),
                ErrorScreenAction::Quit => return Ok(None),
            },
        }
    }
}

/// Resolve a selection-screen choice into an [`AgentHandle`], with retry on RPC
/// failure.
fn resolve_selection_outcome<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: &RpcClient,
    outcome: SelectionOutcome,
    theme: &Theme,
) -> Result<Option<AgentHandle>>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    loop {
        let result = match &outcome {
            SelectionOutcome::Spawn {
                agent_type,
                display_name: _,
            } => rpc::create_agent(client, agent_type, false).map(|created| AgentHandle {
                label: format!("{agent_type} · {}", created.id),
                id: created.id,
            }),
            SelectionOutcome::Connect { id, display_name } => Ok(AgentHandle {
                label: format!("{display_name} · {id}"),
                id: id.clone(),
            }),
            SelectionOutcome::Workflow {
                name, display_name, ..
            } => rpc::spawn_workflow(client, name).map(|created| AgentHandle {
                label: format!("{display_name} · {}", created.id),
                id: created.id,
            }),
        };

        match result {
            Ok(agent) => return Ok(Some(agent)),
            Err(e) => {
                let title = match &outcome {
                    SelectionOutcome::Spawn { .. } => "Failed to create agent",
                    SelectionOutcome::Connect { .. } => "Failed to connect",
                    SelectionOutcome::Workflow { .. } => "Failed to start workflow",
                };
                match show_error_screen(terminal, title, &format!("{e:#}"), theme, true)? {
                    ErrorScreenAction::Retry => continue,
                    ErrorScreenAction::Dismiss => return Ok(None),
                    ErrorScreenAction::Quit => return Ok(None),
                }
            }
        }
    }
}

/// Run a single chat session for one agent until it exits.
#[allow(clippy::too_many_arguments)]
fn run_chat<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: RpcClient,
    agent: AgentHandle,
    theme: Theme,
    verbose: bool,
    prompt: Option<String>,
    prompt_automation: bool,
    shutdown_when_done: bool,
    notifications: NotificationConfig,
) -> Result<ChatExit>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    // Hydrate transcript state synchronously, then subscribe from that cursor.
    let snapshot =
        rpc::get_agent_events(&client, &agent.id, 0).unwrap_or(rpc::AgentEventsSnapshot {
            events: Vec::new(),
            position: 0,
        });
    let stream: Receiver<StreamItem> = client.spawn_event_stream(&agent.id, snapshot.position);

    // Best-effort working directory for the status line.
    let fs_state = rpc::get_filesystem_state(&client, &agent.id).unwrap_or_default();
    let working_directory = if fs_state.working_directory.is_empty() {
        ".".to_string()
    } else {
        fs_state.working_directory
    };
    let provider = if fs_state.provider.is_empty() {
        "posix".to_string()
    } else {
        fs_state.provider
    };
    let home = env::var("HOME").ok();
    let history = rpc::get_command_history(&client, &agent.id).unwrap_or_default();
    let commands = rpc::get_available_commands(&client, &agent.id)
        .unwrap_or_default()
        .into_iter()
        .map(|c| completion::CommandMatch {
            name: c.name,
            description: c.description,
        })
        .collect();

    let metrics = MetricsHandle::spawn(client.clone(), agent.id.clone());

    let mut session = ChatSession::new(
        client,
        agent,
        working_directory,
        provider,
        home,
        history,
        commands,
        stream,
        metrics,
        theme,
        verbose,
        prompt,
        prompt_automation,
        shutdown_when_done,
        notifications,
    );
    session.hydrate_from_events(snapshot.events, snapshot.position);
    session.send_initial_prompt();

    chat::run_session(terminal, &mut session)
}
