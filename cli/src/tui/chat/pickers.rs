//! The dropdown pickers that float above the composer: slash-command
//! completion and `@` workspace file-search. Each picker reports its required
//! height via a pure helper and registers its viewport with the mouse
//! hit-region map.

use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::theme::Tone;
use crate::tui::candy;
use crate::tui::{completion, filesearch};
use crate::tui::text::shorten_path;
use crate::tui::ui_layout::PickerHitRegion;

use super::layout::{surface_block, truncate, ui_spacing, UiSpacing};
use super::ChatSession;

/// Maximum number of result rows a file-search picker ever shows, derived
/// from the terminal height. Used by both the sizer and the renderer so the
/// reserved height always matches the rendered window.
pub(super) fn filesearch_max_visible_rows(terminal_height: u16) -> u16 {
    terminal_height.saturating_sub(16).clamp(3, 6)
}

/// Number of lines the file-search picker occupies.
pub(super) fn filesearch_picker_lines(
    state: &filesearch::FileSearchState,
    max_rows: u16,
    spacing: UiSpacing,
) -> u16 {
    let items = if state.loading {
        0
    } else {
        (state.matches.len() as u16).min(max_rows)
    };
    // title + cwd + status/items
    3 + items
        + if state.loading || state.matches.is_empty() {
            0
        } else {
            1
        }
        + spacing.pad_v.saturating_mul(2)
}

pub(super) fn draw_filesearch_picker(
    frame: &mut Frame,
    session: &mut ChatSession,
    state: &filesearch::FileSearchState,
    area: Rect,
    max_rows: u16,
) {
    let theme = &session.theme;
    let spacing = ui_spacing(area);
    let block = surface_block(theme, theme.picker.background_color, None, spacing.block_padding());
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let title_color = theme.picker.title_color.color();
    let header_prefix = &theme.layout.header_prefix;
    let text_indent = &theme.layout.text_indent;
    let chip_bg = theme.picker.chip_background_color.color();
    let chip_border = theme.picker.chip_border_color.color();
    let mut lines: Vec<Line> = Vec::new();

    lines.push(Line::from(Span::styled(
        format!("{header_prefix}Workspace Files"),
        Style::default()
            .fg(title_color)
            .add_modifier(Modifier::BOLD)
            .bg(chip_bg),
    )));
    lines.push(Line::from(Span::styled(
        format!(
            "{text_indent}{}",
            shorten_path(&session.working_directory, session.home.as_deref())
        ),
        Style::default().fg(Tone::Muted.color(theme)),
    )));

    if state.loading {
        lines.push(Line::from(Span::styled(
            format!("{text_indent}Indexing workspace files..."),
            Style::default().fg(Tone::Info.color(theme)),
        )));
        frame.render_widget(Paragraph::new(lines), inner);
        return;
    }

    if let Some(error) = &state.error {
        lines.push(Line::from(Span::styled(
            format!("{text_indent}{error}"),
            Style::default().fg(Tone::Warning.color(theme)),
        )));
        frame.render_widget(Paragraph::new(lines), inner);
        return;
    }

    if state.matches.is_empty() {
        lines.push(Line::from(Span::styled(
            format!("{text_indent}No matches for @{}", state.token.query),
            Style::default().fg(Tone::Muted.color(theme)),
        )));
        frame.render_widget(Paragraph::new(lines), inner);
        return;
    }

    lines.push(Line::from(Span::styled(
        format!(
            "{text_indent}{} matches · {} indexed",
            state.matches.len(),
            state.indexed_count
        ),
        Style::default().fg(Tone::Muted.color(theme)),
    )));

    let max_visible = max_rows as usize;
    let window_start = state
        .selected_index
        .saturating_sub(max_visible - 1)
        .min(state.matches.len().saturating_sub(max_visible));
    let visible_count = state
        .matches
        .len()
        .saturating_sub(window_start)
        .min(max_visible);
    session.hit_regions.filesearch = Some(PickerHitRegion {
        area: inner,
        window_start,
        row_count: visible_count,
        header_rows: 3,
    });
    for (i, path) in state
        .matches
        .iter()
        .enumerate()
        .skip(window_start)
        .take(max_visible)
    {
        let selected = i == state.selected_index;
        let marker = if selected { "›" } else { " " };
        let style = if selected {
            Style::default()
                .fg(theme.picker.highlighted_color.color())
                .bg(chip_bg)
        } else {
            Style::default().fg(theme.picker.item_text_color.color())
        };
        let _ = chip_border;
        let mut path_line = candy::highlight_path_match(path, &state.token.query, theme, selected);
        path_line
            .spans
            .insert(0, Span::styled(format!("{marker} "), style));
        lines.push(path_line);
    }

    frame.render_widget(Paragraph::new(lines), inner);
}

/// Number of lines the completion picker occupies (port of
/// `renderCommandCompletionPicker` height).
pub(super) fn completion_picker_lines(
    state: &completion::CompletionState,
    max_rows: u16,
    spacing: UiSpacing,
) -> u16 {
    if state.matches.is_empty() {
        return 2 + spacing.pad_v.saturating_mul(2); // title + "No matches for /query"
    }
    let items = (state.matches.len() as u16).min(max_rows);
    2 + items + spacing.pad_v.saturating_mul(2)
}

/// Maximum number of result rows a completion picker ever shows, derived from
/// the terminal height. Shared by the sizer and the renderer.
pub(super) fn completion_max_visible_rows(terminal_height: u16) -> u16 {
    terminal_height.saturating_sub(12).clamp(3, 8)
}

pub(super) fn draw_completion_picker(
    frame: &mut Frame,
    session: &mut ChatSession,
    state: &completion::CompletionState,
    max_rows: u16,
    area: Rect,
) {
    let theme = &session.theme;
    let spacing = ui_spacing(area);
    let block = surface_block(theme, theme.picker.background_color, None, spacing.block_padding());
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let title_color = theme.picker.title_color.color();
    let header_prefix = &theme.layout.header_prefix;
    let text_indent = &theme.layout.text_indent;
    let chip_bg = theme.picker.chip_background_color.color();
    let mut lines: Vec<Line> = Vec::new();

    let header = Line::from(Span::styled(
        format!("{header_prefix}Commands"),
        Style::default()
            .fg(title_color)
            .add_modifier(Modifier::BOLD)
            .bg(chip_bg),
    ));

    if state.matches.is_empty() {
        lines.push(Line::from(Span::styled(
            format!("{text_indent}No matches for /{}", state.source_query),
            Style::default().fg(Tone::Muted.color(theme)),
        )));
        let mut all = vec![header];
        all.extend(lines);
        frame.render_widget(Paragraph::new(all), inner);
        return;
    }

    lines.push(header);
    let max_visible = max_rows as usize;
    let window_start = state
        .selected_index
        .saturating_sub(max_visible - 1)
        .min(state.matches.len().saturating_sub(max_visible));
    let visible_count = state
        .matches
        .len()
        .saturating_sub(window_start)
        .min(max_visible);
    let visible_end = window_start + visible_count;
    let above = if window_start > 0 { "↑ " } else { "" };
    let below = if visible_end < state.matches.len() {
        " ↓"
    } else {
        ""
    };
    lines.push(Line::from(Span::styled(
        format!(
            "{text_indent}{above}{}-{} of {} matches{below}",
            window_start + 1,
            visible_end,
            state.matches.len()
        ),
        Style::default().fg(Tone::Info.color(theme)),
    )));

    session.hit_regions.completion = Some(PickerHitRegion {
        area: inner,
        window_start,
        row_count: visible_count,
        header_rows: 2,
    });
    let command_col_width = state
        .matches
        .iter()
        .skip(window_start)
        .take(max_visible)
        .map(|cmd| cmd.name.chars().count() + 1)
        .max()
        .unwrap_or(0)
        .min(34);

    for (i, cmd) in state
        .matches
        .iter()
        .enumerate()
        .skip(window_start)
        .take(max_visible)
    {
        let selected = i == state.selected_index;
        let marker = if selected { "›" } else { " " };
        let style = if selected {
            Style::default()
                .fg(theme.picker.highlighted_color.color())
                .bg(chip_bg)
        } else {
            Style::default().fg(theme.picker.item_text_color.color())
        };
        let cmd_style = if inner.width >= 80 {
            let mut s = Style::default()
                .fg(theme.picker.match_highlight_color.color())
                .add_modifier(if selected {
                    Modifier::BOLD
                } else {
                    Modifier::empty()
                });
            if selected {
                s = s.bg(chip_bg);
            }
            s
        } else {
            style
        };
        if cmd.description.is_empty() || inner.width < 80 {
            lines.push(Line::from(Span::styled(
                format!("{marker} /{}", cmd.name),
                cmd_style,
            )));
        } else {
            let command = format!("/{}", cmd.name);
            let command = if command.chars().count() > command_col_width {
                truncate(&command, command_col_width)
            } else {
                format!("{command:<command_col_width$}")
            };
            lines.push(Line::from(vec![
                Span::styled(format!("{marker} {command}"), cmd_style),
                Span::styled(
                    format!("  {}", cmd.description),
                    Style::default().fg(theme.picker.item_text_color.color()),
                ),
            ]));
        }
    }

    frame.render_widget(Paragraph::new(lines), inner);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completion_visible_rows_clamps_to_terminal() {
        assert_eq!(completion_max_visible_rows(10), 3);
        assert_eq!(completion_max_visible_rows(20), 8);
        assert_eq!(completion_max_visible_rows(16), 4);
    }
}
