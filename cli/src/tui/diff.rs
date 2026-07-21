//! MIME-keyed attachment display helpers and unified-diff colourisation
//! (`text/x-diff` / `text/x-patch` only — content is never sniffed).

use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};

use crate::theme::{Theme, Tone};

/// How an attachment body should be presented in the CLI.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttachmentDisplayKind {
    /// Unified diff — colourised line-by-line when expanded.
    Diff,
    /// Representable text (plain, markdown, html, json, email, other `text/*`).
    Text,
    /// Audio / video / image / unknown binary — name (+ description) only.
    MetaOnly,
}

/// Primary type/subtype of a MIME string (strips parameters, lowercased).
pub fn primary_mime(mime: &str) -> String {
    mime.split(';')
        .next()
        .unwrap_or(mime)
        .trim()
        .to_ascii_lowercase()
}

/// MIME types that should use diff colouring (content is never sniffed).
const DIFF_MIMES: &[&str] = &["text/x-diff", "text/x-patch"];

/// Whether a MIME type should use diff rendering.
pub fn is_diff_mime(mime: &str) -> bool {
    let primary = primary_mime(mime);
    DIFF_MIMES
        .iter()
        .any(|candidate| primary.eq_ignore_ascii_case(candidate))
}

/// Classify a MIME for CLI attachment rendering.
pub fn attachment_display_kind(mime: &str) -> AttachmentDisplayKind {
    if is_diff_mime(mime) {
        return AttachmentDisplayKind::Diff;
    }
    let primary = primary_mime(mime);
    if primary.starts_with("audio/")
        || primary.starts_with("video/")
        || primary.starts_with("image/")
    {
        return AttachmentDisplayKind::MetaOnly;
    }
    match primary.as_str() {
        "text/plain"
        | "text/markdown"
        | "text/html"
        | "application/json"
        | "message/rfc822" => AttachmentDisplayKind::Text,
        // Other text/* subtypes (except diffs, already handled) are showable.
        _ if primary.starts_with("text/") => AttachmentDisplayKind::Text,
        _ => AttachmentDisplayKind::MetaOnly,
    }
}

/// Render a unified diff body as tone-coloured lines.
pub fn render_diff_lines(diff: &str, theme: &Theme, indent: &str) -> Vec<Line<'static>> {
    diff.lines()
        .map(|line| {
            let style = diff_line_style(line, theme);
            Line::from(Span::styled(format!("{indent}{line}"), style))
        })
        .collect()
}

fn diff_line_style(line: &str, theme: &Theme) -> Style {
    if line.starts_with("+++") || line.starts_with("---") {
        return Style::default()
            .fg(Tone::Info.color(theme))
            .add_modifier(Modifier::BOLD);
    }
    if line.starts_with("@@") {
        return Style::default().fg(theme.diff.context_color.color());
    }
    if line.starts_with('+') {
        return Style::default().fg(theme.diff.added_color.color());
    }
    if line.starts_with('-') {
        return Style::default().fg(theme.diff.removed_color.color());
    }
    Style::default().fg(theme.diff.unchanged_color.color())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_diff_mimes() {
        assert!(is_diff_mime("text/x-diff"));
        assert!(is_diff_mime("text/x-patch"));
        assert!(is_diff_mime("text/x-diff; charset=utf-8"));
        assert!(!is_diff_mime("text/plain"));
        assert!(!is_diff_mime("text/markdown"));
    }

    #[test]
    fn classifies_display_kinds() {
        assert_eq!(
            attachment_display_kind("text/x-diff"),
            AttachmentDisplayKind::Diff
        );
        assert_eq!(
            attachment_display_kind("text/markdown"),
            AttachmentDisplayKind::Text
        );
        assert_eq!(
            attachment_display_kind("image/png"),
            AttachmentDisplayKind::MetaOnly
        );
        assert_eq!(
            attachment_display_kind("audio/wav"),
            AttachmentDisplayKind::MetaOnly
        );
        assert_eq!(
            attachment_display_kind("video/mp4"),
            AttachmentDisplayKind::MetaOnly
        );
        assert_eq!(
            attachment_display_kind("application/octet-stream"),
            AttachmentDisplayKind::MetaOnly
        );
    }
}
