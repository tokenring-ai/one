//! Chat UI Rendering Module - Top-Level Frame Dispatcher
//!
//! This module orchestrates the complete rendering of the TokenRing CLI chat interface,
//! managing the layout and drawing of all visual components within the TUI.
//!
//! ## Core Responsibilities
//! - **Layout Management**: Splits the terminal area into header, content, and status regions
//! - **Component Rendering**: Draws all chat UI elements including transcript, composer, and hints
//! - **Dynamic Layouts**: Handles conditional rendering for questions, pickers, and follow-ups
//! - **Viewport Scrolling**: Manages transcript scrolling with scrollback buffer support
//!
//! ## Rendered Components
//! - `draw_header`: Full-width header bar displaying the TokenRing branding and current agent
//! - `draw_transcript`: Scrollable chat history with streaming cursors and collapsible tool calls
//! - `draw_composer`: Message input area with syntax highlighting and cursor positioning
//! - `draw_status`: Bottom status bar showing connection state and system information
//! - `draw_hint`: Interactive hint line displaying available keyboard shortcuts
//! - `draw_quick_replies`: Quick-reply chip suggestions for common responses
//! - `draw_help_overlay`: Context-sensitive help overlay for all available commands
//!
//! ## Layout Variants
//! The module automatically selects the appropriate layout based on session state:
//! - Standard chat view (transcript + composer)
//! - Active question view (full-screen question prompt)
//! - Optional picker view (file search or completion selectors)
//! - Follow-up focused view (suggested response options)

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Paragraph},
    Frame,
};

use crate::theme::Tone;
use crate::tui::candy;
use crate::tui::editor::{render_editor, EditorView};
use crate::tui::help::{self, HelpContext};
use crate::tui::screens::draw_instance_output_overlay;

use crate::tui::ui_layout::UiHitRegions;

use super::layout::{
    composer_surface_height, composer_text_width, stripe_color, surface_block, ui_spacing,
};
use super::panels::{draw_with_followup, draw_with_optional_picker, draw_with_question};
use super::pickers::{
    completion_max_visible_rows, completion_picker_lines, draw_completion_picker,
    draw_filesearch_picker, filesearch_max_visible_rows, filesearch_picker_lines,
};
use super::transcript_entries::{render_transcript_entry, EntryRenderProps};
use super::ChatSession;

pub(super) fn draw(frame: &mut Frame, session: &mut ChatSession) {
    session.hit_regions = UiHitRegions::default();
    let area = frame.area();
    let theme = &session.theme;

    // Flat Material background fill.
    frame.render_widget(
        Block::default().style(Style::default().bg(theme.app.background_color.color())),
        area,
    );

    if area.width < 40 || area.height < 10 {
        session.terminal_too_small = true;
        let msg = "Terminal too small (min 40x10). Esc or Ctrl+X q to quit.";
        frame.render_widget(
            Paragraph::new(msg).style(Style::default().fg(Tone::Warning.color(theme))),
            area,
        );
        return;
    }
    session.terminal_too_small = false;

    // When the sidebar is open it is a full-height right column from the top
    // of the screen; header and status only span the main column. When closed,
    // header/status stay full-width as before.
    let show_sidebar = session.sidebar_open && area.width >= SIDEBAR_MIN_TOTAL_WIDTH;
    let (main_column, sidebar_area) = split_screen_columns(area, show_sidebar);

    let main_rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // header bar
            Constraint::Min(1),    // content box
            Constraint::Length(1), // status bar
        ])
        .split(main_column);

    draw_header(frame, session, main_rows[0]);
    draw_status(frame, session, main_rows[2]);

    let main_content = if show_sidebar {
        pad_main_column(main_rows[1], theme)
    } else {
        candy::padded_area(main_rows[1], theme)
    };
    let spacing = ui_spacing(main_content);

    if session.active_question.is_some() {
        draw_with_question(frame, session, main_content);
    } else if session.optional_picker_open {
        draw_with_optional_picker(frame, session, main_content);
    } else if session.focused_followup().is_some() {
        draw_with_followup(frame, session, main_content);
    } else {
        draw_chat(frame, session, main_content, spacing);
    }

    if let Some(sidebar) = sidebar_area {
        draw_sidebar(frame, session, sidebar);
    }

    draw_command_list_overlay(frame, session, area);
    draw_status_detail_overlay(frame, session, area);
    if session.instance_output_open {
        draw_instance_output_overlay(
            frame,
            area,
            session.captured_output.as_ref(),
            &session.theme,
        );
    }
    draw_help_overlay(frame, session, area);
    draw_leader_hint_overlay(frame, session, area);
}

/// Minimum total width required to host a docked right-hand sidebar column.
const SIDEBAR_MIN_TOTAL_WIDTH: u16 = 50;
/// Preferred sidebar column width.
const SIDEBAR_WIDTH: u16 = 30;

/// Split the full screen into a main column and an optional full-height
/// right-hand sidebar (top of screen to bottom).
fn split_screen_columns(area: Rect, show_sidebar: bool) -> (Rect, Option<Rect>) {
    if !show_sidebar {
        return (area, None);
    }

    let sidebar_w = SIDEBAR_WIDTH.min(area.width.saturating_sub(21));
    let cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Min(20), Constraint::Length(sidebar_w)])
        .spacing(1)
        .split(area);

    (cols[0], Some(cols[1]))
}

/// Pad the main content region when a sidebar is docked (left + vertical only).
fn pad_main_column(area: Rect, theme: &crate::theme::Theme) -> Rect {
    let h_pad = if area.width >= theme.layout.pad_width_min {
        1
    } else {
        0
    };
    let v_pad = if area.height >= theme.layout.pad_height_min {
        1
    } else {
        0
    };
    Rect {
        x: area.x.saturating_add(h_pad),
        y: area.y.saturating_add(v_pad),
        width: area.width.saturating_sub(h_pad),
        height: area.height.saturating_sub(v_pad.saturating_mul(2)),
    }
}

/// Normal chat layout inside the padded content box: transcript, hint,
/// quick-reply chips, optional pickers, and the composer.
fn draw_chat(
    frame: &mut Frame,
    session: &mut ChatSession,
    area: Rect,
    spacing: super::layout::UiSpacing,
) {
    // Compute the composer height from the editor's rendered line count plus
    // only the responsive padding/chrome around the input surface.
    let composer_inner_width = composer_text_width(area, &session.theme, spacing);
    let max_content_lines = (((area.height as f64) * 0.25).floor() as u16).clamp(1, 8) as usize;
    let view = render_editor(
        &session.editor,
        composer_inner_width,
        max_content_lines,
        false,
    );
    let composer_height = composer_surface_height(view.lines.len() as u16, &session.theme, spacing);

    // Optional completion picker height.
    let completion_rows = completion_max_visible_rows(area.height);
    let completion_lines = session
        .completion
        .as_ref()
        .map(|c| completion_picker_lines(c, completion_rows, spacing))
        .unwrap_or(0);

    // Optional file-search picker height.
    let filesearch_rows = filesearch_max_visible_rows(area.height);
    let filesearch_lines = session
        .filesearch
        .as_ref()
        .map(|fs| filesearch_picker_lines(fs, filesearch_rows, spacing))
        .unwrap_or(0);

    let show_chips = session.can_show_quick_replies();
    let chip_lines = if show_chips { 1u16 } else { 0 };

    let mut constraints = vec![
        Constraint::Min(3),    // transcript
        Constraint::Length(1), // hint
    ];
    if chip_lines > 0 {
        constraints.push(Constraint::Length(chip_lines));
    }
    if filesearch_lines > 0 {
        constraints.push(Constraint::Length(filesearch_lines));
    }
    if completion_lines > 0 {
        constraints.push(Constraint::Length(completion_lines));
    }
    constraints.push(Constraint::Length(composer_height)); // composer

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints(constraints)
        .spacing(spacing.gap)
        .split(area);

    session.hit_regions.transcript = chunks[0];
    draw_transcript(frame, session, chunks[0]);
    draw_hint(frame, session, chunks[1]);
    let mut next = 2;
    if chip_lines > 0 {
        draw_quick_replies(frame, session, chunks[next]);
        next += 1;
    }
    if filesearch_lines > 0 {
        if let Some(state) = session.filesearch.clone() {
            draw_filesearch_picker(frame, session, &state, chunks[next], filesearch_rows);
        }
        next += 1;
    }
    if completion_lines > 0 {
        if let Some(completion) = session.completion.clone() {
            draw_completion_picker(frame, session, &completion, completion_rows, chunks[next]);
        }
        next += 1;
    }
    session.hit_regions.composer = chunks[next];
    draw_composer(frame, session, chunks[next], view, spacing);
}

/// Fixed full-width header bar pinned to the top screen edge (candy #3).
pub(super) fn draw_header(frame: &mut Frame, session: &ChatSession, area: Rect) {
    let theme = &session.theme;
    let spacing = ui_spacing(area);
    let style = Style::default()
        .fg(theme.header.color.color())
        .bg(theme.header.background_color.color())
        .add_modifier(Modifier::BOLD);
    frame.render_widget(Block::default().style(style), area);
    let block = Block::default().padding(spacing.horizontal_padding());
    let inner = block.inner(area);
    let line = Line::from(Span::styled(
        format!("TokenRing{}{}", theme.layout.separator, session.agent.label),
        style,
    ));
    frame.render_widget(Paragraph::new(line), inner);
}

pub(super) fn draw_transcript(frame: &mut Frame, session: &mut ChatSession, area: Rect) {
    let theme = &session.theme;
    let spacing = ui_spacing(area);
    let block = surface_block(
        theme,
        theme.transcript.background_color,
        None,
        spacing.transcript_block_padding(),
    );
    let inner = block.inner(area);
    let inner_width = inner.width as usize;
    let streaming_idx = session.transcript.streaming_entry_index();
    let show_body_streaming_cursor = transcript_streaming_cursor(session);

    let mut lines: Vec<Line> = Vec::new();

    for (entry_idx, entry) in session.transcript.entries().iter().enumerate() {
        if !session.verbose && entry.kind.hidden_in_compact() {
            continue;
        }

        // Separate entries with a single blank line, but not before the
        // very first rendered entry.
        if spacing.gap > 0 && !lines.is_empty() {
            lines.push(Line::default());
        }

        let props = EntryRenderProps {
            entry,
            entry_idx,
            inner_width,
            theme,
            spacing,
            verbose: session.verbose,
            streaming_entry_idx: streaming_idx,
            spinner_tick: session.spinner_tick,
            show_body_streaming_cursor,
            streaming_reasoning: session.transcript.is_streaming_reasoning(),
        };
        let rendered = render_transcript_entry(&props);
        lines.extend(rendered.lines);
    }

    frame.render_widget(block, area);

    let visible_height = inner.height as usize;
    let total = lines.len();
    // While scrolled up, grow scroll-back with new tail lines so the viewport
    // stays pinned to the same historical content during streaming.
    if session.transcript_scroll_back > 0 && total > session.prev_transcript_line_count {
        let growth = total - session.prev_transcript_line_count;
        session.transcript_scroll_back = session.transcript_scroll_back.saturating_add(growth);
    }
    session.prev_transcript_line_count = total;
    let max_scroll = total.saturating_sub(visible_height);
    session.transcript_max_scroll_back = max_scroll;
    if session.transcript_scroll_back > max_scroll {
        session.transcript_scroll_back = max_scroll;
    }
    let scroll = max_scroll
        .saturating_sub(session.transcript_scroll_back)
        .min(max_scroll);

    frame.render_widget(Paragraph::new(lines).scroll((scroll as u16, 0)), inner);
}

/// Whether the active transcript stream should show the blinking cursor.
fn transcript_streaming_cursor(session: &ChatSession) -> bool {
    if session.transcript.is_streaming_chat() {
        return true;
    }
    session.verbose && session.transcript.is_streaming_reasoning()
}

pub(super) fn draw_hint(frame: &mut Frame, session: &ChatSession, area: Rect) {
    let line = session.hint_line(area.width as usize);
    frame.render_widget(Paragraph::new(line), area);
}

pub(super) fn draw_composer(
    frame: &mut Frame,
    session: &ChatSession,
    area: Rect,
    view: EditorView,
    spacing: super::layout::UiSpacing,
) {
    let theme = &session.theme;
    let lines: Vec<Line> = if view.is_empty {
        let placeholder = Line::from(vec![
            Span::raw(" "),
            Span::styled(
                "Write a message or /command",
                Style::default().fg(Tone::Muted.color(theme)),
            ),
        ]);
        vec![placeholder]
    } else {
        view.lines
            .iter()
            .map(|line| Line::from(Span::raw(line.clone())))
            .collect()
    };

    let stripe = stripe_color(theme, theme.composer.stripe_color);
    let block = surface_block(
        theme,
        theme.composer.background_color,
        stripe,
        spacing.block_padding(),
    );
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(lines), inner);

    if view.is_empty {
        frame.set_cursor_position((inner.x, inner.y));
        return;
    }
    let cursor_x = inner.x + view.cursor_column as u16;
    let cursor_y = inner.y + view.cursor_row as u16;
    frame.set_cursor_position((cursor_x, cursor_y));
}

pub(super) fn draw_status(frame: &mut Frame, session: &ChatSession, area: Rect) {
    let theme = &session.theme;
    let spacing = ui_spacing(area);
    let style = match theme.layout.status_style {
        crate::theme::StatusStyle::Flat => Style::default()
            .fg(theme.status.flat_text_color.color())
            .bg(theme.status.background_color.color()),
        crate::theme::StatusStyle::Inverted => Style::default()
            .fg(theme.status.inverted_text_color.color())
            .bg(theme.status.inverted_background_color.color()),
    };
    frame.render_widget(Block::default().style(style), area);
    let block = Block::default().padding(spacing.horizontal_padding());
    let inner = block.inner(area);
    let line = session.status_line(inner.width as usize);
    frame.render_widget(Paragraph::new(line).style(style), inner);
}

pub(super) fn draw_quick_replies(frame: &mut Frame, session: &ChatSession, area: Rect) {
    let chips = session.quick_reply_chips();
    let lines = candy::render_quick_reply_chips(chips, session.selected_chip, &session.theme);
    frame.render_widget(Paragraph::new(lines), area);
}

pub(super) fn draw_help_overlay(frame: &mut Frame, session: &ChatSession, area: Rect) {
    if !session.help_open {
        return;
    }
    let theme = &session.theme;
    let context = HelpContext::detect(
        session.active_question.is_some(),
        session.focused_followup().is_some(),
        session.optional_picker_open,
        session.filesearch.is_some(),
        session.completion.is_some(),
        session.transcript_scroll_back,
    );
    let lines = help::help_lines(context, &session.keybinds, theme);
    let block = Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .border_style(Style::default().fg(theme.help.border_color.color()))
        .style(Style::default().bg(theme.help.background_color.color()));
    let inner = block.inner(area);
    frame.render_widget(block, area);
    frame.render_widget(Paragraph::new(lines), inner);
}

/// Column/row layout for the leader-hint grid, computed from the entry
/// labels and the space available above the anchor (composer) row.
struct LeaderHintGrid {
    columns: usize,
    key_w: usize,
    desc_w: usize,
    /// Popup rect, positioned directly above `anchor` and clamped to `area`.
    overlay: Rect,
}

/// Lay `entries` out as a `columns`-wide grid that fits within `anchor`'s
/// width, then position the popup rect directly above `anchor` (clamped to
/// stay inside `area`). Pure/testable — no rendering.
fn leader_hint_grid(entries: &[(String, &str)], anchor: Rect, area: Rect) -> LeaderHintGrid {
    let key_w = entries
        .iter()
        .map(|(k, _)| k.chars().count())
        .max()
        .unwrap_or(1);
    let desc_w = entries
        .iter()
        .map(|(_, d)| d.chars().count())
        .max()
        .unwrap_or(1);
    let cell_w = key_w + 1 + desc_w + 3;

    let avail_width = anchor.width.max(cell_w as u16).saturating_sub(2).max(1) as usize;
    let columns = (avail_width / cell_w).clamp(1, entries.len().max(1));
    let rows = entries.len().max(1).div_ceil(columns);

    let height = (rows as u16 + 2).min(area.height.saturating_sub(1)).max(3);
    let width = ((columns * cell_w) as u16 + 2).min(area.width);
    let overlay = Rect {
        x: anchor.x,
        y: anchor.y.saturating_sub(height).max(area.y),
        width,
        height,
    };

    LeaderHintGrid {
        columns,
        key_w,
        desc_w,
        overlay,
    }
}

/// Which-key style popup listing every possible next keypress, shown directly
/// above the input box while a leader chord (`Ctrl+X …`) is pending.
fn draw_leader_hint_overlay(frame: &mut Frame, session: &ChatSession, area: Rect) {
    if session.leader_pending.is_none() {
        return;
    }
    let theme = &session.theme;
    let entries = help::leader_hint_entries(&session.keybinds, session.quick_reply_chips().len());
    if entries.is_empty() {
        return;
    }

    // Anchor directly above whichever composer is on screen this frame; fall
    // back to the full content area (e.g. a question/picker view with no
    // composer row) so the leader chord still gets visible feedback.
    let anchor = if session.hit_regions.composer.height > 0 {
        session.hit_regions.composer
    } else if let Some(followup) = session.hit_regions.followup_composer {
        followup
    } else {
        area
    };

    let grid = leader_hint_grid(&entries, anchor, area);

    let key_style = Style::default()
        .fg(theme.help.key_color.color())
        .add_modifier(Modifier::BOLD);
    let desc_style = Style::default().fg(theme.help.description_color.color());
    let (key_w, desc_w) = (grid.key_w, grid.desc_w);

    let rows = entries.len().div_ceil(grid.columns);
    let mut lines: Vec<Line> = Vec::with_capacity(rows);
    for row in 0..rows {
        let mut spans = Vec::new();
        for col in 0..grid.columns {
            let Some((k, d)) = entries.get(row * grid.columns + col) else {
                break;
            };
            spans.push(Span::styled(format!("{k:>key_w$}"), key_style));
            spans.push(Span::raw(" "));
            spans.push(Span::styled(format!("{d:<desc_w$}"), desc_style));
            spans.push(Span::raw("   "));
        }
        lines.push(Line::from(spans));
    }

    let block = Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .title(format!(" {} then… ", session.keybinds.leader_label()))
        .border_style(Style::default().fg(theme.help.border_color.color()))
        .style(Style::default().bg(theme.help.background_color.color()));
    let inner = block.inner(grid.overlay);
    frame.render_widget(block, grid.overlay);
    frame.render_widget(Paragraph::new(lines), inner);
}

fn draw_sidebar(frame: &mut Frame, session: &ChatSession, area: Rect) {
    if !session.todos.is_empty() {
        draw_todos_sidebar(frame, session, area);
    } else {
        draw_metrics_sidebar(frame, session, area);
    }
}

/// Flat Material sidebar surface: panel fill + optional accent stripe, no
/// floating framed box. Title is rendered as a heading line inside the surface.
fn sidebar_surface(frame: &mut Frame, theme: &crate::theme::Theme, area: Rect) -> Rect {
    let spacing = ui_spacing(area);
    let stripe = stripe_color(theme, theme.panel.stripe_color);
    let block = surface_block(
        theme,
        theme.panel.background_color,
        stripe,
        spacing.block_padding(),
    );
    let inner = block.inner(area);
    frame.render_widget(block, area);
    inner
}

fn sidebar_title_line(theme: &crate::theme::Theme, title: &str) -> Line<'static> {
    let prefix = theme.layout.header_prefix.clone();
    Line::from(Span::styled(
        format!("{prefix}{title}"),
        Style::default()
            .fg(theme.panel.heading_color.color())
            .add_modifier(Modifier::BOLD),
    ))
}

fn draw_todos_sidebar(frame: &mut Frame, session: &ChatSession, area: Rect) {
    use crate::tui::text::{fit_line, wrap_plain_text};
    use crate::tui::todos::TodoStatus;

    let theme = &session.theme;
    let inner = sidebar_surface(frame, theme, area);
    let todos = session.todos.get().unwrap_or_default();
    let completed = todos.completed_count();
    let total = todos.items.len();

    let width = inner.width as usize;
    let mut lines: Vec<Line<'static>> = vec![
        sidebar_title_line(theme, &format!("Todos  {completed}/{total}")),
        Line::from(Span::styled(
            fit_line(
                &format!("{}{completed} of {total} done", theme.layout.text_indent),
                width,
            ),
            Style::default().fg(Tone::Muted.color(theme)),
        )),
        Line::default(),
    ];

    // Prefer showing in-progress items first, then pending, then completed.
    let mut ordered: Vec<_> = todos.items.iter().collect();
    ordered.sort_by_key(|item| match item.status {
        TodoStatus::InProgress => 0,
        TodoStatus::Pending => 1,
        TodoStatus::Unknown => 2,
        TodoStatus::Completed => 3,
    });

    // Budget remaining height by wrapped lines (not by raw item count).
    let mut remaining_rows = inner
        .height
        .saturating_sub(lines.len() as u16)
        .saturating_sub(1) // reserve one row for a possible "+N more" footer
        as usize;
    let mut shown_items = 0usize;
    let total_items = ordered.len();

    for item in ordered {
        if remaining_rows == 0 {
            break;
        }

        let marker = item.status.marker();
        let style = match item.status {
            TodoStatus::InProgress => Style::default()
                .fg(Tone::Info.color(theme))
                .add_modifier(Modifier::BOLD),
            TodoStatus::Completed => Style::default().fg(Tone::Muted.color(theme)),
            TodoStatus::Pending | TodoStatus::Unknown => {
                Style::default().fg(Tone::Chat.color(theme))
            }
        };

        // Wrap content to the columns after the marker; hang-indent
        // continuations so they align under the first content character.
        let prefix = format!("{marker} ");
        let prefix_width = crate::tui::text::visible_len(&prefix).min(width.saturating_sub(1));
        let content_width = width.saturating_sub(prefix_width).max(1);
        let indent = " ".repeat(prefix_width);
        let wrapped = wrap_plain_text(&item.content, content_width);
        if wrapped.is_empty() || remaining_rows == 0 {
            break;
        }

        // If this item needs more rows than remain, still show a partial wrap
        // so long todos are not dropped entirely.
        let take = wrapped.len().min(remaining_rows);
        for (i, row) in wrapped.into_iter().take(take).enumerate() {
            let text = if i == 0 {
                format!("{prefix}{row}")
            } else {
                format!("{indent}{row}")
            };
            lines.push(Line::from(Span::styled(text, style)));
            remaining_rows = remaining_rows.saturating_sub(1);
        }
        shown_items += 1;
    }

    if shown_items < total_items {
        let remaining = total_items - shown_items;
        lines.push(Line::from(Span::styled(
            fit_line(&format!("+{remaining} more"), width),
            Style::default().fg(Tone::Muted.color(theme)),
        )));
    }

    frame.render_widget(Paragraph::new(lines), inner);
}

fn draw_metrics_sidebar(frame: &mut Frame, session: &ChatSession, area: Rect) {
    use crate::tui::text::fit_line;

    let theme = &session.theme;
    let inner = sidebar_surface(frame, theme, area);
    let metrics = session.metrics.get().unwrap_or_default();
    let indent = &theme.layout.text_indent;
    let width = inner.width as usize;

    let mut lines: Vec<Line<'static>> = vec![sidebar_title_line(theme, "Metrics"), Line::default()];

    let rows: [(&str, String); 8] = [
        (
            "Model",
            metrics.model.clone().unwrap_or_else(|| "(none)".into()),
        ),
        ("Tools", metrics.tools.to_string()),
        (
            "Context",
            metrics
                .context_percent_left
                .map(|p| format!("{p}% left"))
                .unwrap_or_else(|| "--".into()),
        ),
        ("Tokens", metrics.tokens.to_string()),
        ("Cost", format!("{:.4}", metrics.cost)),
        (
            "RPC",
            metrics
                .rpc_latency_ms
                .map(|ms| format!("{ms}ms"))
                .unwrap_or_else(|| "--".into()),
        ),
        ("Agent", session.agent.label.clone()),
        ("Theme", session.theme_name.clone()),
    ];

    for (label, value) in rows {
        lines.push(Line::from(Span::styled(
            fit_line(&format!("{indent}{label}"), width),
            Style::default().fg(Tone::Muted.color(theme)),
        )));
        lines.push(Line::from(Span::styled(
            fit_line(&format!("{indent}{value}"), width),
            Style::default().fg(Tone::Chat.color(theme)),
        )));
    }

    frame.render_widget(Paragraph::new(lines), inner);
}

fn draw_command_list_overlay(frame: &mut Frame, session: &ChatSession, area: Rect) {
    if !session.command_list_open {
        return;
    }
    let theme = &session.theme;
    let height = (session.commands.len() as u16 + 3)
        .min(area.height.saturating_sub(2))
        .max(5);
    let width = area.width.saturating_sub(4).min(60).max(20);
    let overlay = Rect {
        x: area.x + (area.width.saturating_sub(width)) / 2,
        y: area.y + (area.height.saturating_sub(height)) / 2,
        width,
        height,
    };
    let block = Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .title(" Commands · Enter insert · Esc close ")
        .border_style(Style::default().fg(theme.help.border_color.color()))
        .style(Style::default().bg(theme.help.background_color.color()));
    let inner = block.inner(overlay);
    frame.render_widget(block, overlay);
    let visible = inner.height as usize;
    let start = session
        .command_list_index
        .saturating_sub(visible.saturating_sub(1) / 2)
        .min(session.commands.len().saturating_sub(visible));
    let mut lines = Vec::new();
    for (i, cmd) in session
        .commands
        .iter()
        .enumerate()
        .skip(start)
        .take(visible)
    {
        let selected = i == session.command_list_index;
        let prefix = if selected { "▸ " } else { "  " };
        let style = if selected {
            Style::default()
                .fg(Tone::Info.color(theme))
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(Tone::Muted.color(theme))
        };
        let desc = if cmd.description.is_empty() {
            String::new()
        } else {
            format!(" — {}", cmd.description)
        };
        lines.push(Line::from(Span::styled(
            format!("{prefix}/{}{desc}", cmd.name),
            style,
        )));
    }
    frame.render_widget(Paragraph::new(lines), inner);
}

fn draw_status_detail_overlay(frame: &mut Frame, session: &ChatSession, area: Rect) {
    if !session.status_detail_open {
        return;
    }
    let theme = &session.theme;
    let metrics = session.metrics.get().unwrap_or_default();
    let height = 12u16.min(area.height.saturating_sub(2)).max(8);
    let width = area.width.saturating_sub(6).min(72).max(30);
    let overlay = Rect {
        x: area.x + (area.width.saturating_sub(width)) / 2,
        y: area.y + (area.height.saturating_sub(height)) / 2,
        width,
        height,
    };
    let block = Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .title(" Status · Esc close ")
        .border_style(Style::default().fg(theme.help.border_color.color()))
        .style(Style::default().bg(theme.help.background_color.color()));
    let inner = block.inner(overlay);
    frame.render_widget(block, overlay);
    let lines = vec![
        Line::from(format!("Activity: {}", session.execution.activity)),
        Line::from(format!(
            "Running: {} (queue={} exec={})",
            session.execution.running,
            session.execution.queue_busy,
            session.execution.execution_busy
        )),
        Line::from(format!("Stream: {:?}", session.stream_health())),
        Line::from(format!(
            "Agent: {} ({})",
            session.agent.label, session.agent.id
        )),
        Line::from(format!(
            "Model: {}",
            metrics.model.as_deref().unwrap_or("(none)")
        )),
        Line::from(format!(
            "Context left: {}",
            metrics
                .context_percent_left
                .map(|p| format!("{p}%"))
                .unwrap_or_else(|| "--".into())
        )),
        Line::from(format!(
            "Tokens {} · tools {} · cost {:.4}",
            metrics.tokens, metrics.tools, metrics.cost
        )),
        Line::from(format!("Cwd: {}", session.working_directory)),
        Line::from(format!("Theme: {}", session.theme_name)),
        Line::from("Leader: copy=y  sidebar=b  status=s  theme=S-t  delete=d"),
    ];
    frame.render_widget(
        Paragraph::new(lines).style(Style::default().fg(Tone::Muted.color(theme))),
        inner,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthetic entries with a stable 2-char key width (`"0"`..`"19"`) so
    /// the layout math in tests is easy to hand-verify.
    fn entries(n: usize) -> Vec<(String, &'static str)> {
        (0..n).map(|i| (i.to_string(), "Some action")).collect()
    }

    #[test]
    fn grid_fits_columns_to_anchor_width() {
        let area = Rect::new(0, 0, 100, 40);
        let anchor = Rect::new(2, 30, 90, 3);
        let grid = leader_hint_grid(&entries(20), anchor, area);
        // Each cell is `key_w(2) + 1 + desc_w(11) + 3` = 17 wide; 90-2=88
        // available, so 5 columns fit (88 / 17 = 5).
        assert_eq!(grid.columns, 5);
        assert_eq!(grid.key_w, 2);
        assert_eq!(grid.desc_w, 11);
    }

    #[test]
    fn grid_positions_above_anchor_and_clamps_to_area_top() {
        let area = Rect::new(0, 0, 100, 40);
        let anchor = Rect::new(0, 35, 100, 3);
        let grid = leader_hint_grid(&entries(3), anchor, area);
        assert!(grid.overlay.y < anchor.y);
        assert!(grid.overlay.y >= area.y);

        // A very tall entry list would push the overlay above the screen;
        // it must clamp to the area's top edge instead of underflowing.
        let anchor_near_top = Rect::new(0, 2, 100, 3);
        let grid = leader_hint_grid(&entries(50), anchor_near_top, area);
        assert_eq!(grid.overlay.y, area.y);
    }

    #[test]
    fn grid_never_reports_zero_columns_even_in_a_narrow_anchor() {
        let area = Rect::new(0, 0, 40, 10);
        let anchor = Rect::new(0, 8, 5, 1); // narrower than a single cell
        let grid = leader_hint_grid(&entries(9), anchor, area);
        assert!(grid.columns >= 1);
        assert!(grid.overlay.height >= 3);
    }

    #[test]
    fn grid_handles_a_single_entry() {
        let area = Rect::new(0, 0, 60, 20);
        let anchor = Rect::new(0, 15, 60, 3);
        let grid = leader_hint_grid(&entries(1), anchor, area);
        assert_eq!(grid.columns, 1);
    }
}
