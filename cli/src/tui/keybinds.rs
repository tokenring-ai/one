//! Keybind configuration
//!
//! All keybindings live declaratively in a [`Keybinds`] struct rather than
//! being scattered across `match` arms. Each binding is parsed from a
//! spec string (e.g. `"ctrl+x"`, `"pageup,ctrl+alt+b"`, `"<leader>q"`). 
//! The leader key (`ctrl+x` by default) prefixes chord
//! bindings: press the leader, then within [`Keybinds::leader_timeout`] press
//! the action key.

use std::time::Duration;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

/// Default leader timeout (ms)
pub const DEFAULT_LEADER_TIMEOUT: Duration = Duration::from_millis(2000);

/// A single key combination: modifiers + key code.
///
/// Character-key comparisons are case-insensitive so that a terminal reporting
/// `Shift+A` as `Char('A')` matches a spec of `shift+a`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeyBind {
    pub modifiers: KeyModifiers,
    pub code: KeyCode,
}

impl KeyBind {
    /// Parse a single key token (e.g. `"ctrl+x"`, `"shift+return"`).
    /// Returns `None` for `"none"` / empty / unparseable tokens.
    pub fn parse(spec: &str) -> Option<Self> {
        let spec = spec.trim();
        if spec.is_empty() || spec.eq_ignore_ascii_case("none") || spec == "false" {
            return None;
        }
        let mut modifiers = KeyModifiers::NONE;
        let mut key_str: Option<&str> = None;
        for part in spec.split('+') {
            let p = part.trim();
            match p.to_ascii_lowercase().as_str() {
                "ctrl" | "control" => modifiers |= KeyModifiers::CONTROL,
                "alt" | "option" | "opt" | "meta" => modifiers |= KeyModifiers::ALT,
                "shift" => modifiers |= KeyModifiers::SHIFT,
                "super" | "cmd" | "command" | "win" | "windows" => modifiers |= KeyModifiers::SUPER,
                _ => key_str = Some(p),
            }
        }
        let code = parse_key_code(key_str?)?;
        Some(Self { modifiers, code })
    }

    /// Whether a crossterm [`KeyEvent`] matches this bind (ignoring
    /// `KeyEventKind` / `KeyEventState`, and char case).
    pub fn matches(&self, event: KeyEvent) -> bool {
        self.modifiers == event.modifiers && key_code_eq(&self.code, &event.code)
    }

    /// Friendly label for hint lines (e.g. `"Ctrl-x"`, `"Alt-f"`).
    pub fn friendly_label(&self) -> String {
        let mut out = String::new();
        if self.modifiers.contains(KeyModifiers::CONTROL) {
            out.push_str("Ctrl-");
        }
        if self.modifiers.contains(KeyModifiers::ALT) {
            out.push_str("Alt-");
        }
        if self.modifiers.contains(KeyModifiers::SHIFT) {
            out.push_str("Shift-");
        }
        if self.modifiers.contains(KeyModifiers::SUPER) {
            out.push_str("Super-");
        }
        match &self.code {
            KeyCode::Char(c) => out.push(c.to_ascii_lowercase()),
            other => out.push_str(&code_label(other)),
        }
        out
    }

    /// A short terminal-style label (e.g. `"C-x"`, `"M-a"`, `"PgUp"`, `"Ret"`).
    pub fn label(&self) -> String {
        let mut out = String::new();
        if self.modifiers.contains(KeyModifiers::CONTROL) {
            out.push_str("C-");
        }
        if self.modifiers.contains(KeyModifiers::ALT) {
            out.push_str("M-");
        }
        if self.modifiers.contains(KeyModifiers::SHIFT) {
            out.push_str("S-");
        }
        if self.modifiers.contains(KeyModifiers::SUPER) {
            out.push_str("D-");
        }
        out.push_str(&code_label(&self.code));
        out
    }
}

/// A set of alternative bindings for a single action.
///
/// `direct` bindings fire immediately. `leader` bindings fire only after the
/// leader key has been pressed (a two-key chord).
#[derive(Clone, Debug, Default)]
pub struct KeyCombo {
    pub direct: Vec<KeyBind>,
    pub leader: Vec<KeyBind>,
}

impl KeyCombo {
    /// Parse a comma-separated key spec into direct/leader alternatives.
    /// `<leader>X` tokens are routed to [`KeyCombo::leader`]; everything else to
    /// [`KeyCombo::direct`] (a bare repeat of the leader key itself is skipped
    /// so it never fires directly).
    pub fn parse(spec: &str, leader: &KeyBind) -> Self {
        let mut combo = Self::default();
        for raw in spec.split(',') {
            let token = raw.trim();
            if token.is_empty() || token.eq_ignore_ascii_case("none") || token == "false" {
                continue;
            }
            if let Some(rest) = token.strip_prefix("<leader>") {
                if let Some(kb) = KeyBind::parse(rest.trim()) {
                    combo.leader.push(kb);
                }
                continue;
            }
            if let Some(kb) = KeyBind::parse(token) {
                if &kb != leader {
                    combo.direct.push(kb);
                }
            }
        }
        combo
    }

    /// Whether `key` matches a direct (immediate) binding.
    pub fn matches(&self, key: KeyEvent) -> bool {
        self.direct.iter().any(|b| b.matches(key))
    }

    /// Whether `key` matches a leader-gated binding.
    pub fn matches_leader(&self, key: KeyEvent) -> bool {
        self.leader.iter().any(|b| b.matches(key))
    }

    /// Label for the first direct binding (help overlay).
    pub fn first_label(&self) -> String {
        self.direct
            .first()
            .map(|b| b.label())
            .or_else(|| self.leader.first().map(|b| b.label()))
            .unwrap_or_else(|| "?".to_string())
    }
}

/// The full keybind configuration
#[derive(Clone, Debug)]
pub struct Keybinds {
    /// The leader key (default `ctrl+x`).
    pub leader: KeyBind,
    /// How long to wait for the second key of a leader chord.
    pub leader_timeout: Duration,

    // --- App ---
    pub app_exit: KeyCombo,
    pub app_debug: KeyCombo,
    pub app_console: KeyCombo,
    pub command_list: KeyCombo,

    // --- Sessions ---
    pub session_interrupt: KeyCombo,

    // --- Agent / model ---
    pub agent_list: KeyCombo,
    pub agent_cycle: KeyCombo,
    pub agent_cycle_reverse: KeyCombo,
    pub model_list: KeyCombo,
    pub model_favorite_toggle: KeyCombo,
    pub model_provider_list: KeyCombo,
    pub model_cycle_recent: KeyCombo,
    pub model_cycle_recent_reverse: KeyCombo,
    pub variant_cycle: KeyCombo,

    // --- Messages / transcript ---
    pub messages_page_up: KeyCombo,
    pub messages_page_down: KeyCombo,
    pub messages_line_up: KeyCombo,
    pub messages_line_down: KeyCombo,
    pub messages_half_page_up: KeyCombo,
    pub messages_half_page_down: KeyCombo,
    pub messages_first: KeyCombo,
    pub messages_last: KeyCombo,
    pub messages_copy: KeyCombo,
    pub messages_toggle_conceal: KeyCombo,

    // --- Views ---
    pub sidebar_toggle: KeyCombo,
    pub status_view: KeyCombo,
    pub theme_list: KeyCombo,
    pub tips_toggle: KeyCombo,
    pub which_key_toggle: KeyCombo,

    // --- Input editing ---
    pub input_submit: KeyCombo,
    pub input_newline: KeyCombo,
    pub input_clear: KeyCombo,
    pub input_backspace: KeyCombo,
    pub input_delete: KeyCombo,
    pub input_move_left: KeyCombo,
    pub input_move_right: KeyCombo,
    pub input_move_up: KeyCombo,
    pub input_move_down: KeyCombo,
    pub input_line_home: KeyCombo,
    pub input_line_end: KeyCombo,
    pub input_delete_to_line_end: KeyCombo,
    pub input_delete_to_line_start: KeyCombo,
    pub input_delete_line: KeyCombo,
    pub input_word_forward: KeyCombo,
    pub input_word_backward: KeyCombo,
    pub input_delete_word_forward: KeyCombo,
    pub input_delete_word_backward: KeyCombo,
    pub input_undo: KeyCombo,
    pub input_redo: KeyCombo,
    pub input_select_all: KeyCombo,

    // --- History ---
    pub history_previous: KeyCombo,
    pub history_next: KeyCombo,

    // --- Dialog / picker ---
    pub dialog_select_prev: KeyCombo,
    pub dialog_select_next: KeyCombo,
    pub dialog_select_page_up: KeyCombo,
    pub dialog_select_page_down: KeyCombo,
    pub dialog_select_home: KeyCombo,
    pub dialog_select_end: KeyCombo,
    pub dialog_select_submit: KeyCombo,

    // --- Prompt autocomplete ---
    pub prompt_autocomplete_prev: KeyCombo,
    pub prompt_autocomplete_next: KeyCombo,
    pub prompt_autocomplete_hide: KeyCombo,
    pub prompt_autocomplete_select: KeyCombo,
    pub prompt_autocomplete_complete: KeyCombo,

    /// Open the optional-question picker.
    pub cli_optional_picker: KeyCombo,
    /// Open the tools picker (runs `/tools select`).
    pub cli_tools_select: KeyCombo,
}

impl Default for Keybinds {
    fn default() -> Self {
        Self::defaults()
    }
}

impl Keybinds {
    /// Default keybinds
    pub fn defaults() -> Self {
        let leader = KeyBind::parse("ctrl+x").expect("default leader key parses");
        let p = |spec: &str| KeyCombo::parse(spec, &leader);

        Self {
            leader: leader.clone(),
            leader_timeout: DEFAULT_LEADER_TIMEOUT,

            // --- App ---
            app_exit: p("ctrl+d,<leader>q"),
            app_debug: p("none"),
            app_console: p("none"),
            command_list: p("ctrl+p"),

            // --- Sessions ---
            session_interrupt: p("escape"),

            // --- Agent / model ---
            agent_list: p("<leader>a"),
            agent_cycle: p("tab"),
            agent_cycle_reverse: p("shift+tab"),
            model_list: p("<leader>m"),
            model_favorite_toggle: p("ctrl+f"),
            model_provider_list: p("ctrl+a"),
            model_cycle_recent: p("f2"),
            model_cycle_recent_reverse: p("shift+f2"),
            variant_cycle: p("ctrl+t"),

            // --- Messages / transcript ---
            messages_page_up: p("pageup,ctrl+alt+b"),
            messages_page_down: p("pagedown,ctrl+alt+f"),
            messages_line_up: p("ctrl+alt+y"),
            messages_line_down: p("ctrl+alt+e"),
            messages_half_page_up: p("ctrl+alt+u"),
            messages_half_page_down: p("ctrl+alt+d"),
            messages_first: p("ctrl+g,home"),
            messages_last: p("ctrl+alt+g,end"),
            messages_copy: p("<leader>y"),
            messages_toggle_conceal: p("<leader>v"),

            // --- Views ---
            sidebar_toggle: p("<leader>b"),
            status_view: p("<leader>s"),
            theme_list: p("<leader>t"),
            tips_toggle: p("<leader>h"),
            which_key_toggle: p("ctrl+alt+k"),

            // --- Input editing ---
            input_submit: p("return"),
            input_newline: p("shift+return,ctrl+return,alt+return,ctrl+j"),
            input_clear: p("none"),
            input_backspace: p("backspace,shift+backspace"),
            input_delete: p("ctrl+d,delete,shift+delete"),
            input_move_left: p("left,ctrl+b"),
            input_move_right: p("right,ctrl+f"),
            input_move_up: p("up"),
            input_move_down: p("down"),
            input_line_home: p("ctrl+a"),
            input_line_end: p("ctrl+e"),
            input_delete_to_line_end: p("ctrl+k"),
            input_delete_to_line_start: p("ctrl+u"),
            input_delete_line: p("ctrl+shift+d"),
            input_word_forward: p("alt+f,alt+right,ctrl+right"),
            input_word_backward: p("alt+b,alt+left,ctrl+left"),
            input_delete_word_forward: p("alt+d,alt+delete,ctrl+delete"),
            input_delete_word_backward: p("ctrl+w,ctrl+backspace,alt+backspace"),
            input_undo: p("ctrl+-,super+z"),
            input_redo: p("ctrl+.,super+shift+z"),
            input_select_all: p("super+a"),

            // --- History ---
            history_previous: p("up"),
            history_next: p("down"),

            // --- Dialog / picker ---
            dialog_select_prev: p("up,ctrl+p"),
            dialog_select_next: p("down,ctrl+n"),
            dialog_select_page_up: p("pageup"),
            dialog_select_page_down: p("pagedown"),
            dialog_select_home: p("home"),
            dialog_select_end: p("end"),
            dialog_select_submit: p("return"),

            // --- Prompt autocomplete ---
            prompt_autocomplete_prev: p("up,ctrl+p"),
            prompt_autocomplete_next: p("down,ctrl+n"),
            prompt_autocomplete_hide: p("escape"),
            prompt_autocomplete_select: p("return"),
            prompt_autocomplete_complete: p("tab"),

            cli_optional_picker: p("alt+q,f6"),
            cli_tools_select: p("<leader>t"),
        }
    }

    /// Whether the leader key was pressed (`key` equals the leader bind).
    pub fn is_leader_press(&self, key: KeyEvent) -> bool {
        self.leader.matches(key)
    }

    /// A short label for the leader key (e.g. `"C-x"`), for hint lines.
    pub fn leader_label(&self) -> String {
        self.leader.label()
    }

    /// Friendly leader label for hotkey hints (e.g. `"Ctrl-x"`).
    pub fn leader_hint_label(&self) -> String {
        self.leader.friendly_label()
    }

    pub fn app_exit_label(&self) -> String {
        self.app_exit.first_label()
    }

    pub fn agent_list_label(&self) -> String {
        self.agent_list.first_label()
    }

    pub fn input_submit_label(&self) -> String {
        self.input_submit.first_label()
    }

    pub fn input_newline_label(&self) -> String {
        self.input_newline.first_label()
    }

    pub fn messages_toggle_conceal_label(&self) -> String {
        self.messages_toggle_conceal.first_label()
    }

    pub fn dialog_select_submit_label(&self) -> String {
        self.dialog_select_submit.first_label()
    }

    /// Whether any action registers a leader-gated binding (i.e. pressing the
    /// leader key is meaningful).
    pub fn has_leader_bindings(&self) -> bool {
        macro_rules! any_leader {
            ($($f:ident),+ $(,)?) => {
                [ $(&self.$f),+ ].iter().any(|c| !c.leader.is_empty())
            };
        }
        any_leader!(
            app_exit,
            app_debug,
            app_console,
            command_list,
            session_interrupt,
            agent_list,
            agent_cycle,
            agent_cycle_reverse,
            model_list,
            model_favorite_toggle,
            model_provider_list,
            model_cycle_recent,
            model_cycle_recent_reverse,
            variant_cycle,
            messages_page_up,
            messages_page_down,
            messages_line_up,
            messages_line_down,
            messages_half_page_up,
            messages_half_page_down,
            messages_first,
            messages_last,
            messages_copy,
            messages_toggle_conceal,
            sidebar_toggle,
            status_view,
            theme_list,
            tips_toggle,
            which_key_toggle,
            input_submit,
            input_newline,
            input_clear,
            input_backspace,
            input_delete,
            input_move_left,
            input_move_right,
            input_move_up,
            input_move_down,
            input_line_home,
            input_line_end,
            input_delete_to_line_end,
            input_delete_to_line_start,
            input_delete_line,
            input_word_forward,
            input_word_backward,
            input_delete_word_forward,
            input_delete_word_backward,
            input_undo,
            input_redo,
            input_select_all,
            history_previous,
            history_next,
            dialog_select_prev,
            dialog_select_next,
            dialog_select_page_up,
            dialog_select_page_down,
            dialog_select_home,
            dialog_select_end,
            dialog_select_submit,
            prompt_autocomplete_prev,
            prompt_autocomplete_next,
            prompt_autocomplete_hide,
            prompt_autocomplete_select,
            prompt_autocomplete_complete,
            cli_optional_picker,
            cli_tools_select,
        )
    }
}

/// Parse a key name into a crossterm [`KeyCode`].
fn parse_key_code(s: &str) -> Option<KeyCode> {
    let lower = s.to_ascii_lowercase();
    Some(match lower.as_str() {
        "enter" | "return" | "ret" => KeyCode::Enter,
        "escape" | "esc" => KeyCode::Esc,
        "tab" => KeyCode::Tab,
        "backtab" => KeyCode::BackTab,
        "backspace" | "back" | "bs" => KeyCode::Backspace,
        "delete" | "del" => KeyCode::Delete,
        "insert" | "ins" => KeyCode::Insert,
        "home" => KeyCode::Home,
        "end" => KeyCode::End,
        "pageup" | "page_up" | "pgup" => KeyCode::PageUp,
        "pagedown" | "page_down" | "pgdn" => KeyCode::PageDown,
        "left" => KeyCode::Left,
        "right" => KeyCode::Right,
        "up" => KeyCode::Up,
        "down" => KeyCode::Down,
        "space" | "spc" => KeyCode::Char(' '),
        other => {
            // Function keys: f1..f12.
            if other.len() >= 2 && other.starts_with('f') {
                if let Ok(n) = other[1..].parse::<u8>() {
                    if (1..=12).contains(&n) {
                        return Some(KeyCode::F(n));
                    }
                }
            }
            // Single character (normalized to lowercase).
            let mut chars = s.chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => KeyCode::Char(c.to_ascii_lowercase()),
                _ => return None,
            }
        }
    })
}

/// Equality for [`KeyCode`], case-insensitive for character keys.
fn key_code_eq(a: &KeyCode, b: &KeyCode) -> bool {
    match (a, b) {
        (KeyCode::Char(x), KeyCode::Char(y)) => x.eq_ignore_ascii_case(y),
        _ => a == b,
    }
}

/// A short label for a [`KeyCode`].
fn code_label(code: &KeyCode) -> String {
    match code {
        KeyCode::Enter => "Ret".to_string(),
        KeyCode::Esc => "Esc".to_string(),
        KeyCode::Tab => "Tab".to_string(),
        KeyCode::BackTab => "BTab".to_string(),
        KeyCode::Backspace => "Bksp".to_string(),
        KeyCode::Delete => "Del".to_string(),
        KeyCode::Insert => "Ins".to_string(),
        KeyCode::Home => "Home".to_string(),
        KeyCode::End => "End".to_string(),
        KeyCode::PageUp => "PgUp".to_string(),
        KeyCode::PageDown => "PgDn".to_string(),
        KeyCode::Left => "Left".to_string(),
        KeyCode::Right => "Right".to_string(),
        KeyCode::Up => "Up".to_string(),
        KeyCode::Down => "Down".to_string(),
        KeyCode::F(n) => format!("F{n}"),
        KeyCode::Char(c) => c.to_ascii_uppercase().to_string(),
        other => format!("{other:?}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kb(mods: KeyModifiers, code: KeyCode) -> KeyBind {
        KeyBind {
            modifiers: mods,
            code,
        }
    }

    #[test]
    fn friendly_label_uses_ctrl_prefix() {
        let bind = KeyBind::parse("ctrl+x").unwrap();
        assert_eq!(bind.friendly_label(), "Ctrl-x");
    }

    #[test]
    fn verbose_toggle_defaults_to_leader_v() {
        let kb = Keybinds::defaults();
        assert!(kb
            .messages_toggle_conceal
            .matches_leader(KeyEvent::new(KeyCode::Char('v'), KeyModifiers::NONE)));
        assert!(!kb
            .messages_toggle_conceal
            .matches_leader(KeyEvent::new(KeyCode::Char('h'), KeyModifiers::NONE)));
    }

    #[test]
    fn parses_simple_keys() {
        assert_eq!(
            KeyBind::parse("ctrl+x"),
            Some(kb(KeyModifiers::CONTROL, KeyCode::Char('x')))
        );
        assert_eq!(
            KeyBind::parse("shift+return"),
            Some(kb(KeyModifiers::SHIFT, KeyCode::Enter))
        );
        assert_eq!(
            KeyBind::parse("alt+f"),
            Some(kb(KeyModifiers::ALT, KeyCode::Char('f')))
        );
        assert_eq!(
            KeyBind::parse("f2"),
            Some(kb(KeyModifiers::NONE, KeyCode::F(2)))
        );
        assert_eq!(
            KeyBind::parse("pageup"),
            Some(kb(KeyModifiers::NONE, KeyCode::PageUp))
        );
    }

    #[test]
    fn none_and_empty_are_disabled() {
        assert_eq!(KeyBind::parse("none"), None);
        assert_eq!(KeyBind::parse(""), None);
        assert_eq!(KeyBind::parse("false"), None);
    }

    #[test]
    fn combo_splits_direct_and_leader() {
        let leader = KeyBind::parse("ctrl+x").unwrap();
        let combo = KeyCombo::parse("ctrl+c,ctrl+d,<leader>q", &leader);
        assert_eq!(combo.direct.len(), 2);
        assert_eq!(combo.leader.len(), 1);
        assert!(combo.direct[0].matches(KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL)));
        assert!(combo.leader[0].matches(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE)));
    }

    #[test]
    fn leader_repeat_is_not_direct() {
        let leader = KeyBind::parse("ctrl+x").unwrap();
        let combo = KeyCombo::parse("ctrl+x", &leader);
        assert!(combo.direct.is_empty());
    }

    #[test]
    fn matches_is_case_insensitive_for_chars() {
        let bind = KeyBind::parse("shift+a").unwrap();
        // Terminals report Shift+A as uppercase.
        assert!(bind.matches(KeyEvent::new(KeyCode::Char('A'), KeyModifiers::SHIFT)));
    }

    #[test]
    fn defaults_have_leader_bindings() {
        let kb = Keybinds::defaults();
        assert!(kb.has_leader_bindings());
        assert!(kb
            .app_exit
            .matches_leader(KeyEvent::new(KeyCode::Char('q'), KeyModifiers::NONE)));
        assert!(kb
            .agent_list
            .matches_leader(KeyEvent::new(KeyCode::Char('a'), KeyModifiers::NONE)));
    }

    #[test]
    fn defaults_match_direct_keys() {
        let kb = Keybinds::defaults();
        assert!(kb
            .input_submit
            .matches(KeyEvent::new(KeyCode::Enter, KeyModifiers::NONE)));
        assert!(kb
            .input_move_left
            .matches(KeyEvent::new(KeyCode::Left, KeyModifiers::NONE)));
        assert!(kb
            .input_move_left
            .matches(KeyEvent::new(KeyCode::Char('b'), KeyModifiers::CONTROL)));
        assert!(kb
            .session_interrupt
            .matches(KeyEvent::new(KeyCode::Esc, KeyModifiers::NONE)));
        assert!(kb
            .command_list
            .matches(KeyEvent::new(KeyCode::Char('p'), KeyModifiers::CONTROL)));
    }
}
