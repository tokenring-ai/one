//! Startup, error, and loading screens used around the main selection flow.

use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{bail, Result};
use crossterm::event::{self, Event, KeyCode};
use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame, Terminal,
};

use super::{fetch_selection_data, is_ctrl_c, SelectionData};
use crate::rpc::RpcClient;
use crate::theme::{Theme, Tone};
use crate::tui::candy;
use crate::tui::spinner::{banner_lines, spinner_frame, spinner_message, SCREEN_BANNER};
use crate::tui::text::{center_line, fit_line, wrap_plain_text};

const MIN_LOADING_DURATION: Duration = Duration::from_secs(1);

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
        if crate::signal::take_quit() || !crate::tui::tty::is_alive() {
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
        if crate::signal::take_quit() || !crate::tui::tty::is_alive() {
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
        if !crate::tui::tty::is_alive() {
            bail!("terminal disconnected");
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

        if started_at.elapsed() >= MIN_LOADING_DURATION {
            if let Some(data) = ready.take() {
                return data;
            }
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
