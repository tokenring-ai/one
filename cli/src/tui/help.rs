//! Context-sensitive keyboard shortcut overlay (nice-to-have #16).

use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};

use crate::theme::{Theme, Tone};
use crate::tui::keybinds::Keybinds;

/// UI mode for context-aware help.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HelpContext {
    Composer,
    Followup,
    Question,
    OptionalPicker,
    FileSearch,
    CommandCompletion,
    TranscriptScroll,
}

impl HelpContext {
    pub fn detect(
        active_question: bool,
        followup: bool,
        optional_picker: bool,
        filesearch: bool,
        completion: bool,
        transcript_scroll_back: usize,
    ) -> Self {
        if active_question {
            return Self::Question;
        }
        if followup {
            return Self::Followup;
        }
        if optional_picker {
            return Self::OptionalPicker;
        }
        if filesearch {
            return Self::FileSearch;
        }
        if completion {
            return Self::CommandCompletion;
        }
        if transcript_scroll_back > 0 {
            return Self::TranscriptScroll;
        }
        Self::Composer
    }
}

/// Build help overlay lines for the current context.
pub fn help_lines(context: HelpContext, kb: &Keybinds, theme: &Theme) -> Vec<Line<'static>> {
    let title_style = Style::default()
        .fg(theme.help.title_color.color())
        .add_modifier(Modifier::BOLD);
    let key_style = Style::default().fg(theme.help.key_color.color());
    let desc_style = Style::default().fg(theme.help.description_color.color());
    let muted = Style::default().fg(Tone::Muted.color(theme));

    let mut lines = vec![
        Line::from(Span::styled("Keyboard shortcuts", title_style)),
        Line::from(Span::styled("Press ? or Esc to close", muted)),
        Line::raw(""),
    ];

    let push = |lines: &mut Vec<Line<'static>>, key: &str, desc: &str| {
        lines.push(Line::from(vec![
            Span::styled(format!("{key:<14}"), key_style),
            Span::styled(desc.to_string(), desc_style),
        ]));
    };

    push(&mut lines, "?", "This help overlay");
    push(&mut lines, &kb.app_exit_label(), "Quit application");
    push(&mut lines, "Ctrl+C", "Cancel work; press again to exit");
    push(&mut lines, &kb.agent_list_label(), "Agent selection");

    match context {
        HelpContext::Composer => {
            push(&mut lines, &kb.input_submit_label(), "Send message");
            push(&mut lines, &kb.input_newline_label(), "Insert newline");
            push(
                &mut lines,
                &kb.messages_toggle_conceal_label(),
                "Toggle verbose",
            );
            push(&mut lines, "1/2/3", "Quick-reply chips");
            push(&mut lines, "@query", "Workspace file search");
            push(&mut lines, "/command", "Slash-command picker");
            push(&mut lines, "Tab", "Extend shared command prefix");
            push(&mut lines, "PgUp/PgDn", "Scroll transcript");
        }
        HelpContext::Followup => {
            push(&mut lines, &kb.input_submit_label(), "Submit follow-up");
            push(&mut lines, &kb.input_newline_label(), "Newline in reply");
            push(&mut lines, "1/2/3", "Quick-reply chips");
            push(&mut lines, "Esc", "Cancel follow-up");
        }
        HelpContext::Question => {
            push(&mut lines, &kb.input_submit_label(), "Submit answer");
            push(
                &mut lines,
                &kb.input_newline_label(),
                "Newline (multi-line)",
            );
            push(&mut lines, "Esc", "Cancel question");
        }
        HelpContext::OptionalPicker => {
            push(&mut lines, "Up/Down", "Move selection");
            push(
                &mut lines,
                &kb.dialog_select_submit_label(),
                "Open question",
            );
            push(&mut lines, "Esc", "Close picker");
        }
        HelpContext::FileSearch => {
            push(&mut lines, "Up/Down", "Move selection");
            push(
                &mut lines,
                &kb.dialog_select_submit_label(),
                "Insert file path",
            );
            push(&mut lines, "Esc", "Close picker");
        }
        HelpContext::CommandCompletion => {
            push(&mut lines, "Up/Down", "Move selection");
            push(&mut lines, "Tab/Enter", "Insert command");
            push(&mut lines, "Esc", "Close picker");
        }
        HelpContext::TranscriptScroll => {
            push(&mut lines, "PgUp/PgDn", "Scroll transcript");
            push(&mut lines, "End", "Follow latest");
            push(&mut lines, "Enter", "Expand/collapse tool output");
        }
    }

    lines
}
