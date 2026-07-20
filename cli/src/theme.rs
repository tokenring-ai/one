//! Terminal colour theme for the TokenRing CLI.
//!
//! The theme is a fully-runtime-configurable [`Theme`] struct, organized into
//! component groups (header, transcript, composer, status, etc.) where each
//! field names what it colours rather than how it looks. Layout options
//! (border style, accent stripes, and indent/prefix strings) live in
//! [`Layout`].
//!
//! [`Theme::material_dark`] returns the default dark, flat, Material-style
//! palette (true-black surfaces, neutral-greyscale text, and vibrant strategic
//! accents). Convert any colour to a ratatui [`Color`] via [`HexColor::color`].

use std::sync::OnceLock;

use ratatui::style::Color;

/// Whether the terminal supports 24-bit RGB (cached after first probe).
static TRUE_COLOR: OnceLock<bool> = OnceLock::new();

/// Detect true-color support from `COLORTERM` / `TERM` (candy #28).
pub fn detect_true_color() -> bool {
    if std::env::var("NO_COLOR").is_ok() {
        return false;
    }
    if std::env::var("COLORTERM")
        .map(|v| {
            let lower = v.to_lowercase();
            lower == "truecolor" || lower == "24bit"
        })
        .unwrap_or(false)
    {
        return true;
    }
    std::env::var("TERM")
        .map(|v| {
            let lower = v.to_lowercase();
            lower.contains("truecolor") || lower.contains("256color")
        })
        .unwrap_or(false)
}

/// Cached true-color probe used by [`HexColor::color`].
pub fn true_color_enabled() -> bool {
    *TRUE_COLOR.get_or_init(detect_true_color)
}

/// An RGB colour.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HexColor(pub u8, pub u8, pub u8);

impl HexColor {
    pub fn color(self) -> Color {
        if true_color_enabled() {
            Color::Rgb(self.0, self.1, self.2)
        } else {
            self.approximate_ansi()
        }
    }

    /// Map an RGB value to the nearest standard ANSI colour when true-color
    /// is unavailable.
    fn approximate_ansi(self) -> Color {
        let luminance =
            (self.0 as u32 * 299 + self.1 as u32 * 587 + self.2 as u32 * 114) / 1000;
        if luminance < 48 {
            Color::Black
        } else if luminance < 96 {
            Color::DarkGray
        } else if luminance < 160 {
            Color::Gray
        } else {
            Color::White
        }
    }
    /// Construct a HexColor from a hex string like "#RRGGBB".
    #[allow(dead_code)]
    pub fn from_html_rgb(s: &str) -> Result<Self, &'static str> {
        if s.len() != 7 || !s.starts_with('#') {
            return Err("Invalid HTML color format. Expected #RRGGBB.");
        }

        let r_char = s.get(1..3).ok_or("Missing red component")?;
        let g_char = s.get(3..5).ok_or("Missing green component")?;
        let b_char = s.get(5..7).ok_or("Missing blue component")?;

        let r = u8::from_str_radix(r_char, 16).map_err(|_| "Invalid red value")?;
        let g = u8::from_str_radix(g_char, 16).map_err(|_| "Invalid green value")?;
        let b = u8::from_str_radix(b_char, 16).map_err(|_| "Invalid blue value")?;

        Ok(HexColor(r, g, b))
    }
}

// ---------------------------------------------------------------------------
// Surface / panel colour groups
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component colour groups — each field names what it colours, not how it looks.
// ---------------------------------------------------------------------------

/// Top header bar (agent label, branding).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HeaderColors {
    pub color: HexColor,
    pub background_color: HexColor,
}

/// Scrollable chat transcript.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TranscriptColors {
    pub background_color: HexColor,
    pub body_color: HexColor,
}

/// Message composer / input surface.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ComposerColors {
    pub background_color: HexColor,
    pub text_color: HexColor,
    pub stripe_color: HexColor,
}

/// Bottom status bar and connection indicator.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct StatusColors {
    pub background_color: HexColor,
    pub flat_text_color: HexColor,
    pub inverted_text_color: HexColor,
    pub inverted_background_color: HexColor,
    pub separator_color: HexColor,
    pub segment_text_color: HexColor,
    pub connection_good_color: HexColor,
    pub connection_warning_color: HexColor,
    pub connection_error_color: HexColor,
    pub connection_unknown_color: HexColor,
}

/// Quick-reply chips above the composer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct QuickReplyColors {
    pub label_color: HexColor,
    pub chip_text_color: HexColor,
    pub chip_background_color: HexColor,
    pub chip_border_color: HexColor,
    pub selected_badge_color: HexColor,
}

/// Hint line beneath the composer.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HintColors {
    pub background_color: HexColor,
}

/// Help overlay panel.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HelpColors {
    pub background_color: HexColor,
    pub border_color: HexColor,
    pub title_color: HexColor,
    pub key_color: HexColor,
    pub description_color: HexColor,
}

/// Diff line colouring.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct DiffColors {
    pub added_color: HexColor,
    pub removed_color: HexColor,
    pub context_color: HexColor,
    pub unchanged_color: HexColor,
}

/// Markdown / termimad rendering.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarkdownColors {
    pub code_block_text_color: HexColor,
    pub code_block_background_color: HexColor,
    pub inline_code_color: HexColor,
    pub success_highlight_color: HexColor,
}

/// App-wide screen background fill.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AppColors {
    pub background_color: HexColor,
}

/// Generic panel surfaces (questions, pickers, previews).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PanelColors {
    pub background_color: HexColor,
    pub border_color: HexColor,
    pub subtle_border_color: HexColor,
    pub title_color: HexColor,
    pub heading_color: HexColor,
    pub warning_color: HexColor,
    pub stripe_color: HexColor,
}

/// List / picker selection states.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PickerColors {
    pub background_color: HexColor,
    pub chip_background_color: HexColor,
    pub chip_border_color: HexColor,
    pub title_color: HexColor,
    pub item_text_color: HexColor,
    pub highlighted_color: HexColor,
    pub match_highlight_color: HexColor,
}

/// ASCII shadow beneath framed panels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ShadowColors {
    pub fill_color: HexColor,
    pub background_color: HexColor,
}

/// Error illustration chrome.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ErrorColors {
    pub frame_color: HexColor,
    pub icon_color: HexColor,
}

/// Loading screen.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LoadingColors {
    pub background_color: HexColor,
    pub banner_background_color: HexColor,
    pub text_color: HexColor,
}

/// Agent-selection screen.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AgentSelectionColors {
    pub background_color: HexColor,
    pub banner_color: HexColor,
    pub banner_background_color: HexColor,
    pub chip_background_color: HexColor,
    pub item_text_color: HexColor,
    pub highlighted_color: HexColor,
}

/// Confirmation-dialog colours (mirrors `pkg/cli/theme.ts`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ConfirmationColors {
    pub yes_color: HexColor,
    pub no_color: HexColor,
    pub inactive_color: HexColor,
    pub timeout_color: HexColor,
    pub ask_message_color: HexColor,
}

/// Semantic chat tones — each maps to a [`Tone`] variant.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ToneColors {
    pub chat: HexColor,
    pub reasoning: HexColor,
    pub info: HexColor,
    pub warning: HexColor,
    pub error: HexColor,
    pub input: HexColor,
    pub success: HexColor,
    pub muted: HexColor,
    pub ask: HexColor,
    pub reset: HexColor,
    pub abort: HexColor,
    pub tree_partial: HexColor,
}

/// Tree / checkbox selection states.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SelectionColors {
    pub highlighted: HexColor,
    pub checked: HexColor,
    pub partial: HexColor,
    pub unselected: HexColor,
}

// ---------------------------------------------------------------------------
// Legacy generic colour groups (commented out — replaced by component groups)
// ---------------------------------------------------------------------------
//
// #[derive(Clone, Copy, Debug, PartialEq, Eq)]
// pub struct Surfaces {
//     pub bg: HexColor,
//     pub header: HexColor,
//     pub panel: HexColor,
//     pub input: HexColor,
//     pub chip: HexColor,
// }
//
// #[derive(Clone, Copy, Debug, PartialEq, Eq)]
// pub struct BorderColors {
//     pub default: HexColor,
//     pub subtle: HexColor,
//     pub chip: HexColor,
//     pub title: HexColor,
// }
//
// #[derive(Clone, Copy, Debug, PartialEq, Eq)]
// pub struct TextColors {
//     pub primary: HexColor,
//     pub header: HexColor,
//     pub chip: HexColor,
//     pub secondary: HexColor,
//     pub muted: HexColor,
//     pub subtle: HexColor,
//     pub faint: HexColor,
// }
//
// #[derive(Clone, Copy, Debug, PartialEq, Eq)]
// pub struct Accents {
//     pub accent: HexColor,
//     pub pink: HexColor,
//     pub blue: HexColor,
//     pub warning: HexColor,
//     pub success: HexColor,
//     pub error: HexColor,
// }
//
// #[derive(Clone, Copy, Debug, PartialEq, Eq)]
// pub struct ScreenColors {
//     pub loading_bg: HexColor,
//     pub loading_banner_bg: HexColor,
//     pub loading_text: HexColor,
//     pub selection_banner: HexColor,
//     pub selection_banner_bg: HexColor,
//     pub question_banner: HexColor,
//     pub question_banner_bg: HexColor,
// }

/// How flat / framed the chrome should look.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PanelStyle {
    /// Material-style flat panels: surface fill, thin dividers, and optional
    /// accent stripes instead of full ASCII frames.
    Flat,
    /// Legacy framed boxes (full ASCII border on every panel).
    Framed,
}

/// Status-bar presentation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StatusStyle {
    /// Flat footer: faint text directly on the background.
    Flat,
    /// Inverted legacy bar: dark text on a bright background.
    Inverted,
}

/// Layout / chrome configurables (prefixes, panel style, accent stripes).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Layout {
    /// Flat vs. framed panel rendering.
    pub panel_style: PanelStyle,
    /// Status-bar presentation.
    pub status_style: StatusStyle,
    /// Draw a coloured accent stripe down the left edge of the composer.
    pub composer_stripe: bool,
    /// Prefix rendered before transcript entry titles.
    pub header_prefix: String,
    /// Indentation prefix rendered before body / wrapped lines.
    pub text_indent: String,
    /// Character width of [`Layout::text_indent`].
    pub text_indent_len: usize,
    /// Minimum terminal width (cols) before applying 1-char horizontal padding.
    pub pad_width_min: u16,
    /// Minimum terminal height (rows) before applying 1-char vertical padding.
    pub pad_height_min: u16,
    /// Metadata separator between status/hint segments (candy #29).
    pub separator: String,
}

impl Default for Layout {
    fn default() -> Self {
        Self::material_dark()
    }
}

impl Layout {
    /// Default Material-dark layout strings & chrome flags.
    pub fn material_dark() -> Self {
        Self {
            panel_style: PanelStyle::Flat,
            status_style: StatusStyle::Inverted,
            composer_stripe: true,
            header_prefix: " · ".to_string(),
            text_indent: "   ".to_string(),
            text_indent_len: 3,
            pad_width_min: 60,
            pad_height_min: 20,
            separator: " · ".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/// The full, runtime-configurable TokenRing CLI theme.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Theme {
    pub app: AppColors,
    pub header: HeaderColors,
    pub transcript: TranscriptColors,
    pub composer: ComposerColors,
    pub status: StatusColors,
    pub hint: HintColors,
    pub quick_reply: QuickReplyColors,
    pub help: HelpColors,
    pub diff: DiffColors,
    pub markdown: MarkdownColors,
    pub panel: PanelColors,
    pub picker: PickerColors,
    pub shadow: ShadowColors,
    pub error: ErrorColors,
    pub loading: LoadingColors,
    pub agent_selection: AgentSelectionColors,
    pub confirmation: ConfirmationColors,
    pub tones: ToneColors,
    pub selection: SelectionColors,
    pub layout: Layout,
}

impl Default for Theme {
    fn default() -> Self {
        Self::material_dark()
    }
}

impl Theme {
    /// The default flat, Material-dark theme — mirrors the
    /// `tokenring_one_assistant_terminal.html` reference.
    pub fn material_dark() -> Self {
        let blue = HexColor(0x38, 0xbd, 0xf8);
        let pink = HexColor(0xf4, 0x72, 0xb6);
        let warning = HexColor(0xfb, 0xbf, 0x24);
        let success = HexColor(0x34, 0xd3, 0x99);
        let error = HexColor(0xf8, 0x71, 0x71);
        let primary_text = HexColor(0xf5, 0xf5, 0xf5);
        let header_text = HexColor(0xff, 0xff, 0xff);
        let chip_text = HexColor(0xe5, 0xe5, 0xe5);
        let secondary_text = HexColor(0xa3, 0xa3, 0xa3);
        let muted_text = HexColor(0xa0, 0xa0, 0xa0);
        let faint_text = HexColor(0x77, 0x77, 0x77);
        let app_bg = HexColor(0x0a, 0x0a, 0x0a);
        let panel_bg = HexColor(0x17, 0x17, 0x17);
        let input_bg = HexColor(0x12, 0x12, 0x12);
        let chip_bg = HexColor(0x26, 0x26, 0x26);
        let border_default = HexColor(0x26, 0x26, 0x26);
        let border_subtle = HexColor(0x1c, 0x1c, 0x1c);
        let border_chip = HexColor(0x40, 0x40, 0x40);

        Self {
            app: AppColors {
                background_color: app_bg,
            },
            header: HeaderColors {
                color: header_text,
                background_color: app_bg,
            },
            transcript: TranscriptColors {
                background_color: app_bg,
                body_color: primary_text,
            },
            composer: ComposerColors {
                background_color: input_bg,
                text_color: primary_text,
                stripe_color: blue,
            },
            status: StatusColors {
                background_color: app_bg,
                flat_text_color: faint_text,
                inverted_text_color: primary_text,
                inverted_background_color: panel_bg,
                separator_color: faint_text,
                segment_text_color: secondary_text,
                connection_good_color: success,
                connection_warning_color: warning,
                connection_error_color: error,
                connection_unknown_color: muted_text,
            },
            hint: HintColors {
                background_color: app_bg,
            },
            quick_reply: QuickReplyColors {
                label_color: muted_text,
                chip_text_color: chip_text,
                chip_background_color: chip_bg,
                chip_border_color: border_chip,
                selected_badge_color: pink,
            },
            help: HelpColors {
                background_color: panel_bg,
                border_color: pink,
                title_color: pink,
                key_color: blue,
                description_color: secondary_text,
            },
            diff: DiffColors {
                added_color: success,
                removed_color: error,
                context_color: blue,
                unchanged_color: secondary_text,
            },
            markdown: MarkdownColors {
                code_block_text_color: primary_text,
                code_block_background_color: chip_bg,
                inline_code_color: blue,
                success_highlight_color: success,
            },
            panel: PanelColors {
                background_color: panel_bg,
                border_color: border_default,
                subtle_border_color: border_subtle,
                title_color: primary_text,
                heading_color: pink,
                warning_color: warning,
                stripe_color: pink,
            },
            picker: PickerColors {
                background_color: panel_bg,
                chip_background_color: chip_bg,
                chip_border_color: border_chip,
                title_color: primary_text,
                item_text_color: secondary_text,
                highlighted_color: blue,
                match_highlight_color: blue,
            },
            shadow: ShadowColors {
                fill_color: faint_text,
                background_color: app_bg,
            },
            error: ErrorColors {
                frame_color: error,
                icon_color: warning,
            },
            loading: LoadingColors {
                background_color: app_bg,
                banner_background_color: panel_bg,
                text_color: primary_text,
            },
            agent_selection: AgentSelectionColors {
                background_color: app_bg,
                banner_color: header_text,
                banner_background_color: panel_bg,
                chip_background_color: chip_bg,
                item_text_color: secondary_text,
                highlighted_color: blue,
            },
            confirmation: ConfirmationColors {
                yes_color: HexColor(0x66, 0xbb, 0x6a),
                no_color: HexColor(0xef, 0x53, 0x50),
                inactive_color: HexColor(0x9e, 0x9e, 0x9e),
                timeout_color: HexColor(0xff, 0xeb, 0x3b),
                ask_message_color: HexColor(0x00, 0xbc, 0xd4),
            },
            tones: ToneColors {
                chat: primary_text,
                reasoning: muted_text,
                info: blue,
                warning,
                error,
                input: blue,
                success,
                muted: muted_text,
                ask: pink,
                reset: pink,
                abort: error,
                tree_partial: warning,
            },
            selection: SelectionColors {
                highlighted: blue,
                checked: success,
                partial: warning,
                unselected: muted_text,
            },
            layout: Layout::material_dark(),
        }
    }

    /// Light framed theme preset (nice-to-have #2).
    pub fn framed_light() -> Self {
        let mut theme = Self::material_dark();
        let app_bg = HexColor(0xf5, 0xf5, 0xf5);
        let panel_bg = HexColor(0xff, 0xff, 0xff);
        let input_bg = HexColor(0xfa, 0xfa, 0xfa);
        let chip_bg = HexColor(0xee, 0xee, 0xee);
        let primary_text = HexColor(0x17, 0x17, 0x17);
        let chip_text = HexColor(0x26, 0x26, 0x26);
        let secondary_text = HexColor(0x52, 0x52, 0x52);
        let muted_text = HexColor(0x73, 0x73, 0x73);
        let faint_text = HexColor(0xcb, 0xcb, 0xcb);
        let border_default = HexColor(0xd4, 0xd4, 0xd4);
        let border_subtle = HexColor(0xe5, 0xe5, 0xe5);
        let border_chip = HexColor(0xcb, 0xcb, 0xcb);

        theme.app.background_color = app_bg;
        theme.header.background_color = app_bg;
        theme.transcript.background_color = app_bg;
        theme.transcript.body_color = primary_text;
        theme.composer.background_color = input_bg;
        theme.composer.text_color = primary_text;
        theme.status.background_color = app_bg;
        theme.status.flat_text_color = faint_text;
        theme.status.inverted_text_color = primary_text;
        theme.status.inverted_background_color = panel_bg;
        theme.status.separator_color = faint_text;
        theme.status.segment_text_color = secondary_text;
        theme.hint.background_color = app_bg;
        theme.quick_reply.chip_text_color = chip_text;
        theme.quick_reply.chip_background_color = chip_bg;
        theme.quick_reply.chip_border_color = border_chip;
        theme.help.background_color = panel_bg;
        theme.diff.unchanged_color = secondary_text;
        theme.markdown.code_block_text_color = primary_text;
        theme.markdown.code_block_background_color = chip_bg;
        theme.panel.background_color = panel_bg;
        theme.panel.border_color = border_default;
        theme.panel.subtle_border_color = border_subtle;
        theme.panel.title_color = primary_text;
        theme.picker.background_color = panel_bg;
        theme.picker.chip_background_color = chip_bg;
        theme.picker.chip_border_color = border_chip;
        theme.picker.title_color = primary_text;
        theme.picker.item_text_color = secondary_text;
        theme.shadow.background_color = app_bg;
        theme.loading.background_color = app_bg;
        theme.loading.banner_background_color = panel_bg;
        theme.loading.text_color = primary_text;
        theme.agent_selection.background_color = app_bg;
        theme.agent_selection.banner_background_color = panel_bg;
        theme.tones.chat = primary_text;
        theme.tones.reasoning = muted_text;
        theme.tones.muted = muted_text;
        theme.layout.panel_style = PanelStyle::Framed;
        theme.layout.status_style = StatusStyle::Flat;
        theme
    }

    /// Parse a theme name from CLI/config (nice-to-have #2).
    pub fn from_name(name: &str) -> Self {
        match name.trim().to_ascii_lowercase().replace('_', "-").as_str() {
            "framed-light" | "framedlight" | "light" => Self::framed_light(),
            "material-dark" | "materialdark" | "dark" | "default" => Self::material_dark(),
            other => {
                let _ = other;
                Self::material_dark()
            }
        }
    }

    /// Apply a panel-style override from CLI/config.
    pub fn with_panel_style(mut self, name: &str) -> Self {
        if let Some(style) = PanelStyle::from_name(name) {
            self.layout.panel_style = style;
        }
        self
    }
}

impl PanelStyle {
    pub fn from_name(name: &str) -> Option<Self> {
        match name.trim().to_ascii_lowercase().as_str() {
            "flat" => Some(PanelStyle::Flat),
            "framed" => Some(PanelStyle::Framed),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Tone
// ---------------------------------------------------------------------------

/// Rendering tones (mirrors the TypeScript `ChatRenderUtils.TONE_COLORS`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)] // Full tone palette mirrors the TS renderer before each is wired.
pub enum Tone {
    Chat,
    Reasoning,
    Info,
    Warning,
    Error,
    Input,
    Success,
    Muted,
    Ask,
    Reset,
    Abort,
    TreePartial,
}

impl Tone {
    /// Resolve this tone to a [`Color`] using the supplied theme.
    pub fn color(self, theme: &Theme) -> Color {
        let c = match self {
            Tone::Chat => theme.tones.chat,
            Tone::Reasoning => theme.tones.reasoning,
            Tone::Info => theme.tones.info,
            Tone::Warning => theme.tones.warning,
            Tone::Error => theme.tones.error,
            Tone::Input => theme.tones.input,
            Tone::Success => theme.tones.success,
            Tone::Muted => theme.tones.muted,
            Tone::Ask => theme.tones.ask,
            Tone::Reset => theme.tones.reset,
            Tone::Abort => theme.tones.abort,
            Tone::TreePartial => theme.tones.tree_partial,
        };
        c.color()
    }
}
