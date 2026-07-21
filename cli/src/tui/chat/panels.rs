//! Full-viewport panels that take over the composer region: the focused
//! question panel (text/tree/file/form/confirm), the optional-questions picker
//! (Alt+Q), and the follow-up composer.

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::models::Interaction;
use crate::theme::Tone;
use crate::tui::candy;
use crate::tui::editor::render_editor;
use crate::tui::ui_layout::PickerHitRegion;

use super::interactions::{ActiveQuestion, ActiveSession};
use super::layout::{
    composer_surface_height, composer_text_width, stripe_color, surface_block, truncate, ui_spacing,
};
use super::render::{draw_quick_replies, draw_transcript};
use super::ChatSession;

pub(super) fn draw_with_question(frame: &mut Frame, session: &mut ChatSession, area: Rect) {
    let theme = session.theme.clone();
    let spacing = ui_spacing(area);
    let width = area.width as usize;
    // Budget rows for tree/form viewports: full area minus transcript min, status,
    // title chrome, and gaps — not the entire terminal height.
    let rows = area.height.saturating_sub(8).max(8) as usize;

    // Render the active session into lines (capped to available footer height).
    let lines: Vec<(String, Tone)> = match session.active_question.as_ref() {
        Some(ActiveQuestion {
            session: ActiveSession::Text(s),
            ..
        }) => s.render(width, &theme),
        Some(ActiveQuestion {
            session: ActiveSession::Confirm(s),
            ..
        }) => s.render(width, &theme),
        Some(ActiveQuestion {
            session: ActiveSession::Tree(s),
            ..
        }) => s.render(width, rows, &theme),
        Some(ActiveQuestion {
            session: ActiveSession::File(s),
            ..
        }) => s.render(width, &theme),
        Some(ActiveQuestion {
            session: ActiveSession::Form(s),
            ..
        }) => s.render(width, rows, &theme),
        None => Vec::new(),
    };

    // +1 for the "Question" title line prepended at render time.
    let block_height = (lines.len() as u16 + spacing.pad_v.saturating_mul(2) + 2)
    .clamp(3, area.height.saturating_sub(4));
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(3),
            Constraint::Length(block_height),
        ])
        .spacing(spacing.gap)
        .split(area);

    session.hit_regions.transcript = chunks[0];
    draw_transcript(frame, session, chunks[0]);

    let stripe = stripe_color(&theme, theme.panel.stripe_color);
    let block = surface_block(
        &theme,
        theme.composer.background_color,
        stripe,
        ui_spacing(chunks[1]).block_padding(),
    );
    let inner = block.inner(chunks[1]);
    frame.render_widget(block, chunks[1]);
    candy::render_ascii_shadow(frame, chunks[1], &theme);

    let mut body: Vec<Line> = lines
        .into_iter()
        .map(|(text, tone)| Line::from(Span::styled(text, Style::default().fg(tone.color(&theme)))))
        .collect();

    // Surface the server-side auto-submit deadline as a live countdown.
    if let Some(aq) = session.active_question.as_ref() {
        if let Some(ts) = aq.auto_submit_at {
            if let Some(cd) = candy::auto_submit_countdown(ts) {
                body.push(Line::from(Span::styled(
                    format!("auto-submit in {cd}"),
                    Style::default()
                        .fg(theme.panel.warning_color.color())
                        .add_modifier(Modifier::BOLD),
                )));
            }
        }
    }
    frame.render_widget(Paragraph::new(body), inner);

    // Position the terminal cursor for text/form questions.
    if let Some(aq) = session.active_question.as_ref() {
        if let Some((row, col)) = aq.session.cursor(width) {
            let x = inner.x.saturating_add(col as u16);
            let y = inner.y.saturating_add(1 + row as u16);
            frame.set_cursor_position((x, y));
        }
    }
}

pub(super) fn draw_with_optional_picker(frame: &mut Frame, session: &mut ChatSession, area: Rect) {
    let theme = session.theme.clone();
    let spacing = ui_spacing(area);
    let count = session.optional_questions().len();
    let height = (count as u16 + 3 + spacing.pad_v.saturating_mul(2))
    .clamp(4, area.height.saturating_sub(4));
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(3),
            Constraint::Length(height),
        ])
        .spacing(spacing.gap)
        .split(area);

    session.hit_regions.transcript = chunks[0];
    draw_transcript(frame, session, chunks[0]);

    let stripe = stripe_color(&theme, theme.panel.stripe_color);
    let block = surface_block(
        &theme,
        theme.panel.background_color,
        stripe,
        ui_spacing(chunks[1]).block_padding(),
    );
    let inner = block.inner(chunks[1]);
    frame.render_widget(block, chunks[1]);

    let header_prefix = &theme.layout.header_prefix;
    let text_indent = &theme.layout.text_indent;
    let title = Line::from(Span::styled(
        format!("{header_prefix}Optional Questions"),
        Style::default()
            .fg(theme.panel.heading_color.color())
            .add_modifier(Modifier::BOLD),
    ));
    let mut lines: Vec<Line> = vec![
        title,
        Line::from(Span::styled(
            format!("{text_indent}{count} available"),
            Style::default().fg(Tone::Info.color(&theme)),
        )),
    ];
    let max_visible = (inner.height as usize).saturating_sub(2);
    let window_start = session
        .optional_index
        .saturating_sub(max_visible.saturating_sub(1))
        .min(count.saturating_sub(max_visible));
    let visible_count = count.saturating_sub(window_start).min(max_visible);
    session.hit_regions.optional_picker = Some(PickerHitRegion {
        area: inner,
        window_start,
        row_count: visible_count,
        header_rows: 2,
    });
    let optionals = session.optional_questions();
    for (i, interaction) in optionals
        .iter()
        .enumerate()
        .skip(window_start)
        .take(max_visible)
    {
        let (label, urgent, countdown) = match interaction {
            Interaction::Question {
                question,
                auto_submit_at,
                ..
            } => {
                let countdown = auto_submit_at.and_then(candy::auto_submit_countdown);
                let urgent = countdown.is_some();
                (question.label().to_string(), urgent, countdown)
            }
            _ => (String::new(), false, None),
        };
        let selected = i == session.optional_index;
        let marker = if selected { "›" } else { " " };
        let style = if selected {
            Style::default()
                .fg(theme.picker.highlighted_color.color())
                .bg(theme.picker.chip_background_color.color())
        } else if urgent {
            Style::default().fg(theme.panel.warning_color.color())
        } else {
            Style::default().fg(theme.picker.item_text_color.color())
        };
        if let Some(cd) = countdown {
            let avail = inner.width as usize;
            let label_part = truncate(
                &format!("{marker} {label}"),
                avail.saturating_sub(cd.len() + 2),
            );
            lines.push(Line::from(vec![
                Span::styled(label_part, style),
                Span::styled(
                    format!(" {:>w$}", cd, w = cd.len()),
                    Style::default()
                        .fg(theme.panel.warning_color.color())
                        .add_modifier(Modifier::BOLD),
                ),
            ]));
        } else {
            lines.push(Line::from(Span::styled(format!("{marker} {label}"), style)));
        }
    }
    frame.render_widget(Paragraph::new(lines), inner);
}

pub(super) fn draw_with_followup(frame: &mut Frame, session: &mut ChatSession, area: Rect) {
    let theme = session.theme.clone();
    let spacing = ui_spacing(area);
    let message = session
        .focused_followup()
        .and_then(|i| match i {
            Interaction::Followup { message, .. } => Some(message.clone()),
            _ => None,
        })
        .unwrap_or_default();

    let composer_inner_width = composer_text_width(area, &theme, spacing);
    let max_content_lines = (((area.height as f64) * 0.25).floor() as u16).clamp(1, 8) as usize;
    let view = render_editor(
        &session.followup_editor,
        composer_inner_width,
        max_content_lines,
        false,
    );
    let show_chips = session.can_show_followup_quick_replies();
    let chip_lines = if show_chips { 1u16 } else { 0 };

    let header_prefix = &theme.layout.header_prefix;
    let text_indent = &theme.layout.text_indent;

    // Follow-up label + composer.
    let mut composer_lines: Vec<Line> = Vec::new();
    let label = Span::styled(
        format!("{header_prefix}Follow-up"),
        Style::default()
            .fg(theme.panel.heading_color.color())
            .add_modifier(Modifier::BOLD),
    );
    composer_lines.push(Line::from(label));
    for l in crate::tui::text::wrap_plain_text(&message, composer_inner_width) {
        composer_lines.push(Line::from(Span::styled(
            format!("{text_indent}{l}"),
            Style::default().fg(Tone::Muted.color(&theme)),
        )));
    }
    if view.is_empty {
        composer_lines.push(Line::from(Span::styled(
            "Reply to continue the current run",
            Style::default().fg(Tone::Muted.color(&theme)),
        )));
    } else {
        for line in &view.lines {
            composer_lines.push(Line::from(Span::styled(
                line.clone(),
                Style::default().fg(Tone::Input.color(&theme)),
            )));
        }
    }
    let composer_height = composer_surface_height(composer_lines.len() as u16, &theme, spacing);

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(3),                  // transcript
            Constraint::Length(1),               // hint
            Constraint::Length(chip_lines),      // quick-reply chips
            Constraint::Length(composer_height), // followup composer
        ])
        .spacing(spacing.gap)
        .split(area);

    session.hit_regions.transcript = chunks[0];
    draw_transcript(frame, session, chunks[0]);
    frame.render_widget(
        Paragraph::new(truncate(
            &format!(
                "Follow-up ready · {} send  {} newline  Esc cancel",
                session
                    .keybinds
                    .input_submit
                    .direct
                    .first()
                    .map(|b| b.label())
                    .unwrap_or_else(|| "Ret".to_string()),
                session
                    .keybinds
                    .input_newline
                    .direct
                    .first()
                    .map(|b| b.label())
                    .unwrap_or_else(|| "S-Ret".to_string()),
            ),
            chunks[1].width as usize,
        ))
        .style(Style::default().fg(Tone::Info.color(&theme))),
        chunks[1],
    );

    if chip_lines > 0 {
        draw_quick_replies(frame, session, chunks[2]);
    }

    let stripe = stripe_color(&theme, theme.panel.stripe_color);
    let composer_chunk = if chip_lines > 0 { chunks[3] } else { chunks[2] };
    let block = surface_block(&theme, theme.composer.background_color, stripe, spacing.block_padding());
    session.hit_regions.followup_composer = Some(composer_chunk);
    let inner = block.inner(composer_chunk);
    frame.render_widget(block, composer_chunk);
    candy::render_ascii_shadow(frame, composer_chunk, &theme);
    frame.render_widget(Paragraph::new(composer_lines), inner);
    let editor_start = 1 + crate::tui::text::wrap_plain_text(&message, composer_inner_width).len();
    if view.is_empty {
        frame.set_cursor_position((inner.x, inner.y + editor_start as u16));
    } else {
        frame.set_cursor_position((
            inner.x + view.cursor_column as u16,
            inner.y + editor_start as u16 + view.cursor_row as u16,
        ));
    }
}
