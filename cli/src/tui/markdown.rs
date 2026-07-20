//! Markdown rendering for chat bodies, porting the role of Bun's
//! `markdown.ansi()`. Markdown is rendered to ANSI by `termimad`, then parsed
//! into ratatui [`Line`]s by `ansi-to-tui`, with the entry tone applied to
//! unstyled spans.

use ansi_to_tui::IntoText;
use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};
use termimad::{FmtText, MadSkin};

use crate::theme::{HexColor, Theme};

fn termimad_rgb(hex: HexColor) -> termimad::crossterm::style::Color {
    termimad::crossterm::style::Color::Rgb {
        r: hex.0,
        g: hex.1,
        b: hex.2,
    }
}

/// Build a termimad skin with elevated code-block surfaces (candy #14).
fn themed_skin(theme: &Theme) -> MadSkin {
    let mut skin = MadSkin::default();
    let chip_bg = termimad_rgb(theme.markdown.code_block_background_color);
    let lime = termimad_rgb(theme.markdown.success_highlight_color);
    skin.code_block.set_bg(chip_bg);
    skin.code_block.set_fg(termimad_rgb(theme.markdown.code_block_text_color));
    skin.inline_code.set_bg(chip_bg);
    skin.inline_code.set_fg(termimad_rgb(theme.markdown.inline_code_color));
    skin.quote_mark.set_fg(lime);
    skin.quote_mark.set_bg(chip_bg);
    skin
}

/// Render a markdown body to indented, tone-tinted lines.
///
/// `indent` is the leading whitespace applied to every line (configurable via
/// the theme layout).
pub fn render_body(
    markdown: &str,
    width: usize,
    tone: Color,
    indent: &str,
    theme: &Theme,
) -> Vec<Line<'static>> {
    let width = width.max(3);
    let skin = themed_skin(theme);
    let fmt = FmtText::from(&skin, markdown, Some(width));
    let ansi = format!("{fmt}");

    let lines = match ansi.into_text() {
        Ok(text) => text.lines,
        Err(_) => {
            // Fallback: plain, indented lines.
            return markdown
                .lines()
                .map(|l| {
                    Line::from(vec![Span::styled(
                        format!("{indent}{l}"),
                        Style::default().fg(tone),
                    )])
                })
                .collect();
        }
    };

    lines
        .into_iter()
        .map(|mut line| {
            let mut spans: Vec<Span<'static>> =
                vec![Span::styled(indent.to_string(), Style::default().fg(tone))];
            for span in line.spans.drain(..) {
                let style = span.style;
                let fg = style.fg.unwrap_or(tone);
                let bg = style.bg;
                spans.push(Span::styled(
                    span.content.into_owned(),
                    Style {
                        fg: Some(fg),
                        bg,
                        add_modifier: style.add_modifier,
                        ..style
                    },
                ));
            }
            Line::from(spans)
        })
        .collect()
}
