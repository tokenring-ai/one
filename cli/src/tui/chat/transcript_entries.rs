//! Per-entry-kind transcript line builders used by [`super::render::draw_transcript`].

use ratatui::{
    style::{Modifier, Style},
    text::{Line, Span},
};

use crate::theme::Theme;
use crate::tui::candy;
use crate::tui::diff;
use crate::tui::markdown;
use crate::tui::text::{fit_line, trim_boundary_newlines, visible_len, wrap_plain_text};
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
    pub show_body_streaming_cursor: bool,
    pub streaming_reasoning: bool,
}

/// Lines produced for one transcript entry.
pub(super) struct RenderedEntry {
    pub lines: Vec<Line<'static>>,
}

/// A tool-call row's span in the flattened transcript line buffer.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct ToolHitRow {
    pub entry_idx: usize,
    pub start_line: usize,
    pub line_count: usize,
}

/// Flattened transcript lines plus the tool rows that can be clicked.
pub(super) struct TranscriptRender {
    pub lines: Vec<Line<'static>>,
    pub tool_rows: Vec<ToolHitRow>,
}

const DIFF_PREVIEW_MAX: usize = 40;

/// Render every visible entry. Attachments that immediately follow a tool call
/// fold into that tool and only appear when it is expanded.
pub(super) fn render_transcript_lines(
    entries: &[TranscriptEntry],
    inner_width: usize,
    theme: &Theme,
    spacing: UiSpacing,
    verbose: bool,
    streaming_entry_idx: Option<usize>,
    spinner_tick: usize,
    show_body_streaming_cursor: bool,
    streaming_reasoning: bool,
) -> TranscriptRender {
    let mut lines: Vec<Line<'static>> = Vec::new();
    let mut tool_rows = Vec::new();
    let mut index = 0usize;
    while index < entries.len() {
        let entry = &entries[index];
        if !verbose && entry.kind.hidden_in_compact() {
            index += 1;
            continue;
        }

        let (rendered, next) = if entry.kind == EntryKind::ToolCall {
            let mut end = index + 1;
            while end < entries.len() && entries[end].kind == EntryKind::Attachment {
                end += 1;
            }
            let props = entry_props(
                entry,
                index,
                inner_width,
                theme,
                spacing,
                verbose,
                streaming_entry_idx,
                spinner_tick,
                show_body_streaming_cursor,
                streaming_reasoning,
            );
            (
                render_tool_call_entry(&props, &entries[index + 1..end]),
                end,
            )
        } else {
            let props = entry_props(
                entry,
                index,
                inner_width,
                theme,
                spacing,
                verbose,
                streaming_entry_idx,
                spinner_tick,
                show_body_streaming_cursor,
                streaming_reasoning,
            );
            (render_transcript_entry(&props), index + 1)
        };

        if rendered.lines.is_empty() {
            index = next;
            continue;
        }
        if spacing.gap > 0 && !lines.is_empty() {
            lines.push(Line::default());
        }
        if entry.kind == EntryKind::ToolCall {
            let start_line = lines.len();
            let line_count = rendered.lines.len();
            tool_rows.push(ToolHitRow {
                entry_idx: index,
                start_line,
                line_count,
            });
        }
        lines.extend(rendered.lines);
        index = next;
    }

    TranscriptRender { lines, tool_rows }
}

fn entry_props<'a>(
    entry: &'a TranscriptEntry,
    entry_idx: usize,
    inner_width: usize,
    theme: &'a Theme,
    spacing: UiSpacing,
    verbose: bool,
    streaming_entry_idx: Option<usize>,
    spinner_tick: usize,
    show_body_streaming_cursor: bool,
    streaming_reasoning: bool,
) -> EntryRenderProps<'a> {
    EntryRenderProps {
        entry,
        entry_idx,
        inner_width,
        theme,
        spacing,
        verbose,
        streaming_entry_idx,
        spinner_tick,
        show_body_streaming_cursor,
        streaming_reasoning,
    }
}

pub(super) fn render_transcript_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    match props.entry.kind {
        EntryKind::Input => render_input_entry(props),
        EntryKind::Reasoning => render_reasoning_entry(props),
        EntryKind::ToolCall => render_tool_call_entry(props, &[]),
        EntryKind::Attachment => render_artifact_entry(props),
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
    RenderedEntry { lines }
}

fn render_tool_call_entry(
    props: &EntryRenderProps<'_>,
    attachments: &[TranscriptEntry],
) -> RenderedEntry {
    let summary = tool_summary(&props.entry.body);
    let chevron = if props.entry.expanded { "▾" } else { "▸" };
    let header = if summary.is_empty() {
        format!("{chevron} {}", props.entry.title)
    } else {
        format!("{chevron} {}  {summary}", props.entry.title)
    };
    let mut lines = vec![Line::from(Span::styled(
        fit_line(&header, props.inner_width.max(1)),
        Style::default().fg(props.entry.tone.color(props.theme)),
    ))];

    if !props.entry.expanded {
        return RenderedEntry { lines };
    }

    lines.push(Line::default());
    lines.extend(render_body_lines(props, &props.entry.body));
    if let Some(actions) = props
        .entry
        .verbose_body
        .as_deref()
        .map(trim_boundary_newlines)
        .filter(|actions| !actions.is_empty())
    {
        let body_width = props.inner_width.clamp(1, 150);
        lines.extend(markdown::render_body(
            &actions,
            body_width,
            crate::theme::Tone::Muted.color(props.theme),
            "",
            props.theme,
        ));
    }
    for attachment in attachments {
        lines.extend(render_folded_attachment(attachment, props));
    }

    RenderedEntry { lines }
}

/// First line of a tool message, with markdown emphasis markers removed.
fn tool_summary(body: &str) -> String {
    let first = body
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    let stripped: String = first
        .chars()
        .filter(|ch| *ch != '*' && *ch != '`')
        .collect();
    stripped.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn render_folded_attachment(
    attachment: &TranscriptEntry,
    props: &EntryRenderProps<'_>,
) -> Vec<Line<'static>> {
    let is_diff = attachment
        .mime_type
        .as_deref()
        .is_some_and(diff::is_diff_mime);
    if is_diff {
        let body = trim_boundary_newlines(&attachment.body);
        if body.is_empty() {
            return Vec::new();
        }
        return cap_preview(
            diff::render_diff_lines(&body, props.theme, ""),
            DIFF_PREVIEW_MAX,
            props.theme,
        );
    }

    let mut lines = vec![Line::from(Span::styled(
        fit_line(&attachment.title, props.inner_width.max(1)),
        Style::default().fg(crate::theme::Tone::Muted.color(props.theme)),
    ))];
    let description = trim_boundary_newlines(&attachment.body);
    if !description.is_empty() {
        lines.extend(
            wrap_plain_text(&description, props.inner_width.max(1))
                .into_iter()
                .map(|text| {
                    Line::from(Span::styled(
                        text,
                        Style::default().fg(crate::theme::Tone::Muted.color(props.theme)),
                    ))
                }),
        );
    }
    lines
}

fn cap_preview(mut lines: Vec<Line<'static>>, max: usize, theme: &Theme) -> Vec<Line<'static>> {
    if lines.len() <= max {
        return lines;
    }
    let hidden = lines.len() - max;
    lines.truncate(max);
    lines.push(Line::from(Span::styled(
        format!("… {hidden} more"),
        Style::default().fg(crate::theme::Tone::Muted.color(theme)),
    )));
    lines
}

fn render_artifact_entry(props: &EntryRenderProps<'_>) -> RenderedEntry {
    let body_source = entry_body_source(props);
    let mut lines = Vec::new();
    if let Some(header) =
        render_entry_header(props, shows_stripe_in_compact(EntryKind::Attachment), false)
    {
        lines.push(header);
        lines.push(Line::default())
    }
    lines.extend(render_artifact_body_lines(props, body_source));
    RenderedEntry { lines }
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
    RenderedEntry { lines }
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
            | EntryKind::Attachment
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
    let header_title =
        candy::entry_header_title(props.entry.kind, &props.entry.title, props.verbose)?;
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
    // Diff colouring is keyed off the attachment MIME (never content-sniffed).
    let is_diff = props
        .entry
        .mime_type
        .as_deref()
        .is_some_and(diff::is_diff_mime);
    let mut body_lines = if is_diff {
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

#[cfg(test)]
mod tests {
    use super::*;

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
            mime_type: None,
            expanded: false,
        };
        let lines = render_input_surface_lines(&entry, 40, &theme, spacing);
        let text_line = lines
            .iter()
            .find(|line| {
                line.spans
                    .iter()
                    .any(|s| s.content.as_ref() == "hello world")
            })
            .expect("message line");
        let spans = &text_line.spans;
        assert!(spans.len() >= 3);
        assert_eq!(spans[0].content.as_ref(), COMPOSER_STRIPE_CHAR);
        assert_eq!(spans[0].style.fg, Some(theme.composer.stripe_color.color()));
        assert_eq!(
            spans[0].style.bg,
            Some(theme.composer.background_color.color())
        );
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
            mime_type: None,
            expanded: false,
        };
        let lines = render_input_surface_lines(&entry, 20, &theme, spacing);
        assert!(lines.len() > 1);
    }

    #[test]
    fn tool_row_is_one_line_until_expanded() {
        use super::super::layout::ui_spacing;
        use crate::theme::Tone;

        let theme = Theme::material_dark();
        let spacing = ui_spacing(ratatui::layout::Rect::new(0, 0, 80, 24));
        let mut entry = TranscriptEntry {
            kind: EntryKind::ToolCall,
            title: "filesystem.read".into(),
            body: "**File** Read 3 files".into(),
            verbose_body: Some("└  Read a.txt\n└  Read b.txt\n└  Read c.txt".into()),
            tone: Tone::Success,
            mime_type: None,
            expanded: false,
        };
        let compact = render_tool_call_entry(
            &EntryRenderProps {
                entry: &entry,
                entry_idx: 0,
                inner_width: 80,
                theme: &theme,
                spacing,
                verbose: true,
                streaming_entry_idx: None,
                spinner_tick: 0,
                show_body_streaming_cursor: false,
                streaming_reasoning: false,
            },
            &[],
        );
        let compact_text = line_text(&compact.lines);
        assert_eq!(compact.lines.len(), 1);
        assert!(compact_text.contains("filesystem.read"));
        assert!(compact_text.contains("File Read 3 files"));
        assert!(!compact_text.contains("Read a.txt"));
        assert_eq!(
            compact.lines[0].spans[0].style.fg,
            Some(Tone::Success.color(&theme))
        );

        entry.expanded = true;
        entry.tone = Tone::Error;
        let expanded = render_tool_call_entry(
            &EntryRenderProps {
                entry: &entry,
                entry_idx: 0,
                inner_width: 80,
                theme: &theme,
                spacing,
                verbose: false,
                streaming_entry_idx: None,
                spinner_tick: 0,
                show_body_streaming_cursor: false,
                streaming_reasoning: false,
            },
            &[],
        );
        assert_eq!(
            expanded.lines[0].spans[0].style.fg,
            Some(Tone::Error.color(&theme))
        );
        assert!(expanded
            .lines
            .iter()
            .flat_map(|line| &line.spans)
            .any(|span| {
                span.content.contains("└  Read a.txt")
                    && span.style.fg == Some(Tone::Muted.color(&theme))
                    && span.style.bg == Some(theme.transcript.background_color.color())
            }));
    }

    #[test]
    fn expanded_tool_folds_diff_and_caps_the_preview() {
        use super::super::layout::ui_spacing;
        use crate::theme::Tone;

        let theme = Theme::material_dark();
        let spacing = ui_spacing(ratatui::layout::Rect::new(0, 0, 80, 24));
        let mut tool = TranscriptEntry {
            kind: EntryKind::ToolCall,
            title: "filesystem.write".into(),
            body: "Wrote file".into(),
            verbose_body: None,
            tone: Tone::Success,
            mime_type: None,
            expanded: false,
        };
        let diff_body = (0..50)
            .map(|i| format!("+line {i}"))
            .collect::<Vec<_>>()
            .join("\n");
        let attachment = TranscriptEntry {
            kind: EntryKind::Attachment,
            title: "Attachment: change.diff (text/x-diff)".into(),
            body: diff_body,
            verbose_body: None,
            tone: Tone::Info,
            mime_type: Some("text/x-diff".into()),
            expanded: false,
        };
        let entries = [tool.clone(), attachment];
        let collapsed =
            render_transcript_lines(&entries, 80, &theme, spacing, false, None, 0, false, false);
        assert_eq!(collapsed.tool_rows.len(), 1);
        assert_eq!(collapsed.tool_rows[0].line_count, 1);
        assert!(!line_text(&collapsed.lines).contains("+line 0"));

        tool.expanded = true;
        let entries = [tool, entries[1].clone()];
        let expanded =
            render_transcript_lines(&entries, 80, &theme, spacing, false, None, 0, false, false);
        let text = line_text(&expanded.lines);
        assert!(text.contains("+line 0"));
        assert!(!text.contains("+line 49"));
        assert!(text.contains("… 10 more"));
    }

    fn line_text(lines: &[Line<'_>]) -> String {
        lines
            .iter()
            .flat_map(|line| line.spans.iter().map(|span| span.content.as_ref()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    #[test]
    fn compact_tool_diff_uses_diff_colors() {
        use super::super::layout::ui_spacing;
        use crate::theme::Tone;

        let theme = Theme::material_dark();
        let spacing = ui_spacing(ratatui::layout::Rect::new(0, 0, 80, 24));
        let entry = TranscriptEntry {
            kind: EntryKind::Attachment,
            title: "Attachment: change.diff (text/x-diff)".into(),
            body: "--- a/file\n+++ b/file\n+added".into(),
            verbose_body: Some("--- a/file\n+++ b/file\n+added".into()),
            tone: Tone::Info,
            mime_type: Some("text/x-diff".into()),
            expanded: false,
        };
        let rendered = render_artifact_entry(&EntryRenderProps {
            entry: &entry,
            entry_idx: 0,
            inner_width: 80,
            theme: &theme,
            spacing,
            verbose: false,
            streaming_entry_idx: None,
            spinner_tick: 0,
            show_body_streaming_cursor: false,
            streaming_reasoning: false,
        });

        let added = rendered
            .lines
            .iter()
            .flat_map(|line| &line.spans)
            .find(|span| span.content.as_ref() == "+added")
            .expect("added diff line");
        assert_eq!(added.style.fg, Some(theme.diff.added_color.color()));
    }
}
