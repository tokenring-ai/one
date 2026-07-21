//! Full-screen selection UI and shared overlays. Startup, error, loading, and
//! entry-building responsibilities live in focused child modules.
//!
//! Both run inside the shared alternate screen and return control to the
//! caller when done.

use std::time::Duration;

use crate::instance::CapturedOutput;
use crate::rpc::{
    delete_agent, get_agent_types, list_agents, list_checkpoints, list_workflows, AgentTypeEntry,
    CheckpointEntry, RpcClient, RunningAgent, WorkflowEntry,
};
use crate::theme::{Theme, Tone};
use crate::tui::candy;
use crate::tui::spinner::SCREEN_BANNER;
use crate::tui::text::{fit_line, visible_len, wrap_plain_text};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, ListState, Padding, Paragraph, Wrap},
    Frame, Terminal,
};

/// The data backing the agent-selection list.
#[derive(Clone, Debug, Default)]
pub struct SelectionData {
    pub agents: Vec<RunningAgent>,
    pub checkpoints: Vec<CheckpointEntry>,
    pub types: Vec<AgentTypeEntry>,
    pub workflows: Vec<WorkflowEntry>,
}

/// Fetch all data needed for selection. Runs the three list queries.
pub fn fetch_selection_data(client: &RpcClient) -> Result<SelectionData> {
    Ok(SelectionData {
        agents: list_agents(client)?,
        checkpoints: list_checkpoints(client)?,
        types: get_agent_types(client)?,
        workflows: list_workflows(client)?,
    })
}

/// What the user picked from the selection screen.
#[derive(Clone, Debug)]
pub enum SelectionOutcome {
    Spawn {
        agent_type: String,
        display_name: String,
    },
    Connect {
        id: String,
        display_name: String,
    },
    Resume {
        checkpoint_id: u64,
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
    RecentSessions,
    AgentDirectory,
    Workflows,
}

impl SelectionTab {
    fn label(self) -> &'static str {
        match self {
            Self::RunningAgents => "Running Agents",
            Self::RecentSessions => "Recent Sessions",
            Self::AgentDirectory => "Agent Directory",
            Self::Workflows => "Workflows",
        }
    }

    /// Tabs shown in the selection browser. Data-backed tabs are omitted when empty.
    fn visible(data: &SelectionData) -> Vec<Self> {
        let mut tabs = Vec::new();
        if !data.agents.is_empty() {
            tabs.push(Self::RunningAgents);
        }
        if !data.checkpoints.is_empty() {
            tabs.push(Self::RecentSessions);
        }
        tabs.push(Self::AgentDirectory);
        tabs.push(Self::Workflows);
        tabs
    }

    fn next(self, visible: &[Self]) -> Self {
        let idx = visible.iter().position(|&t| t == self).unwrap_or(0);
        visible[(idx + 1) % visible.len()]
    }

    fn prev(self, visible: &[Self]) -> Self {
        let idx = visible.iter().position(|&t| t == self).unwrap_or(0);
        visible[(idx + visible.len() - 1) % visible.len()]
    }
}

struct DeleteConfirm {
    id: String,
    display_name: String,
}

const MIN_WIDTH: u16 = 40;
const MIN_HEIGHT: u16 = 10;

/// Draw the tail of a locally launched instance's stdout/stderr as a modal.
/// The buffer itself is bounded by `instance.rs`, so taking a snapshot here is
/// cheap and never holds its mutex while Ratatui renders.
pub fn draw_instance_output_overlay(
    frame: &mut Frame,
    area: Rect,
    output: Option<&CapturedOutput>,
    theme: &Theme,
) {
    let width = area.width.saturating_sub(4).min(100).max(30);
    let height = area.height.saturating_sub(4).min(30).max(8);
    let overlay = Rect {
        x: area.x + area.width.saturating_sub(width) / 2,
        y: area.y + area.height.saturating_sub(height) / 2,
        width,
        height,
    };
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" Local instance output · Esc close ")
        .border_style(Style::default().fg(theme.help.border_color.color()))
        .style(Style::default().bg(theme.help.background_color.color()));
    let inner = block.inner(overlay);
    let visible = inner.height as usize;
    let lines = match output {
        Some(output) => {
            let lines = output.lines();
            if lines.is_empty() {
                vec![Line::from("No output has been captured yet.")]
            } else {
                lines
                    .into_iter()
                    .rev()
                    .take(visible)
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .map(Line::from)
                    .collect()
            }
        }
        None => vec![Line::from(
            "Instance output is unavailable for remote connections.",
        )],
    };

    frame.render_widget(Clear, overlay);
    frame.render_widget(block, overlay);
    frame.render_widget(
        Paragraph::new(lines).style(Style::default().fg(Tone::Muted.color(theme))),
        inner,
    );
}

mod lifecycle;
pub use lifecycle::{
    run_loading_screen, run_local_instance_screen, show_error_screen, ErrorScreenAction,
};

// ---------------------------------------------------------------------------
// Selection screen
// ---------------------------------------------------------------------------

/// Show the agent-selection browser (tabbed). Returns `Some(outcome)` on selection or
/// `None` if the user quit.
///
/// Tabs: Running Agents (when any) | Recent Sessions (when any) | Agent Directory | Workflows.
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
            let msg = "No agents, recent sessions, agent types, or workflows are available.";
            frame.render_widget(
                Paragraph::new(msg).style(Style::default().fg(Tone::Warning.color(theme))),
                frame.area(),
            )
        })?;
        // Wait for any key (or signal) before returning.
        loop {
            if crate::signal::take_quit() || !crate::tui::tty::is_alive() {
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

    let mut tab = SelectionTab::visible(&data)[0];
    let mut selected = 0usize;
    let mut delete_confirm: Option<DeleteConfirm> = None;

    loop {
        if crate::signal::take_quit() || !crate::tui::tty::is_alive() {
            return Ok(None);
        }

        let visible_tabs = SelectionTab::visible(&data);
        if !visible_tabs.contains(&tab) {
            tab = visible_tabs[0];
            selected = 0;
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
                &visible_tabs,
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
                            if let Err(error) =
                                delete_agent(client, &target.id, "Deleted from agent selection")
                            {
                                // Keep the selection screen up; re-fetch may still
                                // show the agent if delete failed.
                                let _ = show_error_screen(
                                    terminal,
                                    "Failed to delete agent",
                                    &format!("{error:#}"),
                                    theme,
                                    false,
                                )?;
                            }
                            data = fetch_selection_data(client)?;
                            selected = 0;
                        }
                        KeyCode::Char('n') | KeyCode::Char('N') | KeyCode::Esc | KeyCode::Enter => {
                            delete_confirm = None;
                        }
                        _ => {}
                    }
                    continue;
                }

                match (key.modifiers, key.code) {
                    (_, KeyCode::Left) | (_, KeyCode::Char('h')) => {
                        tab = tab.prev(&visible_tabs);
                        selected = 0;
                    }
                    (_, KeyCode::Right) | (_, KeyCode::Char('l')) => {
                        tab = tab.next(&visible_tabs);
                        selected = 0;
                    }
                    (m, KeyCode::Tab) if m.contains(KeyModifiers::SHIFT) => {
                        tab = tab.prev(&visible_tabs);
                        selected = 0;
                    }
                    (_, KeyCode::Tab) | (_, KeyCode::BackTab) => {
                        tab = tab.next(&visible_tabs);
                        selected = 0;
                    }
                    (m, KeyCode::Up) if !m.contains(KeyModifiers::CONTROL) => {
                        if !options.is_empty() {
                            selected = (selected + options.len().saturating_sub(1)) % options.len();
                        }
                    }
                    (_, KeyCode::Char('k')) => {
                        if !options.is_empty() {
                            selected = (selected + options.len().saturating_sub(1)) % options.len();
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
    visible_tabs: &[SelectionTab],
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

    // Layout: header + padded tab bar + body.
    let vertical = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(1),
        ])
        .split(area);

    // Header.
    let header_bg = theme.agent_selection.banner_background_color.color();
    let header_content_width = width.saturating_sub(4) as usize;
    let header_line = if width >= 70 {
        let banner = SCREEN_BANNER;
        let url = "https://tokenring.ai";
        let gap = header_content_width.saturating_sub(visible_len(banner) + visible_len(url));
        Line::from(vec![
            Span::styled(
                banner.to_string(),
                Style::default()
                    .fg(theme.agent_selection.banner_color.color())
                    .bg(header_bg)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(" ".repeat(gap), Style::default().bg(header_bg)),
            Span::styled(
                url.to_string(),
                Style::default().fg(Tone::Muted.color(theme)).bg(header_bg),
            ),
        ])
    } else {
        Line::from(SCREEN_BANNER.to_string()).style(
            Style::default()
                .fg(theme.agent_selection.banner_color.color())
                .bg(header_bg)
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
            Line::from(instruction)
                .style(Style::default().fg(Tone::Muted.color(theme)).bg(header_bg)),
        ])
        .block(
            Block::default()
                .style(Style::default().bg(header_bg))
                .padding(Padding::horizontal(2)),
        )
        .style(Style::default().bg(header_bg)),
        vertical[0],
    );

    // Tab bar.
    frame.render_widget(render_tab_bar(tab, visible_tabs, theme), vertical[1]);

    // Body: two-pane when wide enough, else single pane.
    let body = vertical[2];
    let two_pane = width >= 90;

    let (list_area, detail_area) = if two_pane {
        let cols = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(45), Constraint::Min(1)])
            .spacing(1)
            .split(body);
        (cols[0], Some(cols[1]))
    } else {
        (body, None)
    };

    let list_block = Block::default()
        .style(Style::default().bg(theme.panel.background_color.color()))
        .padding(Padding::new(2, 2, 1, 1));
    let list_inner = list_block.inner(list_area);
    frame.render_widget(list_block, list_area);
    frame.render_stateful_widget(List::new(items), list_inner, &mut list_state);

    if entries.is_empty() {
        let empty_msg = match tab {
            SelectionTab::RunningAgents => "No running agents.",
            SelectionTab::RecentSessions => "No recent sessions.",
            SelectionTab::AgentDirectory => "No agent types are available.",
            SelectionTab::Workflows => "No workflows are available.",
        };
        frame.render_widget(
            Paragraph::new(empty_msg).style(Style::default().fg(Tone::Muted.color(theme))),
            list_inner,
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

fn render_tab_bar(
    tab: SelectionTab,
    visible_tabs: &[SelectionTab],
    theme: &Theme,
) -> Paragraph<'static> {
    let mut spans: Vec<Span<'static>> = Vec::new();
    for (index, &candidate) in visible_tabs.iter().enumerate() {
        if index > 0 {
            spans.push(Span::raw("  "));
        }
        let label = candidate.label();
        let text = format!("  {label}  ");
        let style = if candidate == tab {
            Style::default()
                .fg(theme.agent_selection.highlighted_color.color())
                .bg(theme.agent_selection.chip_background_color.color())
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default()
                .fg(Tone::Muted.color(theme))
                .bg(theme.panel.background_color.color())
        };
        spans.push(Span::styled(text, style));
    }
    Paragraph::new(Line::from(spans))
        .block(
            Block::default()
                .style(Style::default().bg(theme.agent_selection.background_color.color()))
                .padding(Padding::new(2, 2, 1, 0)),
        )
        .style(Style::default().bg(theme.agent_selection.background_color.color()))
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

    let prompt = format!("Delete \"{}\" ({})?", target.display_name, target.id);
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
    let block = Block::default()
        .borders(Borders::TOP)
        .border_style(Style::default().fg(theme.panel.subtle_border_color.color()))
        .style(Style::default().bg(theme.panel.background_color.color()))
        .padding(Padding::new(2, 2, 0, 0));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    // Render the heading as the first line of content inside the padded inner area
    let heading_color = theme.panel.heading_color.color();

    let mut body: Vec<Line> = vec![
        Line::from(Span::styled(
            fit_line(title, inner.width as usize),
            Style::default()
                .fg(heading_color)
                .add_modifier(Modifier::BOLD),
        )),
        Line::raw(""), // Spacer below the heading
    ];

    let mut wrapped: Vec<String> = Vec::new();
    for line in lines {
        wrapped.extend(wrap_plain_text(line, inner.width as usize));
    }
    body.extend(
        wrapped
            .into_iter()
            .map(|l| candy::style_preview_line(&l, theme)),
    );

    frame.render_widget(Paragraph::new(body).wrap(Wrap { trim: false }), inner);
}

mod entries;
use entries::{build_tab_entries, selection_has_any_options};

fn is_ctrl_c(key: &KeyEvent) -> bool {
    matches!(
        (key.modifiers, key.code),
        (KeyModifiers::CONTROL, KeyCode::Char('c'))
    )
}

#[cfg(test)]
mod tests {
    use super::entries::{
        build_agent_directory_entries, build_recent_session_entries, build_running_agent_entries,
        build_workflow_entries, running_agent_label, running_agent_time_category_at,
    };
    use super::*;
    use chrono::{Duration, FixedOffset, Local, TimeZone};
    use ratatui::backend::TestBackend;

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
            checkpoints: vec![],
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
        assert_eq!(
            entries
                .iter()
                .filter(|e| matches!(e, SelectionEntry::Option { .. }))
                .count(),
            2
        );
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
            running_agent_time_category_at((now - Duration::days(1)).timestamp_millis(), now),
            "Yesterday"
        );
        assert_eq!(
            running_agent_time_category_at((now - Duration::days(3)).timestamp_millis(), now),
            "This Week"
        );
        assert_eq!(
            running_agent_time_category_at((now - Duration::days(10)).timestamp_millis(), now),
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
            vec!["Today", "Yesterday", "This Week", "More Than a Week Ago"]
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
    fn running_agents_tab_hidden_when_empty() {
        let with_agents = sample();
        assert_eq!(
            SelectionTab::visible(&with_agents),
            vec![
                SelectionTab::RunningAgents,
                SelectionTab::AgentDirectory,
                SelectionTab::Workflows,
            ]
        );

        let without_agents = SelectionData {
            agents: vec![],
            ..sample()
        };
        assert_eq!(
            SelectionTab::visible(&without_agents),
            vec![SelectionTab::AgentDirectory, SelectionTab::Workflows]
        );

        // Navigation skips the hidden tab.
        let visible = SelectionTab::visible(&without_agents);
        assert_eq!(
            SelectionTab::AgentDirectory.next(&visible),
            SelectionTab::Workflows
        );
        assert_eq!(
            SelectionTab::Workflows.next(&visible),
            SelectionTab::AgentDirectory
        );
        assert_eq!(
            SelectionTab::AgentDirectory.prev(&visible),
            SelectionTab::Workflows
        );
    }

    #[test]
    fn recent_sessions_sort_newest_first_and_resume_checkpoint() {
        let now = Local::now();
        let data = SelectionData {
            checkpoints: vec![
                CheckpointEntry {
                    id: 10,
                    name: "Older session".into(),
                    agent_id: "old-agent".into(),
                    created_at: (now - Duration::hours(2)).timestamp_millis(),
                    ..CheckpointEntry::default()
                },
                CheckpointEntry {
                    id: 20,
                    name: "Newer session".into(),
                    agent_id: "new-agent".into(),
                    agent_type: "code".into(),
                    created_at: now.timestamp_millis(),
                    ..CheckpointEntry::default()
                },
            ],
            ..SelectionData::default()
        };

        assert!(SelectionTab::visible(&data).contains(&SelectionTab::RecentSessions));
        let entries = build_recent_session_entries(&data);
        let checkpoints: Vec<u64> = entries
            .iter()
            .filter_map(|entry| match entry {
                SelectionEntry::Option {
                    outcome: SelectionOutcome::Resume { checkpoint_id, .. },
                    ..
                } => Some(*checkpoint_id),
                _ => None,
            })
            .collect();
        assert_eq!(checkpoints, vec![20, 10]);
    }

    #[test]
    fn selection_screen_uses_uniform_header_flat_tabs_and_padded_panes() {
        let theme = Theme::material_dark();
        let data = sample();
        let visible_tabs = SelectionTab::visible(&data);
        let entries = build_tab_entries(SelectionTab::RunningAgents, &data);
        let mut terminal = Terminal::new(TestBackend::new(120, 30)).unwrap();

        terminal
            .draw(|frame| {
                draw_selection(
                    frame,
                    SelectionTab::RunningAgents,
                    &visible_tabs,
                    &entries,
                    0,
                    None,
                    &theme,
                )
            })
            .unwrap();

        let buffer = terminal.backend().buffer();
        let header_bg = theme.agent_selection.banner_background_color.color();
        for y in 0..3 {
            for x in 0..120 {
                assert_eq!(buffer[(x, y)].bg, header_bg);
            }
        }

        let tab_row = (0..120)
            .map(|x| buffer[(x, 4)].symbol())
            .collect::<String>();
        assert!(tab_row.contains("  Running Agents  "));
        assert!(!tab_row.contains('['));

        // The first list heading starts after the panel's two-column inset.
        assert_eq!(buffer[(0, 7)].symbol(), " ");
        assert_eq!(buffer[(1, 7)].symbol(), " ");
        assert_eq!(buffer[(2, 7)].symbol(), "T");
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
