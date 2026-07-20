//! Pure layout primitives shared by every drawable component: responsive
//! spacing, Material flat/framed surface blocks, composer chrome sizing, and
//! string truncation. All functions here are deterministic and unit-tested.

use ratatui::{
    layout::Rect,
    widgets::{Block, BorderType, Borders, Padding},
};

use crate::theme::PanelStyle;
use crate::theme::Theme;
use crate::tui::text::fit_line;

const SPACING_NORMAL_WIDTH: u16 = 80;
const SPACING_NORMAL_HEIGHT: u16 = 24;
const SPACING_VERY_SMALL_WIDTH: u16 = 40;
const SPACING_VERY_SMALL_HEIGHT: u16 = 12;
const PAD: u16 = 1;
const GAP: u16 = 1;

/// Responsive horizontal/vertical padding + inter-section gap derived from the
/// available area.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct UiSpacing {
    pub(super) pad_h: u16,
    pub(super) pad_v: u16,
    pub(super) gap: u16,
}

impl UiSpacing {
    pub(super) fn block_padding(self) -> Padding {
        Padding::new(self.pad_h, self.pad_h, self.pad_v, self.pad_v)
    }

    /// Transcript block padding; the top margin is provided by the header bar.
    pub(super) fn transcript_block_padding(self) -> Padding {
        Padding::new(self.pad_h, self.pad_h, 0, self.pad_v)
    }

    pub(super) fn horizontal_padding(self) -> Padding {
        Padding::horizontal(self.pad_h)
    }
}

pub(super) fn ui_spacing(area: Rect) -> UiSpacing {
    let wide = area.width >= SPACING_NORMAL_WIDTH;
    let tall = area.height >= SPACING_NORMAL_HEIGHT;
    let roomy_v = area.height >= SPACING_VERY_SMALL_HEIGHT;
    let roomy_h = area.width >= SPACING_VERY_SMALL_WIDTH;
    UiSpacing {
        pad_h: if roomy_h { PAD } else { 0 },
        pad_v: if roomy_v && wide { PAD } else { 0 },
        gap: if tall && wide { GAP } else { 0 },
    }
}

/// Truncate `text` to `width` visible columns, appending an ellipsis when cut.
pub(super) fn truncate(text: &str, width: usize) -> String {
    fit_line(text, width)
}

pub(super) fn composer_text_width(area: Rect, theme: &Theme, spacing: UiSpacing) -> usize {
    area.width
        .saturating_sub(spacing.pad_h.saturating_mul(2))
        .saturating_sub(surface_horizontal_chrome(theme))
        .max(1) as usize
}

pub(super) fn composer_surface_height(content_lines: u16, theme: &Theme, spacing: UiSpacing) -> u16 {
    content_lines
        .max(1)
        .saturating_add(spacing.pad_v.saturating_mul(2))
        .saturating_add(surface_vertical_chrome(theme))
}

pub(super) fn surface_horizontal_chrome(theme: &Theme) -> u16 {
    match theme.layout.panel_style {
        PanelStyle::Flat => {
            if theme.layout.composer_stripe {
                1
            } else {
                0
            }
        }
        PanelStyle::Framed => 2,
    }
}

pub(super) fn surface_vertical_chrome(theme: &Theme) -> u16 {
    match theme.layout.panel_style {
        PanelStyle::Flat => 0,
        PanelStyle::Framed => 2,
    }
}

/// Resolve a stripe colour, honouring the `composer_stripe` enable flag.
pub(super) fn stripe_color(theme: &Theme, color: crate::theme::HexColor) -> Option<crate::theme::HexColor> {
    if theme.layout.composer_stripe {
        Some(color)
    } else {
        None
    }
}

/// Build a flat (Material) or framed (legacy) surface block.
///
/// - `Flat`: fills the area with `bg` and, if `stripe` is set, draws a thick
///   accent stripe down the left edge (Material accent-bar).
/// - `Framed`: a full ASCII border in the theme's default border colour.
pub(super) fn surface_block(
    theme: &Theme,
    bg: crate::theme::HexColor,
    stripe: Option<crate::theme::HexColor>,
    padding: Padding,
) -> Block<'static> {
    use ratatui::style::Style;

    let mut block = Block::default()
        .style(Style::default().bg(bg.color()))
        .padding(padding);
    match theme.layout.panel_style {
        PanelStyle::Flat => {
            if let Some(col) = stripe {
                block = block
                    .borders(Borders::LEFT)
                    .border_type(BorderType::Thick)
                    .border_style(Style::default().fg(col.color()));
            }
        }
        PanelStyle::Framed => {
            block = block
                .borders(Borders::ALL)
                .border_type(BorderType::Plain)
                .border_style(Style::default().fg(theme.panel.border_color.color()));
        }
    }
    block
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(width: u16, height: u16) -> Rect {
        Rect {
            x: 0,
            y: 0,
            width,
            height,
        }
    }

    #[test]
    fn spacing_collapses_gap_before_padding() {
        assert_eq!(
            ui_spacing(rect(100, 30)),
            UiSpacing {
                pad_h: 1,
                pad_v: 1,
                gap: 1
            }
        );
        assert_eq!(
            ui_spacing(rect(79, 30)),
            UiSpacing {
                pad_h: 1,
                pad_v: 0,
                gap: 0
            }
        );
        assert_eq!(
            ui_spacing(rect(39, 30)),
            UiSpacing {
                pad_h: 0,
                pad_v: 0,
                gap: 0
            }
        );
    }

    #[test]
    fn truncate_preserves_short_strings() {
        assert_eq!(truncate("hello", 10), "hello");
        assert_eq!(truncate("", 5), "");
    }

    #[test]
    fn truncate_ellipsizes_overflows() {
        assert_eq!(truncate("hello world", 8), "hello w…");
        assert_eq!(truncate("ab", 1), "…");
        assert_eq!(truncate("abc", 0), "");
    }
}
