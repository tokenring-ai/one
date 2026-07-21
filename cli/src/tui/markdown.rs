//! Markdown rendering for chat bodies, porting the role of Bun's
//! `markdown.ansi()`. Markdown is rendered to ANSI by `termimad`, then parsed
//! into ratatui [`Line`]s by `ansi-to-tui`, with the entry tone applied to
//! unstyled spans.

use std::cell::RefCell;

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

type SkinKey = (HexColor, HexColor, HexColor, HexColor, HexColor);

thread_local! {
    static SKIN_CACHE: RefCell<Option<(SkinKey, MadSkin)>> = const { RefCell::new(None) };
}

fn skin_key(theme: &Theme) -> SkinKey {
    (
        theme.transcript.background_color,
        theme.markdown.code_block_background_color,
        theme.markdown.code_block_text_color,
        theme.markdown.inline_code_color,
        theme.markdown.success_highlight_color,
    )
}

/// Build a termimad skin with elevated code-block surfaces (candy #14).
/// Skins are cached per thread keyed by the relevant theme markdown colors.
fn themed_skin(theme: &Theme) -> MadSkin {
    let key = skin_key(theme);
    SKIN_CACHE.with(|cell| {
        if let Some((cached_key, skin)) = cell.borrow().as_ref() {
            if *cached_key == key {
                return skin.clone();
            }
        }
        let mut skin = MadSkin::default();
        skin.set_global_bg(termimad_rgb(theme.transcript.background_color));
        let chip_bg = termimad_rgb(theme.markdown.code_block_background_color);
        let lime = termimad_rgb(theme.markdown.success_highlight_color);
        skin.code_block.set_bg(chip_bg);
        skin.code_block
            .set_fg(termimad_rgb(theme.markdown.code_block_text_color));
        skin.inline_code.set_bg(chip_bg);
        skin.inline_code
            .set_fg(termimad_rgb(theme.markdown.inline_code_color));
        skin.quote_mark.set_fg(lime);
        skin.quote_mark.set_bg(chip_bg);
        *cell.borrow_mut() = Some((key, skin.clone()));
        skin
    })
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
                let fg = match style.fg {
                    None | Some(Color::Reset) => tone,
                    Some(color) => color,
                };
                let bg = match style.bg {
                    None | Some(Color::Reset) => Some(theme.transcript.background_color.color()),
                    Some(color) => Some(color),
                };
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

#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::style::Modifier;

    #[test]
    fn markdown_uses_transcript_background_without_losing_bold() {
        let theme = Theme::material_dark();
        let lines = render_body(
            "**File** Read 3 files",
            80,
            theme.tones.success.color(),
            "",
            &theme,
        );
        let spans = lines.iter().flat_map(|line| &line.spans);

        assert!(spans
            .clone()
            .filter(|span| !span.content.is_empty())
            .all(|span| span.style.bg == Some(theme.transcript.background_color.color())));
        assert!(spans.into_iter().any(|span| {
            span.content.as_ref() == "File" && span.style.add_modifier.contains(Modifier::BOLD)
        }));
    }

    #[test]
    fn markdown_preserves_inline_code_background() {
        let theme = Theme::material_dark();
        let lines = render_body(
            "Read `a.txt`",
            80,
            theme.transcript.body_color.color(),
            "",
            &theme,
        );

        let code = lines
            .iter()
            .flat_map(|line| &line.spans)
            .find(|span| span.content.as_ref() == "a.txt")
            .expect("inline code span");
        assert_eq!(
            code.style.bg,
            Some(theme.markdown.code_block_background_color.color())
        );
    }
}
