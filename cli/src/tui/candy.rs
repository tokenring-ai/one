//! Visual polish helpers implementing `design/candy.md` affordances.

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};

use crate::theme::{Theme, Tone};
use crate::tui::text::visible_len;

/// Horizontal padding breakpoint (cols) for split-pane preview hint (candy #30).
pub const SPLIT_PANE_WIDTH: u16 = 80;
pub const SPLIT_PANE_OPTIMAL: u16 = 90;

/// Apply 1-char edge padding to the middle content box when the terminal is
/// wide/tall enough (candy #3). Horizontal padding insets the box from the
/// screen sides; vertical padding frames it with a blank row below the header
/// bar and above the status bar. The fixed header and status bars themselves
/// stay pinned to the full screen width and height.
pub fn padded_area(area: Rect, theme: &Theme) -> Rect {
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
        width: area.width.saturating_sub(h_pad * 2),
        height: area.height.saturating_sub(v_pad * 2),
    }
}

/// Blinking streaming cursor character (candy #2).
pub fn streaming_cursor(tick: usize) -> &'static str {
    if tick.is_multiple_of(2) {
        "▌"
    } else {
        " "
    }
}

/// Unicode context progress bar (candy #10).
pub fn context_progress_bar(percent_left: u8, width: usize) -> (String, Color) {
    let bar_width = width.clamp(4, 12);
    let filled = ((percent_left as f64 / 100.0) * bar_width as f64).round() as usize;
    let filled = filled.min(bar_width);
    let empty = bar_width.saturating_sub(filled);
    let bar = format!("{}{}", "█".repeat(filled), "░".repeat(empty));
    let color = if percent_left < 20 {
        Color::Yellow
    } else {
        Color::Green
    };
    (bar, color)
}

/// WebSocket stream health (nice-to-have #4).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StreamHealth {
    Connected,
    Reconnecting,
    Error,
}

impl StreamHealth {
    pub fn dot_color(self, theme: &Theme, latency_ms: Option<u64>) -> Color {
        match self {
            StreamHealth::Connected => match latency_ms {
                Some(ms) if ms < 250 => theme.status.connection_good_color.color(),
                Some(ms) if ms < 1_000 => theme.status.connection_warning_color.color(),
                Some(_) => theme.status.connection_error_color.color(),
                None => theme.status.connection_unknown_color.color(),
            },
            StreamHealth::Reconnecting => theme.status.connection_warning_color.color(),
            StreamHealth::Error => theme.status.connection_error_color.color(),
        }
    }

    pub fn status_text(self, latency_ms: Option<u64>) -> String {
        match self {
            StreamHealth::Connected => match latency_ms {
                Some(ms) => format!("connected {ms}ms"),
                None => "connected --ms".to_string(),
            },
            StreamHealth::Reconnecting => "reconnecting".to_string(),
            StreamHealth::Error => "error".to_string(),
        }
    }
}

/// Parse rate-limit / retry hints from `agent.status` activity (nice-to-have #21).
pub fn parse_rate_limit_hint(activity: &str) -> Option<String> {
    let lower = activity.to_lowercase();
    let rate_limited = lower.contains("rate limit")
        || lower.contains("rate-limit")
        || lower.contains("rate limited")
        || lower.contains("ratelimit");
    let retrying = lower.contains("retry in")
        || lower.contains("retry after")
        || lower.contains("backoff")
        || lower.contains("retrying");
    if !(rate_limited || retrying) {
        return None;
    }
    if let Some(pos) = lower.find("retry") {
        let tail = activity[pos..].trim();
        if tail.len() > 5 {
            return Some(tail.to_string());
        }
    }
    if rate_limited {
        return Some("Rate limited".to_string());
    }
    None
}

/// Build inverted status line with coloured dots (candy #9, #10, #29).
#[allow(clippy::too_many_arguments)]
pub fn format_status_segments(
    theme: &Theme,
    stream: StreamHealth,
    model: String,
    context_label: String,
    context_percent: Option<u8>,
    latency_ms: Option<u64>,
    tools: usize,
    tokens: String,
    cost: String,
    cwd: String,
    width: usize,
) -> Line<'static> {
    let sep = &theme.layout.separator;
    let mut spans: Vec<Span<'static>> = Vec::new();

    let push_sep = |spans: &mut Vec<Span<'static>>| {
        if !spans.is_empty() {
            spans.push(Span::styled(
                sep.clone(),
                Style::default().fg(theme.status.separator_color.color()),
            ));
        }
    };

    let push_connection = |spans: &mut Vec<Span<'static>>, text: String| {
        push_sep(spans);
        spans.push(Span::styled(
            "● ".to_string(),
            Style::default().fg(stream.dot_color(theme, latency_ms)),
        ));
        spans.push(Span::styled(
            text,
            Style::default().fg(theme.status.segment_text_color.color()),
        ));
    };

    let push_segment = |spans: &mut Vec<Span<'static>>, text: String| {
        push_sep(spans);
        spans.push(Span::styled(
            text,
            Style::default().fg(theme.status.segment_text_color.color()),
        ));
    };

    push_connection(&mut spans, stream.status_text(latency_ms));
    push_segment(&mut spans, model);

    let ctx_text = if let Some(p) = context_percent {
        let (bar, _) = context_progress_bar(p, 8);
        format!("{context_label} {bar}")
    } else {
        context_label
    };
    push_segment(&mut spans, ctx_text);

    push_segment(&mut spans, format!("{tools} tools"));

    push_segment(&mut spans, format!("{tokens} tk"));
    push_segment(&mut spans, cost);
    let cwd_display = cwd.clone();
    push_segment(&mut spans, cwd);

    // Truncate by rebuilding with fewer trailing segments if needed.
    let full: String = spans.iter().map(|s| s.content.as_ref()).collect();
    if visible_len(&full) <= width {
        return Line::from(spans);
    }
    let connection = stream.status_text(latency_ms);
    let context = if let Some(p) = context_percent {
        format!("{p}% context left")
    } else {
        "-- context left".to_string()
    };
    let minimal = vec![
        Span::styled(
            "● ".to_string(),
            Style::default().fg(stream.dot_color(theme, latency_ms)),
        ),
        Span::styled(
            connection,
            Style::default().fg(theme.status.segment_text_color.color()),
        ),
        Span::styled(sep.clone(), Style::default().fg(theme.status.separator_color.color())),
        Span::styled(context, Style::default().fg(theme.status.segment_text_color.color())),
        Span::styled(sep.clone(), Style::default().fg(theme.status.separator_color.color())),
        Span::styled(cwd_display, Style::default().fg(theme.status.separator_color.color())),
    ];
    Line::from(minimal)
}

/// Flat status line (non-inverted) with progress bar supplement (candy #10).
pub fn format_status_flat(
    theme: &Theme,
    segments: &[String],
    context_percent: Option<u8>,
) -> String {
    let sep = &theme.layout.separator;
    let mut parts: Vec<String> = segments.to_vec();
    if let Some(p) = context_percent {
        if parts.len() > 1 {
            let (bar, _) = context_progress_bar(p, 8);
            parts[1] = format!("{} {bar}", parts[1]);
        }
    }
    parts.join(sep)
}

/// Quick-reply chip labels (candy #5).
pub fn quick_reply_chips(has_chat: bool) -> &'static [&'static str] {
    if has_chat {
        &[
            "Keep going",
            "What are the next steps?",
            "Plan the next steps",
        ]
    } else {
        &[
            "Run a code review on the current changes",
            "Analyze recent changes",
        ]
    }
}

/// Render quick-reply chip lines above the composer.
pub fn render_quick_reply_chips(
    chips: &[&str],
    selected: Option<usize>,
    theme: &Theme,
) -> Vec<Line<'static>> {
    let chip_bg = theme.quick_reply.chip_background_color.color();
    let chip_border = theme.quick_reply.chip_border_color.color();
    let mut spans: Vec<Span<'static>> = vec![Span::styled(
        "Quick Reply (Ctrl-R #): ",
        Style::default().fg(theme.quick_reply.label_color.color()),
    )];
    for (i, label) in chips.iter().enumerate() {
        if i > 0 {
            spans.push(Span::raw("  "));
        }
        let focused = selected == Some(i);
        let badge = format!("{}", i + 1);
        let style = if focused {
            Style::default()
                .fg(theme.quick_reply.selected_badge_color.color())
                .bg(chip_bg)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(theme.quick_reply.chip_text_color.color()).bg(chip_bg)
        };
        spans.push(Span::styled(format!("[{badge}] {label}"), style));
        let _ = chip_border;
    }
    vec![Line::from(spans)]
}

/// Draw an ASCII offset shadow row beneath a panel (candy #6).
pub fn render_ascii_shadow(frame: &mut ratatui::Frame, area: Rect, theme: &Theme) {
    if area.width < SPLIT_PANE_WIDTH {
        return;
    }
    let shadow_y = area.y.saturating_add(area.height);
    if shadow_y >= frame.area().height {
        return;
    }
    let shadow_width = area.width.saturating_sub(1);
    let shadow_x = area.x.saturating_add(1);
    let shadow_area = Rect {
        x: shadow_x,
        y: shadow_y,
        width: shadow_width,
        height: 1,
    };
    let fill: String = "░".repeat(shadow_width as usize);
    frame.render_widget(
        ratatui::widgets::Paragraph::new(fill).style(
            Style::default()
                .fg(theme.shadow.fill_color.color())
                .bg(theme.shadow.background_color.color()),
        ),
        shadow_area,
    );
}

/// Highlight fuzzy-matched characters in a file path (candy #22).
pub fn highlight_path_match(
    path: &str,
    query: &str,
    theme: &Theme,
    selected: bool,
) -> Line<'static> {
    let normalized_query: Vec<char> = query.trim().to_lowercase().chars().collect();
    if normalized_query.is_empty() {
        let style = if selected {
            Style::default()
                .fg(theme.picker.highlighted_color.color())
                .bg(theme.picker.chip_background_color.color())
        } else {
            Style::default().fg(theme.picker.item_text_color.color())
        };
        return Line::from(Span::styled(path.to_string(), style));
    }

    let lower_path: Vec<(usize, char)> = path
        .char_indices()
        .map(|(i, c)| (i, c.to_ascii_lowercase()))
        .collect();
    let mut match_indices = std::collections::HashSet::new();
    let mut search_from = 0usize;
    for &qch in &normalized_query {
        let mut found = false;
        for (idx, (_, ch)) in lower_path.iter().enumerate().skip(search_from) {
            if *ch == qch {
                if let Some((byte_idx, _)) = lower_path.get(idx) {
                    match_indices.insert(*byte_idx);
                }
                search_from = idx + 1;
                found = true;
                break;
            }
        }
        if !found {
            break;
        }
    }

    let accent = theme.picker.match_highlight_color.color();
    let base_style = if selected {
        Style::default()
            .fg(theme.picker.highlighted_color.color())
            .bg(theme.picker.chip_background_color.color())
    } else {
        Style::default().fg(theme.picker.item_text_color.color())
    };

    let mut spans: Vec<Span<'static>> = Vec::new();
    let mut byte_idx = 0usize;
    for ch in path.chars() {
        let is_match = match_indices.contains(&byte_idx);
        let style = if is_match {
            let mut s = Style::default().fg(accent).add_modifier(Modifier::BOLD);
            if let Some(bg) = base_style.bg {
                s = s.bg(bg);
            }
            s
        } else {
            base_style
        };
        spans.push(Span::styled(ch.to_string(), style));
        byte_idx += ch.len_utf8();
    }
    Line::from(spans)
}

/// Style preview-pane body lines with accent highlights (candy #8).
pub fn style_preview_line(line: &str, theme: &Theme) -> Line<'static> {
    let keywords = ["idle", "running", "Status:", "Tool", "tool"];
    let mut spans: Vec<Span<'static>> = Vec::new();
    let mut rest = line;
    while !rest.is_empty() {
        let mut earliest: Option<(usize, usize, &str)> = None;
        for kw in keywords {
            if let Some(pos) = rest.to_lowercase().find(&kw.to_lowercase()) {
                if earliest.map(|(p, _, _)| pos < p).unwrap_or(true) {
                    earliest = Some((pos, kw.len(), kw));
                }
            }
        }
        match earliest {
            Some((pos, len, _kw)) => {
                if pos > 0 {
                    spans.push(Span::styled(
                        rest[..pos].to_string(),
                        Style::default().fg(theme.status.segment_text_color.color()),
                    ));
                }
                spans.push(Span::styled(
                    rest[pos..pos + len].to_string(),
                    Style::default()
                        .fg(theme.picker.match_highlight_color.color())
                        .add_modifier(Modifier::BOLD),
                ));
                rest = &rest[pos + len..];
            }
            None => {
                spans.push(Span::styled(
                    rest.to_string(),
                    Style::default().fg(theme.status.segment_text_color.color()),
                ));
                break;
            }
        }
    }
    Line::from(spans)
}

/// Visual step indicator for multi-step forms (candy #16).
pub fn form_step_indicator(section: usize, sections: usize, field: usize, fields: usize) -> String {
    let mut dots = String::new();
    for s in 0..sections {
        if s < section {
            dots.push('●');
        } else {
            dots.push('○');
        }
        if s + 1 < sections {
            dots.push('─');
        }
    }
    format!("{dots}  Section {section}/{sections} · Field {field}/{fields}")
}

/// Countdown label for optional questions nearing auto-submit (candy #17).
pub fn auto_submit_countdown(auto_submit_at: f64) -> Option<String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs_f64();
    let remaining = auto_submit_at - now;
    if remaining <= 0.0 || remaining > 300.0 {
        return None;
    }
    if remaining < 60.0 {
        Some(format!("{:.0}s", remaining.ceil()))
    } else {
        Some(format!("{}m", (remaining / 60.0).ceil() as u64))
    }
}

/// Path for the one-time narrow-terminal width hint flag (candy #30).
pub fn width_hint_flag_path() -> Option<PathBuf> {
    std::env::var("HOME").ok().map(|h| {
        PathBuf::from(h)
            .join(".tokenring")
            .join("cli-rs-width-hint-shown")
    })
}

pub fn width_hint_already_shown() -> bool {
    width_hint_flag_path().map(|p| p.exists()).unwrap_or(true)
}

pub fn mark_width_hint_shown() {
    if let Some(path) = width_hint_flag_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, "1");
    }
}

/// Transcript entry header (candy #11).
///
/// Compact mode shows simplified headers for a subset of kinds; verbose mode
/// labels every non-input entry with a distinct emoji header.
pub fn entry_header_title(
    kind: crate::tui::transcript::EntryKind,
    title: &str,
    verbose: bool,
) -> Option<String> {
    use crate::tui::transcript::EntryKind;
    if verbose {
        return Some(match kind {
            EntryKind::Input => "Input Received".to_string(),
            EntryKind::Chat => "Assistant".to_string(),
            EntryKind::Reasoning => "Reasoning".to_string(),
            EntryKind::System => "System".to_string(),
            EntryKind::Info => "Info".to_string(),
            EntryKind::Warning => "Warning".to_string(),
            EntryKind::Error => "Error".to_string(),
            EntryKind::Response if title == "Error" => "Error".to_string(),
            EntryKind::Response => "Response".to_string(),
            EntryKind::Artifact => format!("{title}"),
            EntryKind::ToolCall => format!("{title}"),
            EntryKind::Interaction => "Interaction".to_string(),
        });
    }

    match kind {
        EntryKind::Reasoning => Some("⚡ Thinking...".to_string()),
        EntryKind::ToolCall => Some(format!("▸ {title}")),
        EntryKind::Artifact => Some(format!("▸ {title}")),
        EntryKind::Input | EntryKind::Chat | EntryKind::System | EntryKind::Info | EntryKind::Warning
        | EntryKind::Error | EntryKind::Response | EntryKind::Interaction => None,
    }
}

/// Error screen ASCII illustration (candy #21).
pub fn error_illustration(theme: &Theme) -> Line<'static> {
    Line::from(vec![
        Span::styled("  ╭──╮ ", Style::default().fg(theme.error.frame_color.color())),
        Span::styled("⚠", Style::default().fg(theme.error.icon_color.color())),
        Span::styled(" ╰──╯", Style::default().fg(theme.error.frame_color.color())),
    ])
}

/// Left accent bar prefix for transcript entries (candy #4).
pub fn entry_stripe_prefix(tone: Tone, _theme: &Theme) -> String {
    let _ = tone;
    "▌ ".to_string()
}

/// Map entry kind to stripe tone.
pub fn entry_stripe_tone(kind: crate::tui::transcript::EntryKind) -> Tone {
    use crate::tui::transcript::EntryKind;
    match kind {
        EntryKind::ToolCall | EntryKind::Artifact | EntryKind::Info => Tone::Info,
        EntryKind::Error => Tone::Error,
        EntryKind::Warning => Tone::Warning,
        EntryKind::Response => Tone::Success,
        EntryKind::Input => Tone::Input,
        EntryKind::Reasoning => Tone::Reasoning,
        EntryKind::Chat => Tone::Chat,
        EntryKind::System => Tone::Muted,
        EntryKind::Interaction => Tone::Ask,
    }
}

#[cfg(test)]
mod entry_header_tests {
    use super::entry_header_title;
    use crate::tui::transcript::EntryKind;

    #[test]
    fn reasoning_compact_title_is_thinking_placeholder() {
        assert_eq!(
            entry_header_title(EntryKind::Reasoning, "Reasoning", false).as_deref(),
            Some("⚡ Thinking...")
        );
    }

    #[test]
    fn verbose_mode_labels_each_kind() {
        assert_eq!(
            entry_header_title(EntryKind::Chat, "Assistant", true).as_deref(),
            Some("🤖 Assistant")
        );
        assert_eq!(
            entry_header_title(EntryKind::Reasoning, "Reasoning", true).as_deref(),
            Some("⚡ Reasoning")
        );
        assert_eq!(
            entry_header_title(EntryKind::ToolCall, "read file", true).as_deref(),
            Some("🔧 read file")
        );
        assert_eq!(
            entry_header_title(EntryKind::Input, "You", true).as_deref(),
            Some("📥 Input Received")
        );
    }
}

#[cfg(test)]
mod rate_limit_tests {
    use super::{format_status_flat, parse_rate_limit_hint};
    use crate::theme::Theme;

    #[test]
    fn parses_retry_phrase() {
        assert_eq!(
            parse_rate_limit_hint("Rate limited · retry in 12s").as_deref(),
            Some("retry in 12s")
        );
    }

    #[test]
    fn ignores_generic_waiting() {
        assert!(parse_rate_limit_hint("Waiting for tool result").is_none());
    }

    #[test]
    fn flat_status_puts_context_bar_on_context_segment() {
        let theme = Theme::default();
        let text = format_status_flat(
            &theme,
            &[
                "model-x".to_string(),
                "96% context left".to_string(),
                "12 tools".to_string(),
            ],
            Some(96),
        );

        assert!(text.contains("model-x"));
        assert!(text.contains("96% context left █"));
        assert!(!text.contains("model-x █"));
    }
}
