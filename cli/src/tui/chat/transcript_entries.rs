//! Per-entry-kind transcript line builders used by [`super::render::draw_transcript`].

use ratatui::{
    style::{Modifier, Style},
    text::{Line, Span},
};

use crate::theme::Theme;
use crate::tui::candy;
use crate::tui::diff;
use crate::tui::markdown;
use crate::tui::text::{trim_boundary_newlines, visible_len, wrap_plain_text};
use crate::tui::transcript::{EntryKind, TranscriptEntry};

use super::layout::UiSpacing;

/// Shared context passed to each entry-kind renderer.
pub(super) struct EntryRenderProps<'a> {
    pub entry: &'a TranscriptEntry,
    pub entry_idx: usize,
    pub inner_width: usize,
    pub theme: &'a Theme,
    pub spacing: UiSpacing,
    pub verbose: bool,
    pub streaming_entry_idx: Option<usize>,
    pub spinner_tick: usize,
    pub tool_expanded: bool,
    pub show_body_streaming_cursor: bool,
    pub streaming_reasoning: bool,
}

/// Lines produced for one transcript entry, plus tool-collapse metadata.
pub(super) struct RenderedEntry {
    pub lines: Vec<Line<'static>>,
    pub collapsible_tool: bool,
}

pub(super) fn render_transcript_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    match props.entry.kind {
        EntryKind::Input => render_input_entry(props),
        EntryKind::Reasoning => render_reasoning_entry(props),
        EntryKind::ToolCall => render_tool_call_entry(props),
        EntryKind::Artifact => render_artifact_entry(props),
        EntryKind::Chat => render_chat_entry(props),
        EntryKind::System => render_system_entry(props),
        EntryKind::Info => render_info_entry(props),
        EntryKind::Warning => render_warning_entry(props),
        EntryKind::Error => render_error_entry(props),
        EntryKind::Response => render_response_entry(props),
        EntryKind::Interaction => render_interaction_entry(props),
    }
}

fn render_input_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    RenderedEntry {
        lines: render_input_surface_lines(
            props.entry,
            props.inner_width,
            props.theme,
            props.spacing,
        ),
        collapsible_tool: false,
    }
}

fn render_reasoning_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    let mut lines = Vec::new();
    if let Some(header) = render_entry_header(props, false, title_streaming_cursor(props)) {
        lines.push(header);
    }
    if props.verbose {
        lines.push(Line::default());
        lines.extend(render_body_lines(props, entry_body_source(props)));
    }
    RenderedEntry {
        lines,
        collapsible_tool: false,
    }
}

fn render_tool_call_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    let body_source = entry_body_source(props);
    let collapsed = !props.verbose && !props.tool_expanded;
    let body = if collapsed {
        collapse_tool_body(body_source)
    } else {
        trim_boundary_newlines(body_source)
    };
    let collapsible_tool =
        collapsed && tool_body_has_multiple_actions(body_source);

    let mut lines = Vec::new();
    if let Some(header) = render_entry_header(props, shows_stripe_in_compact(EntryKind::ToolCall), false) {
        lines.push(header);
        lines.push(Line::default())
    }
    lines.extend(render_body_lines(props, &body));

    RenderedEntry {
        lines,
        collapsible_tool,
    }
}

fn render_artifact_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    let body_source = entry_body_source(props);
    let mut lines = Vec::new();
    if let Some(header) = render_entry_header(props, shows_stripe_in_compact(EntryKind::Artifact), false) {
        lines.push(header);
        lines.push(Line::default())
    }
    lines.extend(render_artifact_body_lines(props, body_source));
    RenderedEntry {
        lines,
        collapsible_tool: false,
    }
}

fn render_chat_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, false)
}

fn render_system_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, false)
}

fn render_info_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, false)
}

fn render_warning_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, shows_stripe_in_compact(EntryKind::Warning))
}

fn render_error_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, shows_stripe_in_compact(EntryKind::Error))
}

fn render_response_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, shows_stripe_in_compact(EntryKind::Response))
}

fn render_interaction_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    render_standard_entry(props, false)
}

fn render_standard_entry(props: &EntryRenderProps<'_>, show_stripe: bool) -> RenderedEntry {
    let body_source = entry_body_source(props);
    let mut lines = Vec::new();
    if let Some(header) = render_entry_header(props, show_stripe, false) {
        lines.push(header);
        lines.push(Line::default())
    }
    lines.extend(render_body_lines(props, body_source));
    RenderedEntry {
        lines,
        collapsible_tool: false,
    }
}

fn entry_body_source<'a>(props: &EntryRenderProps<'a>) -> &'a str {
    if props.verbose {
        props
            .entry
            .verbose_body
            .as_deref()
            .unwrap_or(&props.entry.body)
    } else {
        &props.entry.body
    }
}

fn shows_stripe_in_compact(kind: EntryKind) -> bool {
    matches!(
        kind,
        EntryKind::ToolCall
            | EntryKind::Artifact
            | EntryKind::Error
            | EntryKind::Warning
            | EntryKind::Response
    )
}

fn title_streaming_cursor(props: &EntryRenderProps<'_>) -> bool {
    !props.verbose
        && props.entry.kind == EntryKind::Reasoning
        && Some(props.entry_idx) == props.streaming_entry_idx
        && props.streaming_reasoning
}

fn render_entry_header(
    props: &EntryRenderProps<'_>,
    show_stripe: bool,
    append_title_cursor: bool,
) -> Option<Line<'static>> {
    let header_title = candy::entry_header_title(props.entry.kind, &props.entry.title, props.verbose)?;
    let prefix = if !props.verbose && show_stripe {
        candy::entry_stripe_prefix(candy::entry_stripe_tone(props.entry.kind), props.theme)
    } else {
        String::new()
    };
    let mut title_spans = vec![Span::styled(
        format!("{prefix}{header_title}"),
        Style::default().fg(props.entry.tone.color(props.theme)),
    )];
    if append_title_cursor {
        title_spans.push(streaming_cursor_span(props));
    }
    Some(Line::from(title_spans))
}

fn render_body_lines(props: &EntryRenderProps<'_>, body: &str) -> Vec<Line<'static>> {
    let body = trim_boundary_newlines(body);
    if body.is_empty() {
        return standalone_streaming_cursor_line(props);
    }
    let body_width = props.inner_width.clamp(1, 150);
    let mut body_lines = markdown::render_body(
        &body,
        body_width,
        props.entry.tone.color(props.theme),
        "",
        props.theme,
    );
    maybe_append_body_streaming_cursor(&mut body_lines, props);
    body_lines
}

fn render_artifact_body_lines(props: &EntryRenderProps<'_>, body: &str) -> Vec<Line<'static>> {
    let body = trim_boundary_newlines(body);
    if body.is_empty() {
        return standalone_streaming_cursor_line(props);
    }
    let body_width = props.inner_width.clamp(1, 150);
    let mut body_lines = if diff::is_diff_artifact_title(&props.entry.title)
        || diff::looks_like_diff(&body)
    {
        diff::render_diff_lines(&body, props.theme, "")
    } else {
        markdown::render_body(
            &body,
            body_width,
            props.entry.tone.color(props.theme),
            "",
            props.theme,
        )
    };
    maybe_append_body_streaming_cursor(&mut body_lines, props);
    body_lines
}

fn standalone_streaming_cursor_line(props: &EntryRenderProps<'_>) -> Vec<Line<'static>> {
    if should_show_body_streaming_cursor(props) {
        vec![Line::from(streaming_cursor_span(props))]
    } else {
        Vec::new()
    }
}

fn maybe_append_body_streaming_cursor(lines: &mut [Line<'static>], props: &EntryRenderProps<'_>) {
    if !should_show_body_streaming_cursor(props) {
        return;
    }
    if let Some(last) = lines.last_mut() {
        last.spans.push(streaming_cursor_span(props));
    }
}

fn should_show_body_streaming_cursor(props: &EntryRenderProps<'_>) -> bool {
    Some(props.entry_idx) == props.streaming_entry_idx && props.show_body_streaming_cursor
}

fn streaming_cursor_span(props: &EntryRenderProps<'_>) -> Span<'static> {
    Span::styled(
        candy::streaming_cursor(props.spinner_tick),
        Style::default()
            .fg(props.theme.transcript.body_color.color())
            .add_modifier(Modifier::SLOW_BLINK),
    )
}

/// Thick left border glyph used by the composer [`super::layout::surface_block`].
const COMPOSER_STRIPE_CHAR: &str = "┃";

/// Render a user `input.received` transcript entry as an inline "input
/// surface" strip that mirrors the chat composer: a full-width
/// [`crate::theme::ComposerColors::background_color`] with a coloured accent stripe
/// down the left edge and the raw message text — no title, no markdown, no
/// indent — exactly like the live composer.
fn render_input_surface_lines(
    entry: &TranscriptEntry,
    inner_width: usize,
    theme: &Theme,
    spacing: UiSpacing,
) -> Vec<Line<'static>> {
    let pad_h = spacing.pad_h as usize;
    let pad_v = spacing.pad_v as usize;
    let stripe_width = usize::from(theme.layout.composer_stripe);
    let content_width = inner_width
        .saturating_sub(stripe_width)
        .saturating_sub(pad_h.saturating_mul(2))
        .max(1);

    let body = trim_boundary_newlines(&entry.body);
    let wrapped = wrap_plain_text(&body, content_width);
    let mut lines = Vec::with_capacity(wrapped.len() + pad_v.saturating_mul(2));

    for _ in 0..pad_v {
        lines.push(input_surface_line("", inner_width, theme, spacing));
    }
    for text in wrapped {
        lines.push(input_surface_line(&text, inner_width, theme, spacing));
    }
    for _ in 0..pad_v {
        lines.push(input_surface_line("", inner_width, theme, spacing));
    }

    if lines.is_empty() {
        lines.push(input_surface_line("", inner_width, theme, spacing));
    }

    lines
}

fn input_surface_line(
    text: &str,
    inner_width: usize,
    theme: &Theme,
    spacing: UiSpacing,
) -> Line<'static> {
    let input_bg = theme.composer.background_color.color();
    let stripe_fg = theme.composer.stripe_color.color();
    let text_fg = theme.composer.text_color.color();
    let pad_h = spacing.pad_h as usize;
    let stripe_width = usize::from(theme.layout.composer_stripe);

    let mut spans: Vec<Span<'static>> = Vec::with_capacity(4);
    if stripe_width > 0 {
        spans.push(Span::styled(
            COMPOSER_STRIPE_CHAR.to_string(),
            Style::default().fg(stripe_fg).bg(input_bg),
        ));
    }
    spans.push(Span::styled(
        " ".repeat(pad_h),
        Style::default().bg(input_bg),
    ));
    spans.push(Span::styled(
        text.to_string(),
        Style::default().fg(text_fg).bg(input_bg),
    ));
    let used = stripe_width + pad_h + visible_len(text);
    let fill = inner_width.saturating_sub(used);
    if fill > 0 {
        spans.push(Span::styled(
            " ".repeat(fill),
            Style::default().bg(input_bg),
        ));
    }
    Line::from(spans)
}

/// Whether a tool-call body has multiple actions and can be collapsed.
fn tool_body_has_multiple_actions(body: &str) -> bool {
    body.lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            trimmed.starts_with("└ ") || trimmed.starts_with("├ ")
        })
        .count()
        > 1
}

/// Collapse a multi-action tool body to its first branch (candy #15).
fn collapse_tool_body(body: &str) -> String {
    let lines: Vec<&str> = body.lines().collect();
    let action_starts: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter_map(|(i, l)| {
            let t = l.trim_start();
            if t.starts_with("└ ") || t.starts_with("├ ") {
                Some(i)
            } else {
                None
            }
        })
        .collect();
    if action_starts.len() <= 1 {
        return trim_boundary_newlines(body);
    }
    let first_end = action_starts.get(1).copied().unwrap_or(lines.len());
    let mut out: Vec<String> = lines[..first_end]
        .iter()
        .map(|s| (*s).to_string())
        .collect();
    out.push(format!(
        "   … {} more actions (Enter to expand)",
        action_starts.len() - 1
    ));
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapse_tool_body_passes_through_single_action() {
        let body = "└ read file\ncontents here";
        assert_eq!(collapse_tool_body(body), body);
    }

    #[test]
    fn collapse_tool_body_folds_extra_actions() {
        let body = "└ read foo\nstuff\n└ write bar\nmore";
        let collapsed = collapse_tool_body(body);
        assert!(collapsed.contains("└ read foo"));
        assert!(collapsed.contains("1 more actions"));
        assert!(!collapsed.contains("└ write bar"));
    }

    #[test]
    fn input_surface_renders_stripe_and_text() {
        use super::super::layout::ui_spacing;
        use crate::theme::Tone;
        let theme = Theme::material_dark();
        let spacing = ui_spacing(ratatui::layout::Rect::new(0, 0, 80, 24));
        let entry = TranscriptEntry {
            kind: EntryKind::Input,
            title: "You".to_string(),
            body: "hello world".to_string(),
            verbose_body: None,
            tone: Tone::Input,
        };
        let lines = render_input_surface_lines(&entry, 40, &theme, spacing);
        let text_line = lines
            .iter()
            .find(|line| line.spans.iter().any(|s| s.content.as_ref() == "hello world"))
            .expect("message line");
        let spans = &text_line.spans;
        assert!(spans.len() >= 3);
        assert_eq!(spans[0].content.as_ref(), COMPOSER_STRIPE_CHAR);
        assert_eq!(
            spans[0].style.fg,
            Some(theme.composer.stripe_color.color())
        );
        assert_eq!(spans[0].style.bg, Some(theme.composer.background_color.color()));
        assert!(spans.iter().any(|s| s.content.as_ref() == "hello world"));
    }

    #[test]
    fn input_surface_wraps_long_messages() {
        use super::super::layout::ui_spacing;
        use crate::theme::Tone;
        let theme = Theme::material_dark();
        let spacing = ui_spacing(ratatui::layout::Rect::new(0, 0, 80, 24));
        let entry = TranscriptEntry {
            kind: EntryKind::Input,
            title: "You".to_string(),
            body: "abcdefghij".repeat(20),
            verbose_body: None,
            tone: Tone::Input,
        };
        let lines = render_input_surface_lines(&entry, 20, &theme, spacing);
        assert!(lines.len() > 1);
    }
}