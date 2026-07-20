//! Unified diff colourisation for `text/x-diff` artifacts (nice-to-have #19).

use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};

use crate::theme::{Theme, Tone};

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

const DIFF_MIMES: &[&str] = &["text/x-diff", "text/x-patch"];

/// Whether a MIME type should use diff rendering.
pub fn is_diff_mime(mime: &str) -> bool {
    DIFF_MIMES.contains(&mime)
}

/// Whether an artifact title advertises a diff MIME type.
pub fn is_diff_artifact_title(title: &str) -> bool {
    DIFF_MIMES
        .iter()
        .any(|mime| is_diff_mime(mime) && title.contains(mime))
}

/// Heuristic: unified diff markers present in body text.
pub fn looks_like_diff(text: &str) -> bool {
    let lines: Vec<&str> = text.lines().collect();
    let has_hunk = lines.iter().any(|line| line.starts_with("@@"));
    if !has_hunk {
        return false;
    }
    let has_file_headers = lines
        .iter()
        .any(|line| line.starts_with("+++ ") || line.starts_with("--- "));
    let has_hunk_changes = lines.iter().any(|line| {
        line.starts_with('+') && !line.starts_with("+++")
            || line.starts_with('-') && !line.starts_with("---")
    });
    has_file_headers && has_hunk_changes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_unified_diff() {
        let diff = "\
--- a/foo.rs
+++ b/foo.rs
@@ -1,3 +1,3 @@
-old
+new
 context";
        assert!(looks_like_diff(diff));
    }

    #[test]
    fn rejects_markdown_with_plus_lines() {
        let md = "\
# Title
+ bullet one
+ bullet two
@@ not a hunk";
        assert!(!looks_like_diff(md));
    }
}
