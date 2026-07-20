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

use crate::tui::ui_layout::UiHitRegions;

use super::layout::{composer_surface_height, composer_text_width, stripe_color, surface_block, ui_spacing};
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
        let msg = "Terminal too small. Resize to at least 40x10.";
        frame.render_widget(
            Paragraph::new(msg).style(Style::default().fg(Tone::Warning.color(theme))),
            area,
        );
        return;
    }

    // Full-width header and status bars pin to the screen edges; only the
    // content box between them receives the candy edge padding (candy #3).
    let outer = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // header bar
            Constraint::Min(1),    // content box
            Constraint::Length(1), // status bar
        ])
        .split(area);
    let header_area = outer[0];
    let status_area = outer[2];
    let content = candy::padded_area(outer[1], theme);
    let spacing = ui_spacing(content);

    draw_header(frame, session, header_area);
    draw_status(frame, session, status_area);

    // Full-viewport panels take over the content box.
    if session.active_question.is_some() {
        draw_with_question(frame, session, content);
    } else if session.optional_picker_open {
        draw_with_optional_picker(frame, session, content);
    } else if session.focused_followup().is_some() {
        draw_with_followup(frame, session, content);
    } else {
        draw_chat(frame, session, content, spacing);
    }

    draw_help_overlay(frame, session, area);
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
    let block = surface_block(theme, theme.transcript.background_color, None, spacing.transcript_block_padding());
    let inner = block.inner(area);
    let inner_width = inner.width as usize;
    let streaming_idx = session.transcript.streaming_entry_index();
    let show_body_streaming_cursor = transcript_streaming_cursor(session);

    let mut lines: Vec<Line> = Vec::new();
    let mut line_sources: Vec<Option<usize>> = Vec::new();
    let mut viewport_collapsible_tools: Vec<usize> = Vec::new();

    for (entry_idx, entry) in session.transcript.entries().iter().enumerate() {
        if !session.verbose && entry.kind.hidden_in_compact() {
            continue;
        }

        // Separate entries with a single blank line, but not before the
        // very first rendered entry.
        if spacing.gap > 0 && !lines.is_empty() {
            lines.push(Line::default());
            line_sources.push(None);
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
            tool_expanded: session.expanded_tool_entries.contains(&entry_idx),
            show_body_streaming_cursor,
            streaming_reasoning: session.transcript.is_streaming_reasoning(),
        };
        let rendered = render_transcript_entry(&props);
        if rendered.collapsible_tool {
            viewport_collapsible_tools.push(entry_idx);
        }
        for _ in &rendered.lines {
            line_sources.push(Some(entry_idx));
        }
        lines.extend(rendered.lines);
    }

    frame.render_widget(block, area);

    let visible_height = inner.height as usize;
    let total = lines.len();
    let max_scroll = total.saturating_sub(visible_height);
    session.transcript_max_scroll_back = max_scroll;
    if session.transcript_scroll_back > max_scroll {
        session.transcript_scroll_back = max_scroll;
    }
    let scroll = max_scroll
        .saturating_sub(session.transcript_scroll_back)
        .min(max_scroll);

    let visible_end = (scroll + visible_height).min(total);
    session.viewport_collapsible_tool_index = viewport_collapsible_tools.into_iter().find(|entry_idx| {
        line_sources[scroll..visible_end]
            .iter()
            .any(|source| *source == Some(*entry_idx))
    });

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
    let block = surface_block(theme, theme.composer.background_color, stripe, spacing.block_padding());
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


