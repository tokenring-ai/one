//! Full-screen startup surfaces: the animated loading screen and the agent
//! selection browser. Ported from `pkg/cli/raw/NativeScreens.ts`.
//!
//! Both run inside the shared alternate screen and return control to the
//! caller when done.

use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use chrono::{DateTime, Datelike, Local, NaiveDate, TimeZone};

use anyhow::{bail, Result};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};
use crate::rpc::{
    delete_agent, get_agent_types, list_agents, list_workflows, AgentTypeEntry, RpcClient,
    RunningAgent, WorkflowEntry,
};
use crate::theme::{PanelStyle, Theme, Tone};
use crate::tui::candy;
use crate::tui::spinner::{banner_lines, spinner_frame, spinner_message, SCREEN_BANNER};
use crate::tui::text::{center_line, fit_line, visible_len, wrap_plain_text};

/// The data backing the agent-selection list.
#[derive(Clone, Debug, Default)]
pub struct SelectionData {
    pub agents: Vec<RunningAgent>,
    pub types: Vec<AgentTypeEntry>,
    pub workflows: Vec<WorkflowEntry>,
}

/// Fetch all data needed for selection. Runs the three list queries.
pub fn fetch_selection_data(client: &RpcClient) -> Result<SelectionData> {
    Ok(SelectionData {
        agents: list_agents(client)?,
        types: get_agent_types(client)?,
        workflows: list_workflows(client)?,
    })
}

/// What the user picked from the selection screen.
#[derive(Clone, Debug)]
pub enum SelectionOutcome {
    Spawn {
        agent_type: String,
        #[allow(dead_code)]
        display_name: String,
    },
    Connect {
        id: String,
        display_name: String,
    },
    Workflow {
        name: String,
        display_name: String,
    },
}

/// A flattened selection entry (heading or selectable option).
enum SelectionEntry {
    Heading(String),
    Option {
        label: String,
        outcome: SelectionOutcome,
        preview_title: String,
        preview_lines: Vec<String>,
    },
}

/// Top-level tabs on the agent-selection screen.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum SelectionTab {
    RunningAgents,
    AgentDirectory,
    Workflows,
}

impl SelectionTab {
    const ALL: [Self; 3] = [Self::RunningAgents, Self::AgentDirectory, Self::Workflows];

    fn label(self) -> &'static str {
        match self {
            Self::RunningAgents => "Running Agents",
            Self::AgentDirectory => "Agent Directory",
            Self::Workflows => "Workflows",
        }
    }

    fn next(self) -> Self {
        match self {
            Self::RunningAgents => Self::AgentDirectory,
            Self::AgentDirectory => Self::Workflows,
            Self::Workflows => Self::RunningAgents,
        }
    }

    fn prev(self) -> Self {
        match self {
            Self::RunningAgents => Self::Workflows,
            Self::AgentDirectory => Self::RunningAgents,
            Self::Workflows => Self::AgentDirectory,
        }
    }
}

struct DeleteConfirm {
    id: String,
    display_name: String,
}

const MIN_WIDTH: u16 = 40;
const MIN_HEIGHT: u16 = 10;
const MIN_LOADING_DURATION: Duration = Duration::from_secs(1);

// ---------------------------------------------------------------------------
// Local instance startup screen
// ---------------------------------------------------------------------------

/// Show the startup menu offered when the CLI has no configured remote URL.
/// The backend is launched only after explicit confirmation.
pub fn run_local_instance_screen<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    binary: &Path,
    project_directory: &Path,
    theme: &Theme,
) -> Result<bool>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    loop {
        if crate::signal::take_quit() {
            return Ok(false);
        }

        terminal
            .draw(|frame| draw_local_instance_startup(frame, binary, project_directory, theme))?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if is_ctrl_c(&key) {
                    return Ok(false);
                }
                match key.code {
                    KeyCode::Enter => return Ok(true),
                    KeyCode::Esc | KeyCode::Char('q') => return Ok(false),
                    _ => {}
                }
            }
        }
    }
}

fn draw_local_instance_startup(
    frame: &mut Frame,
    binary: &Path,
    project_directory: &Path,
    theme: &Theme,
) {
    let area = frame.area();
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.app.background_color.color())),
        area,
    );

    let width = area.width.saturating_sub(6) as usize;
    let lines = vec![
        Line::from(Span::styled(
            SCREEN_BANNER,
            Style::default()
                .fg(theme.agent_selection.banner_color.color())
                .add_modifier(Modifier::BOLD),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            "Start a TokenRing workspace",
            Style::default()
                .fg(theme.panel.heading_color.color())
                .add_modifier(Modifier::BOLD),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            "› Launch TokenRing One in this CLI",
            Style::default()
                .fg(theme.agent_selection.highlighted_color.color())
                .bg(theme.agent_selection.chip_background_color.color())
                .add_modifier(Modifier::BOLD),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            fit_line(&format!("Backend: {}", binary.display()), width),
            Style::default().fg(Tone::Muted.color(theme)),
        )),
        Line::from(Span::styled(
            fit_line(&format!("Project: {}", project_directory.display()), width),
            Style::default().fg(Tone::Muted.color(theme)),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            "Enter launch  q or Esc quit",
            Style::default().fg(Tone::Muted.color(theme)),
        )),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(theme.panel.border_color.color()))
        .title(" TokenRing ")
        .style(Style::default().bg(theme.panel.background_color.color()));
    let popup_width = area.width.clamp(30, 78);
    let popup_height = area.height.clamp(10, 14);
    let popup = Rect::new(
        area.x + area.width.saturating_sub(popup_width) / 2,
        area.y + area.height.saturating_sub(popup_height) / 2,
        popup_width,
        popup_height,
    );
    let inner = block.inner(popup);
    frame.render_widget(block, popup);
    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), inner);
}

// ---------------------------------------------------------------------------
// Error screen
// ---------------------------------------------------------------------------

/// What the user chose on an error screen.
pub enum ErrorScreenAction {
    /// Dismiss and continue (e.g. return to agent selection).
    Dismiss,
    /// Retry the failed operation.
    Retry,
    /// Quit the application.
    Quit,
}

/// Show a full-screen error and wait for user input.
///
/// When `retryable` is true, Enter retries and Esc dismisses. Otherwise any
/// key dismisses. Ctrl+C always quits.
pub fn show_error_screen<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    title: &str,
    message: &str,
    theme: &Theme,
    retryable: bool,
) -> Result<ErrorScreenAction>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    let hint = if retryable {
        "Enter retry  Esc dismiss  Ctrl+C quit"
    } else {
        "Press any key to continue  Ctrl+C quit"
    };

    loop {
        if crate::signal::take_quit() {
            return Ok(ErrorScreenAction::Quit);
        }

        terminal.draw(|frame| draw_error(frame, title, message, hint, theme))?;
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if is_ctrl_c(&key) {
                    return Ok(ErrorScreenAction::Quit);
                }
                match (key.modifiers, key.code) {
                    (_, KeyCode::Enter) if retryable => return Ok(ErrorScreenAction::Retry),
                    (_, KeyCode::Esc) if retryable => return Ok(ErrorScreenAction::Dismiss),
                    _ if !retryable => return Ok(ErrorScreenAction::Dismiss),
                    _ => {}
                }
            }
        }
    }
}

fn draw_error(frame: &mut Frame, title: &str, message: &str, hint: &str, theme: &Theme) {
    let area = frame.area();
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.app.background_color.color())),
        area,
    );

    let width = area.width.saturating_sub(4) as usize;
    let mut lines: Vec<Line> = vec![
        candy::error_illustration(theme),
        Line::raw(""),
        Line::from(Span::styled(
            title,
            Style::default()
                .fg(Tone::Error.color(theme))
                .add_modifier(Modifier::BOLD),
        )),
        Line::raw(""),
    ];
    for line in wrap_plain_text(message, width) {
        lines.push(Line::from(Span::styled(
            line,
            Style::default().fg(theme.transcript.body_color.color()),
        )));
    }
    lines.push(Line::raw(""));
    lines.push(Line::from(Span::styled(
        hint,
        Style::default().fg(Tone::Muted.color(theme)),
    )));

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Tone::Error.color(theme)))
        .title(Span::styled(
            " Error ",
            Style::default()
                .fg(Tone::Error.color(theme))
                .add_modifier(Modifier::BOLD),
        ))
        .style(Style::default().bg(theme.panel.background_color.color()));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), inner);
}

// ---------------------------------------------------------------------------
// Loading screen
// ---------------------------------------------------------------------------

/// Show the animated loading screen while fetching selection data on a
/// background thread. Returns the data when ready.
pub fn run_loading_screen<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: &RpcClient,
    theme: &Theme,
) -> Result<SelectionData>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    let (tx, rx) = mpsc::channel();
    let worker = client.clone();
    let handle = thread::Builder::new()
        .name("tr-selection-fetch".into())
        .spawn(move || {
            let result = fetch_selection_data(&worker);
            let _ = tx.send(result);
        });
    // A failed spawn is a system-level resource issue; surface it instead of
    // silently dropping into the generic channel-disconnect path below.
    let handle = match handle {
        Ok(h) => h,
        Err(e) => bail!("failed to start selection worker: {e}"),
    };

    let started_at = Instant::now();
    let mut tick = 0usize;
    let mut last_frame = Instant::now();
    let mut ready: Option<Result<SelectionData>> = None;
    loop {
        if crate::signal::take_quit() {
            bail!("interrupted");
        }

        terminal.draw(|frame| draw_loading(frame, tick, theme))?;

        if ready.is_none() {
            match rx.try_recv() {
                // The worker always delivers its `Result`; RPC/connection errors
                // propagate through here with their full context chain.
                Ok(data) => ready = Some(data),
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => {
                    // The worker exited without delivering a result (e.g. it
                    // panicked). Recover the underlying cause so the error screen
                    // can show actionable guidance instead of a cryptic message.
                    let cause = match handle.join() {
                        Ok(_) => "selection worker exited without delivering a result".to_string(),
                        Err(_) => "selection worker thread panicked".to_string(),
                    };
                    bail!(
                        "{cause}. Check that the TokenRing instance URL is reachable, \
                         the host is running, and any auth credentials are correct."
                    );
                }
            }
        }

        if ready.is_some() && started_at.elapsed() >= MIN_LOADING_DURATION {
            return ready.unwrap();
        }

        let timeout = Duration::from_millis(100).saturating_sub(last_frame.elapsed());
        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                if is_ctrl_c(&key) {
                    bail!("interrupted");
                }
            }
        }

        if last_frame.elapsed() >= Duration::from_millis(100) {
            tick += 1;
            last_frame = Instant::now();
        }
    }
}

fn draw_loading(frame: &mut Frame, tick: usize, theme: &Theme) {
    let area = frame.area();
    let width = area.width as usize;
    let height = area.height as usize;

    let text_color = theme.loading.text_color.color();
    let banner_lines = banner_lines(width);
    let banner: Vec<Line> = banner_lines
        .iter()
        .map(|l| Line::from(center_line(l, width)).style(text_color))
        .collect();

    let spinner_line = Line::from(center_line(
        &format!("{} {}", spinner_frame(tick), spinner_message(tick)),
        width,
    ))
    .style(theme.tones.info.color());

    let reserved = banner.len() + 2;
    let top_pad = height.saturating_sub(reserved) / 2;

    let mut lines: Vec<Line> = (0..top_pad).map(|_| Line::raw("")).collect();
    lines.extend(banner);
    lines.push(Line::raw(""));
    lines.push(spinner_line);

    let bg = theme.loading.background_color.color();
    frame.render_widget(Block::default().style(Style::default().bg(bg)), area);
    frame.render_widget(Paragraph::new(lines), area);
}

// ---------------------------------------------------------------------------
// Selection screen
// ---------------------------------------------------------------------------

/// Show the agent-selection browser (tabbed). Returns `Some(outcome)` on selection or
/// `None` if the user quit.
///
/// Tabs: Running Agents | Agent Directory | Workflows.
/// Supports deleting a running agent with 'd' or Delete (with y/n confirm).
pub fn run_selection_screen<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    client: &RpcClient,
    mut data: SelectionData,
    theme: &Theme,
) -> Result<Option<SelectionOutcome>>
where
    <C as ratatui::backend::Backend>::Error: Send + Sync + 'static,
{
    if !selection_has_any_options(&data) {
        terminal.draw(|frame| {
            let msg = "No agents, agent types, or workflows are available.";
            frame.render_widget(
                Paragraph::new(msg).style(Style::default().fg(Tone::Warning.color(theme))),
                frame.area(),
            )
        })?;
        // Wait for any key (or signal) before returning.
        loop {
            if crate::signal::take_quit() {
                break;
            }
            if event::poll(Duration::from_millis(100))? {
                if let Event::Key(_) = event::read()? {
                    break;
                }
            }
        }
        return Ok(None);
    }

    let mut tab = SelectionTab::RunningAgents;
    let mut selected = 0usize;
    let mut delete_confirm: Option<DeleteConfirm> = None;

    loop {
        if crate::signal::take_quit() {
            return Ok(None);
        }

        let entries = build_tab_entries(tab, &data);
        let options: Vec<SelectionOutcome> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Option { outcome, .. } => Some(outcome.clone()),
                _ => None,
            })
            .collect();
        selected = selected.min(options.len().saturating_sub(1));

        terminal.draw(|frame| {
            draw_selection(
                frame,
                tab,
                &entries,
                selected,
                delete_confirm.as_ref(),
                theme,
            )
        })?;

        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                if is_ctrl_c(&key) {
                    return Ok(None);
                }

                if delete_confirm.is_some() {
                    match key.code {
                        KeyCode::Char('y') | KeyCode::Char('Y') => {
                            let target = delete_confirm.take().expect("confirm state");
                            let _ = delete_agent(
                                client,
                                &target.id,
                                "Deleted from agent selection",
                            );
                            data = fetch_selection_data(client)?;
                            selected = 0;
                        }
                        KeyCode::Char('n')
                        | KeyCode::Char('N')
                        | KeyCode::Esc
                        | KeyCode::Enter => {
                            delete_confirm = None;
                        }
                        _ => {}
                    }
                    continue;
                }

                match (key.modifiers, key.code) {
                    (_, KeyCode::Left) | (_, KeyCode::Char('h')) => {
                        tab = tab.prev();
                        selected = 0;
                    }
                    (_, KeyCode::Right) | (_, KeyCode::Char('l')) => {
                        tab = tab.next();
                        selected = 0;
                    }
                    (m, KeyCode::Tab) if m.contains(KeyModifiers::SHIFT) => {
                        tab = tab.prev();
                        selected = 0;
                    }
                    (_, KeyCode::Tab) | (_, KeyCode::BackTab) => {
                        tab = tab.next();
                        selected = 0;
                    }
                    (m, KeyCode::Up) if !m.contains(KeyModifiers::CONTROL) => {
                        if !options.is_empty() {
                            selected =
                                (selected + options.len().saturating_sub(1)) % options.len();
                        }
                    }
                    (_, KeyCode::Char('k')) => {
                        if !options.is_empty() {
                            selected =
                                (selected + options.len().saturating_sub(1)) % options.len();
                        }
                    }
                    (m, KeyCode::Down) if !m.contains(KeyModifiers::CONTROL) => {
                        if !options.is_empty() {
                            selected = (selected + 1) % options.len();
                        }
                    }
                    (_, KeyCode::Char('j')) => {
                        if !options.is_empty() {
                            selected = (selected + 1) % options.len();
                        }
                    }
                    (_, KeyCode::Enter) => {
                        if let Some(outcome) = options.get(selected) {
                            return Ok(Some(outcome.clone()));
                        }
                    }
                    (_, KeyCode::Esc) | (_, KeyCode::Char('q')) => return Ok(None),
                    (_, KeyCode::Char('d')) | (_, KeyCode::Delete) => {
                        if tab == SelectionTab::RunningAgents {
                            if let Some(SelectionOutcome::Connect { id, display_name }) =
                                options.get(selected)
                            {
                                delete_confirm = Some(DeleteConfirm {
                                    id: id.clone(),
                                    display_name: display_name.clone(),
                                });
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}

fn draw_selection(
    frame: &mut Frame,
    tab: SelectionTab,
    entries: &[SelectionEntry],
    selected: usize,
    delete_confirm: Option<&DeleteConfirm>,
    theme: &Theme,
) {
    let area = frame.area();
    let width = area.width;
    let height = area.height;

    // Flat background fill.
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.app.background_color.color())),
        area,
    );

    if width < MIN_WIDTH || height < MIN_HEIGHT {
        let msg = format!("Terminal too small. Minimum: {MIN_WIDTH}x{MIN_HEIGHT}");
        frame.render_widget(
            Paragraph::new(msg).style(Style::default().fg(Tone::Warning.color(theme))),
            area,
        );
        return;
    }

    // Build the list items and locate the selected option's line index.
    let mut option_index = 0usize;
    let mut selected_line = 0usize;
    let chip_bg = theme.agent_selection.chip_background_color.color();
    let items: Vec<ListItem> = entries
        .iter()
        .enumerate()
        .map(|(line_index, entry)| match entry {
            SelectionEntry::Heading(label) => ListItem::new(Line::from(Span::styled(
                label.to_string(),
                Style::default()
                    .fg(theme.panel.heading_color.color())
                    .add_modifier(Modifier::BOLD),
            ))),
            SelectionEntry::Option { label, .. } => {
                let is_selected = option_index == selected;
                if is_selected {
                    selected_line = line_index;
                }
                option_index += 1;
                let marker = if is_selected { "›" } else { " " };
                let line = Line::from(format!("{marker} {label}"));
                let style = if is_selected {
                    Style::default()
                        .fg(theme.agent_selection.highlighted_color.color())
                        .bg(chip_bg)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default().fg(theme.agent_selection.item_text_color.color())
                };
                ListItem::new(line).style(style)
            }
        })
        .collect();

    let _ = selected_line;

    // Find the currently selected option's preview (for the detail pane).
    let selected_entry = {
        let mut oi = 0;
        entries.iter().find_map(|e| match e {
            SelectionEntry::Option {
                outcome,
                preview_title,
                preview_lines,
                ..
            } => {
                if oi == selected {
                    Some((
                        preview_title.clone(),
                        preview_lines.clone(),
                        outcome.clone(),
                    ))
                } else {
                    oi += 1;
                    None
                }
            }
            _ => None,
        })
    };

    let mut list_state = ListState::default();
    list_state.select(Some(selected_line));

    // Layout: header (3) + tab bar (1) + body (rest).
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(1),
            Constraint::Min(1),
        ])
        .split(area);

    // Header.
    let header_line = if width >= 70 {
        let banner = SCREEN_BANNER;
        let url = "https://tokenring.ai";
        let gap = width as usize - visible_len(banner) - visible_len(url);
        Line::from(vec![
            Span::styled(
                banner.to_string(),
                Style::default()
                    .fg(theme.agent_selection.banner_color.color())
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(" ".repeat(gap)),
            Span::styled(
                url.to_string(),
                Style::default().fg(Tone::Muted.color(theme)),
            ),
        ])
    } else {
        Line::from(SCREEN_BANNER.to_string()).style(
            Style::default()
                .fg(theme.agent_selection.banner_color.color())
                .add_modifier(Modifier::BOLD),
        )
    };
    let instruction = if tab == SelectionTab::RunningAgents {
        "←/→ or h/l to switch tabs, Up/Down or j/k to move, Enter to select, d to delete, q or Esc to quit"
    } else {
        "←/→ or h/l to switch tabs, Up/Down or j/k to move, Enter to select, q or Esc to quit"
    };
    frame.render_widget(
        Paragraph::new(vec![
            header_line,
            Line::from(instruction).style(Style::default().fg(Tone::Muted.color(theme))),
        ]),
        vertical[0],
    );

    // Tab bar.
    frame.render_widget(render_tab_bar(tab, theme), vertical[1]);

    // Body: two-pane when wide enough, else single pane.
    let body = vertical[2];
    let two_pane = width >= 90;

    let (list_area, detail_area) = if two_pane {
        let cols = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(45), Constraint::Min(1)])
            .split(body);
        (cols[0], Some(cols[1]))
    } else {
        (body, None)
    };

    frame.render_stateful_widget(
        List::new(items).style(Style::default()),
        list_area,
        &mut list_state,
    );

    if entries.is_empty() {
        let empty_msg = match tab {
            SelectionTab::RunningAgents => "No running agents.",
            SelectionTab::AgentDirectory => "No agent types are available.",
            SelectionTab::Workflows => "No workflows are available.",
        };
        frame.render_widget(
            Paragraph::new(empty_msg).style(Style::default().fg(Tone::Muted.color(theme))),
            list_area,
        );
    }

    if let Some((title, lines, _)) = selected_entry {
        if let Some(detail) = detail_area {
            render_preview_box(frame, detail, &title, &lines, theme);
        }
    }

    if let Some(target) = delete_confirm {
        draw_delete_confirm(frame, target, theme);
    }
}

fn render_tab_bar(tab: SelectionTab, theme: &Theme) -> Paragraph<'static> {
    let mut spans: Vec<Span<'static>> = Vec::new();
    for (index, candidate) in SelectionTab::ALL.into_iter().enumerate() {
        if index > 0 {
            spans.push(Span::raw("  "));
        }
        let label = candidate.label();
        let text = format!("[{label}]");
        let style = if candidate == tab {
            Style::default()
                .fg(theme.agent_selection.highlighted_color.color())
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Tone::Muted.color(theme))
        };
        spans.push(Span::styled(text, style));
    }
    Paragraph::new(Line::from(spans))
}

fn draw_delete_confirm(frame: &mut Frame, target: &DeleteConfirm, theme: &Theme) {
    let area = frame.area();
    let width = area.width.min(60).max(30);
    let height = 5u16;
    let x = area.x + area.width.saturating_sub(width) / 2;
    let y = area.y + area.height.saturating_sub(height + 2);
    let popup = Rect::new(x, y, width, height);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Tone::Warning.color(theme)))
        .title(Span::styled(
            " Delete agent? ",
            Style::default()
                .fg(Tone::Warning.color(theme))
                .add_modifier(Modifier::BOLD),
        ))
        .style(Style::default().bg(theme.panel.background_color.color()));
    let inner = block.inner(popup);
    frame.render_widget(block, popup);

    let prompt = format!(
        "Delete \"{}\" ({})?",
        target.display_name, target.id
    );
    let lines = vec![
        Line::from(Span::styled(
            fit_line(&prompt, inner.width as usize),
            Style::default().fg(theme.transcript.body_color.color()),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            "y confirm  n or Esc cancel",
            Style::default().fg(Tone::Muted.color(theme)),
        )),
    ];
    frame.render_widget(Paragraph::new(lines), inner);
}

fn render_preview_box(frame: &mut Frame, area: Rect, title: &str, lines: &[String], theme: &Theme) {
    let block = match theme.layout.panel_style {
        PanelStyle::Flat => Block::default()
            .borders(Borders::TOP)
            .border_style(Style::default().fg(theme.panel.subtle_border_color.color()))
            .title(Span::styled(
                fit_line(title, area.width.saturating_sub(2) as usize),
                Style::default()
                    .fg(theme.panel.heading_color.color())
                    .add_modifier(Modifier::BOLD),
            ))
            .style(Style::default().bg(theme.panel.background_color.color())),
        PanelStyle::Framed => Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(theme.panel.border_color.color()))
            .title(Span::styled(
                fit_line(title, area.width.saturating_sub(2) as usize),
                Style::default()
                    .fg(theme.panel.title_color.color())
                    .add_modifier(Modifier::BOLD),
            )),
    };

    let inner = block.inner(area);
    frame.render_widget(block, area);

    let mut wrapped: Vec<String> = Vec::new();
    for line in lines {
        wrapped.extend(wrap_plain_text(line, inner.width as usize));
    }
    let body: Vec<Line> = wrapped
        .into_iter()
        .map(|l| candy::style_preview_line(&l, theme))
        .collect();
    frame.render_widget(Paragraph::new(body).wrap(Wrap { trim: false }), inner);
}

// ---------------------------------------------------------------------------
// Entry building (port of `buildSelectionEntries`, split by tab)
// ---------------------------------------------------------------------------

fn selection_has_any_options(data: &SelectionData) -> bool {
    !data.agents.is_empty() || !data.types.is_empty() || !data.workflows.is_empty()
}

fn build_tab_entries(tab: SelectionTab, data: &SelectionData) -> Vec<SelectionEntry> {
    match tab {
        SelectionTab::RunningAgents => build_running_agent_entries(data),
        SelectionTab::AgentDirectory => build_agent_directory_entries(data),
        SelectionTab::Workflows => build_workflow_entries(data),
    }
}

const RUNNING_AGENT_TIME_CATEGORIES: [&str; 4] = [
    "Today",
    "Yesterday",
    "This Week",
    "More Than a Week Ago",
];

fn local_midnight_ms<Tz: TimeZone>(day: NaiveDate, tz: &Tz) -> Option<i64>
where
    Tz::Offset: Copy,
{
    let midnight = day.and_hms_opt(0, 0, 0)?;
    Some(tz.from_local_datetime(&midnight).single()?.timestamp_millis())
}

fn running_agent_time_category_at<Tz: TimeZone>(
    created_at_ms: i64,
    now: DateTime<Tz>,
) -> &'static str
where
    Tz::Offset: Copy,
{
    let today = now.date_naive();
    let tz = now.timezone();
    let Some(start_of_today) = local_midnight_ms(today, &tz) else {
        return "More Than a Week Ago";
    };
    let start_of_yesterday =
        local_midnight_ms(today.pred_opt().unwrap_or(today), &tz).unwrap_or(start_of_today);
    let week_ago_day = today
        .checked_sub_days(chrono::Days::new(7))
        .unwrap_or(today);
    let start_of_week_window =
        local_midnight_ms(week_ago_day, &tz).unwrap_or(start_of_yesterday);

    if created_at_ms >= start_of_today {
        "Today"
    } else if created_at_ms >= start_of_yesterday {
        "Yesterday"
    } else if created_at_ms >= start_of_week_window {
        "This Week"
    } else {
        "More Than a Week Ago"
    }
}

fn format_running_agent_timestamp(created_at_ms: i64) -> String {
    let Some(created) = Local.timestamp_millis_opt(created_at_ms).single() else {
        return String::new();
    };
    let today = Local::now().date_naive();
    let created_date = created.date_naive();
    if created_date == today {
        created.format("%H:%M:%S").to_string()
    } else if created_date.year() != today.year() {
        created.format("%b %d %Y %H:%M").to_string()
    } else {
        created.format("%b %d %H:%M").to_string()
    }
}

fn running_agent_label(agent: &RunningAgent) -> String {
    let timestamp = format_running_agent_timestamp(agent.created_at);
    if timestamp.is_empty() {
        agent.display_name.clone()
    } else {
        format!("{}  {timestamp}", agent.display_name)
    }
}

fn running_agent_option(agent: &RunningAgent) -> SelectionEntry {
    SelectionEntry::Option {
        label: running_agent_label(agent),
        outcome: SelectionOutcome::Connect {
            id: agent.id.clone(),
            display_name: agent.display_name.clone(),
        },
        preview_title: format!("Agent {}", agent.id),
        preview_lines: {
            let status = if agent.idle { "idle" } else { "running" };
            let created = format_running_agent_timestamp(agent.created_at);
            let mut lines = vec![
                agent.display_name.clone(),
                format!("Status: {status}"),
                format!("Created: {created}"),
            ];
            if !agent.current_activity.is_empty() {
                lines.push(format!("Activity: {}", agent.current_activity));
            }
            lines
        },
    }
}

fn build_running_agent_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;

    let now = Local::now();
    let mut categories: BTreeMap<&'static str, Vec<&RunningAgent>> = BTreeMap::new();

    for agent in &data.agents {
        let category = running_agent_time_category_at(agent.created_at, now);
        categories.entry(category).or_default().push(agent);
    }

    let mut result = Vec::new();
    for category in RUNNING_AGENT_TIME_CATEGORIES {
        let Some(mut agents) = categories.remove(category) else {
            continue;
        };
        agents.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result.push(SelectionEntry::Heading(category.to_string()));
        result.extend(agents.into_iter().map(running_agent_option));
    }
    result
}

fn build_agent_directory_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;
    let mut categories: BTreeMap<String, Vec<SelectionEntry>> = BTreeMap::new();

    for entry in &data.types {
        let category = entry
            .category
            .clone()
            .unwrap_or_else(|| "Other".to_string());
        let list = categories.entry(category).or_default();
        list.push(SelectionEntry::Option {
            label: format!("{} ({})", entry.display_name, entry.r#type),
            outcome: SelectionOutcome::Spawn {
                agent_type: entry.r#type.clone(),
                display_name: entry.display_name.clone(),
            },
            preview_title: entry.display_name.clone(),
            preview_lines: {
                let tools = if entry.enabled_tools.is_empty() {
                    "(none)".to_string()
                } else {
                    entry.enabled_tools.join(", ")
                };
                vec![entry.description.clone(), format!("Enabled tools: {tools}")]
            },
        });
    }

    let mut result = Vec::new();
    for (category, mut list) in categories {
        if list.is_empty() {
            continue;
        }
        list.sort_by(|a, b| entry_label(a).cmp(entry_label(b)));
        result.push(SelectionEntry::Heading(category));
        result.extend(list);
    }
    result
}

fn build_workflow_entries(data: &SelectionData) -> Vec<SelectionEntry> {
    use std::collections::BTreeMap;
    let mut categories: BTreeMap<String, Vec<SelectionEntry>> = BTreeMap::new();

    for wf in &data.workflows {
        let category = if wf.category.is_empty() {
            "Other".to_string()
        } else {
            wf.category.clone()
        };
        let list = categories.entry(category).or_default();
        list.push(SelectionEntry::Option {
            label: format!("{} ({})", wf.display_name, wf.name),
            outcome: SelectionOutcome::Workflow {
                name: wf.name.clone(),
                display_name: wf.display_name.clone(),
            },
            preview_title: wf.display_name.clone(),
            preview_lines: {
                let mut lines = vec![wf.description.clone()];
                if !wf.steps.is_empty() {
                    lines.push(format!("Steps: {}", wf.steps.join(" → ")));
                }
                lines
            },
        });
    }

    let mut result = Vec::new();
    for (category, mut list) in categories {
        if list.is_empty() {
            continue;
        }
        list.sort_by(|a, b| entry_label(a).cmp(entry_label(b)));
        result.push(SelectionEntry::Heading(category));
        result.extend(list);
    }
    result
}

fn entry_label(entry: &SelectionEntry) -> &str {
    match entry {
        SelectionEntry::Heading(l) => l,
        SelectionEntry::Option { label, .. } => label,
    }
}

fn is_ctrl_c(key: &KeyEvent) -> bool {
    matches!(
        (key.modifiers, key.code),
        (KeyModifiers::CONTROL, KeyCode::Char('c'))
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, FixedOffset};

    fn sample() -> SelectionData {
        SelectionData {
            agents: vec![RunningAgent {
                id: "agent-1".into(),
                created_at: Local::now().timestamp_millis(),
                display_name: "Zeta".into(),
                description: "a running agent".into(),
                idle: true,
                current_activity: "".into(),
            }],
            types: vec![
                AgentTypeEntry {
                    r#type: "code".into(),
                    display_name: "Coder".into(),
                    description: "writes code".into(),
                    category: Some("Other".into()),
                    enabled_tools: vec!["read".into(), "write".into()],
                },
                AgentTypeEntry {
                    r#type: "architect".into(),
                    display_name: "Architect".into(),
                    description: "plans".into(),
                    category: None,
                    enabled_tools: vec![],
                },
            ],
            workflows: vec![WorkflowEntry {
                name: "wf".into(),
                category: "Automation".into(),
                display_name: "Builder".into(),
                description: "a workflow".into(),
                agent_type: "code".into(),
                steps: vec![],
            }],
        }
    }

    #[test]
    fn workflows_group_by_category() {
        let data = SelectionData {
            workflows: vec![
                WorkflowEntry {
                    name: "alpha".into(),
                    category: "Build".into(),
                    display_name: "Alpha".into(),
                    ..WorkflowEntry::default()
                },
                WorkflowEntry {
                    name: "beta".into(),
                    category: "Deploy".into(),
                    display_name: "Beta".into(),
                    ..WorkflowEntry::default()
                },
                WorkflowEntry {
                    name: "gamma".into(),
                    category: "Build".into(),
                    display_name: "Gamma".into(),
                    ..WorkflowEntry::default()
                },
            ],
            ..SelectionData::default()
        };

        let entries = build_workflow_entries(&data);
        let headings: Vec<&str> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Heading(label) => Some(label.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(headings, vec!["Build", "Deploy"]);
        assert_eq!(
            entries
                .iter()
                .filter(|e| matches!(e, SelectionEntry::Option { .. }))
                .count(),
            3
        );
    }

    #[test]
    fn agent_directory_preserves_categories() {
        let entries = build_agent_directory_entries(&sample());
        let heading: Vec<&str> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Heading(l) => Some(l.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(heading, vec!["Other"]);
        assert_eq!(entries.iter().filter(|e| matches!(e, SelectionEntry::Option { .. })).count(), 2);
    }

    #[test]
    fn running_agents_group_by_time_category() {
        let tz = FixedOffset::east_opt(0).unwrap();
        let now = tz.with_ymd_and_hms(2026, 6, 28, 12, 0, 0).unwrap();
        assert_eq!(
            running_agent_time_category_at(now.timestamp_millis(), now),
            "Today"
        );
        assert_eq!(
            running_agent_time_category_at(
                (now - Duration::days(1)).timestamp_millis(),
                now
            ),
            "Yesterday"
        );
        assert_eq!(
            running_agent_time_category_at(
                (now - Duration::days(3)).timestamp_millis(),
                now
            ),
            "This Week"
        );
        assert_eq!(
            running_agent_time_category_at(
                (now - Duration::days(10)).timestamp_millis(),
                now
            ),
            "More Than a Week Ago"
        );
    }

    #[test]
    fn running_agents_render_time_headings() {
        let now = Local::now();
        let data = SelectionData {
            agents: vec![
                RunningAgent {
                    id: "today".into(),
                    created_at: now.timestamp_millis(),
                    display_name: "Today Agent".into(),
                    ..RunningAgent::default()
                },
                RunningAgent {
                    id: "yesterday".into(),
                    created_at: (now - Duration::days(1)).timestamp_millis(),
                    display_name: "Yesterday Agent".into(),
                    ..RunningAgent::default()
                },
                RunningAgent {
                    id: "older".into(),
                    created_at: (now - Duration::days(4)).timestamp_millis(),
                    display_name: "Older Agent".into(),
                    ..RunningAgent::default()
                },
                RunningAgent {
                    id: "ancient".into(),
                    created_at: (now - Duration::days(10)).timestamp_millis(),
                    display_name: "Ancient Agent".into(),
                    ..RunningAgent::default()
                },
            ],
            ..SelectionData::default()
        };

        let entries = build_running_agent_entries(&data);
        let headings: Vec<&str> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Heading(label) => Some(label.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(
            headings,
            vec![
                "Today",
                "Yesterday",
                "This Week",
                "More Than a Week Ago"
            ]
        );
    }

    #[test]
    fn running_agents_sort_newest_first_within_category() {
        let now = Local::now();
        let data = SelectionData {
            agents: vec![
                RunningAgent {
                    id: "older-today".into(),
                    created_at: (now - Duration::hours(2)).timestamp_millis(),
                    display_name: "Older Today".into(),
                    ..RunningAgent::default()
                },
                RunningAgent {
                    id: "newer-today".into(),
                    created_at: now.timestamp_millis(),
                    display_name: "Newer Today".into(),
                    ..RunningAgent::default()
                },
            ],
            ..SelectionData::default()
        };

        let entries = build_running_agent_entries(&data);
        let ids: Vec<&str> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Option {
                    outcome: SelectionOutcome::Connect { id, .. },
                    ..
                } => Some(id.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(ids, vec!["newer-today", "older-today"]);

        let labels: Vec<String> = entries
            .iter()
            .filter_map(|e| match e {
                SelectionEntry::Option { label, .. } => Some(label.clone()),
                _ => None,
            })
            .collect();
        assert!(labels[0].starts_with("Newer Today  "));
        assert!(labels[1].starts_with("Older Today  "));
    }

    #[test]
    fn running_agent_timestamp_shows_time_for_today() {
        let now = Local::now();
        let label = running_agent_label(&RunningAgent {
            created_at: now.timestamp_millis(),
            display_name: "Agent".into(),
            ..RunningAgent::default()
        });
        assert!(label.starts_with("Agent  "));
        assert!(label.contains(&now.format("%H:%M:%S").to_string()));
    }

    #[test]
    fn selection_tabs_split_content() {
        let data = sample();
        let running = build_running_agent_entries(&data);
        let directory = build_agent_directory_entries(&data);
        let workflows = build_workflow_entries(&data);

        assert!(running.iter().any(|e| {
            matches!(
                e,
                SelectionEntry::Option {
                    outcome: SelectionOutcome::Connect { ref id, .. },
                    ..
                } if id == "agent-1"
            )
        }));

        assert!(directory.iter().any(|e| {
            matches!(
                e,
                SelectionEntry::Option {
                    outcome: SelectionOutcome::Spawn { agent_type, .. },
                    ..
                } if agent_type == "code"
            )
        }));

        assert!(workflows.iter().any(|e| {
            matches!(
                e,
                SelectionEntry::Option {
                    outcome: SelectionOutcome::Workflow { name, .. },
                    ..
                } if name == "wf"
            )
        }));
    }
}
