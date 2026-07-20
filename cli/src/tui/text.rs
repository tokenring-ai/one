//! Plain-text layout helpers ported from `@tokenring-ai/utility/string/*`.
//!
//! `visible_len` uses terminal display width via `unicode-width` so CJK and
//! emoji wrap correctly in narrow terminals.

use unicode_width::UnicodeWidthChar;

/// Number of visible terminal columns a string occupies.
pub fn visible_len(text: &str) -> usize {
    text.chars().map(|c| c.width().unwrap_or(0)).sum()
}

/// Greedily wrap `text` to `width` display columns. Tabs become two spaces.
pub fn wrap_plain_text(text: &str, width: usize) -> Vec<String> {
    if width == 0 {
        return vec![String::new()];
    }

    let mut wrapped = Vec::new();
    for line in text.replace('\t', "  ").split('\n') {
        if line.is_empty() {
            wrapped.push(String::new());
            continue;
        }

        let mut current = String::new();
        let mut current_width = 0usize;
        for ch in line.chars() {
            let ch_width = ch.width().unwrap_or(0);
            if !current.is_empty() && current_width + ch_width > width {
                wrapped.push(std::mem::take(&mut current));
                current_width = 0;
            }
            current.push(ch);
            current_width += ch_width;
        }
        if !current.is_empty() {
            wrapped.push(current);
        }
    }

    if wrapped.is_empty() {
        wrapped.push(String::new());
    }
    wrapped
}

/// Centre `text` within `width` columns (left-biased padding).
pub fn center_line(text: &str, width: usize) -> String {
    let padding = width.saturating_sub(visible_len(text)) / 2;
    format!("{}{}", " ".repeat(padding), text)
}

/// Truncate `text` to `width` display columns, appending an ellipsis when truncated.
pub fn fit_line(text: &str, width: usize) -> String {
    if width == 0 {
        return String::new();
    }
    if visible_len(text) <= width {
        return text.to_string();
    }
    if width <= 1 {
        return "…".to_string();
    }

    let mut out = String::new();
    let mut used = 0usize;
    let budget = width.saturating_sub(1);
    for ch in text.chars() {
        let ch_width = ch.width().unwrap_or(0);
        if used + ch_width > budget {
            out.push('…');
            return out;
        }
        out.push(ch);
        used += ch_width;
    }
    out
}

// --- Numeric/path formatters ported from `pkg/cli/raw/utility.ts` ----------

/// Strip leading/trailing newlines (`trimBoundaryNewlines`).
pub fn trim_boundary_newlines(text: &str) -> String {
    text.trim_matches(|c| c == '\n').to_string()
}

/// Compact number with optional suffix, e.g. `1.2k` / `3m` (`formatCompactNumber`).
pub fn format_compact_number(value: Option<u64>, suffix: &str) -> String {
    match value {
        None => format!("--{suffix}"),
        Some(v) if v < 1_000 => format!("{v}{suffix}"),
        Some(v) if v < 1_000_000 => {
            let scaled = v as f64 / 1000.0;
            let prec = if v >= 10_000 { 0 } else { 1 };
            strip_trailing_zero(scaled, prec, "k", suffix)
        }
        Some(v) => {
            let scaled = v as f64 / 1_000_000.0;
            let prec = if v >= 10_000_000 { 0 } else { 1 };
            strip_trailing_zero(scaled, prec, "m", suffix)
        }
    }
}

fn strip_trailing_zero(value: f64, prec: usize, unit: &str, suffix: &str) -> String {
    let s = format!("{:.*}", prec, value);
    let s = if prec > 0 && s.ends_with('0') {
        s.trim_end_matches('0').trim_end_matches('.').to_string()
    } else {
        s
    };
    format!("{s}{unit}{suffix}")
}

/// Currency formatter with adaptive precision (`formatCurrency`).
pub fn format_currency(value: Option<f64>) -> String {
    match value {
        None => "$--".to_string(),
        Some(v) if v <= 0.0 => "$0.00".to_string(),
        Some(v) if v >= 100.0 => format!("${:.0}", v),
        Some(v) if v >= 10.0 => format!("${:.1}", v),
        Some(v) if v >= 1.0 => format!("${:.2}", v),
        Some(v) if v >= 0.1 => format!("${:.3}", v),
        Some(v) => format!("${:.4}", v),
    }
}

/// Replace a leading `$HOME` with `~` (`shortenPath`).
pub fn shorten_path(path: &str, home: Option<&str>) -> String {
    if let Some(home) = home {
        if !home.is_empty() && (path == home || path.starts_with(&format!("{home}/"))) {
            let rest = &path[home.len()..];
            return if rest.is_empty() {
                "~/".to_string()
            } else {
                format!("~{rest}")
            };
        }
    }
    path.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wraps_greedily_to_width() {
        assert_eq!(wrap_plain_text("abcdef", 3), vec!["abc", "def"]);
        assert_eq!(wrap_plain_text("ab", 3), vec!["ab"]);
        assert_eq!(wrap_plain_text("", 3), vec![""]);
        assert_eq!(wrap_plain_text("a\tb", 3), vec!["a  ", "b"]);
    }

    #[test]
    fn wide_characters_wrap_by_display_width() {
        assert_eq!(visible_len("日本語"), 6);
        assert_eq!(wrap_plain_text("日本語", 4), vec!["日本", "語"]);
    }

    #[test]
    fn fit_line_truncates_with_ellipsis() {
        assert_eq!(fit_line("hello", 3), "he…");
        assert_eq!(fit_line("hi", 5), "hi");
        assert_eq!(fit_line("日本語", 3), "日…");
    }

    #[test]
    fn center_line_pads_symmetrically() {
        assert_eq!(center_line("ab", 6), "  ab");
    }

    #[test]
    fn currency_uses_standard_zero_precision() {
        assert_eq!(format_currency(Some(0.0)), "$0.00");
        assert_eq!(format_currency(Some(-0.01)), "$0.00");
    }
}
