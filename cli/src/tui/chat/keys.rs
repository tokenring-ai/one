//! Keyboard and mouse dispatch: global app shortcuts, leader chords, transcript
//! scrolling, picker navigation, and routing to the active question/follow-up
//! sessions. Also hosts the pure quick-reply chord helpers.

use std::time::Instant;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::tui::editor::apply_editor_keypress;
use crate::tui::ui_layout::MouseAction;
use crate::tui::ChatExit;

use super::ChatSession;

/// Transcript scroll step sizes (lines).
const TRANSCRIPT_PAGE_LINES: usize = 8;

impl ChatSession {
    pub(super) fn handle_key(&mut self, key: KeyEvent) {
        // Expire a stale leader-pending state before doing anything else.
        if let Some(at) = self.leader_pending {
            if at.elapsed() > self.keybinds.leader_timeout {
                self.leader_pending = None;
            }
        }

        // If the leader key was just pressed, the next key dispatches a chord.
        if self.leader_pending.take().is_some() {
            self.dispatch_leader(key);
            // A leader chord always consumes the key (matched or not).
            return;
        }

        // Pressing the leader key itself enters chord-pending mode.
        if self.keybinds.has_leader_bindings() && self.keybinds.is_leader_press(key) {
            self.leader_pending = Some(Instant::now());
            return;
        }

        // Too-small terminal: only allow quit / interrupt so users are not stuck.
        if self.terminal_too_small {
            if self.keybinds.app_exit.matches(key)
                || is_ctrl_c(key)
                || matches!(key.code, KeyCode::Esc | KeyCode::Char('q'))
            {
                self.exit = Some(ChatExit::Quit);
            }
            return;
        }

        // Global app shortcuts (fire from any state short of a focused
        // question, which captures all keys below).
        if self.help_open {
            if self.keybinds.app_exit.matches(key) {
                self.exit = Some(ChatExit::Quit);
                return;
            }
            if is_ctrl_c(key) {
                self.handle_ctrl_c();
                return;
            }
            if matches!(key.code, KeyCode::Char('?') | KeyCode::Esc)
                || self.keybinds.which_key_toggle.matches(key)
            {
                self.help_open = false;
            }
            return;
        }

        if self.status_detail_open {
            if matches!(key.code, KeyCode::Esc)
                || self.keybinds.status_view.matches(key)
                || self.keybinds.session_interrupt.matches(key)
            {
                self.status_detail_open = false;
                self.mark_dirty();
            }
            return;
        }

        if self.instance_output_open {
            if matches!(key.code, KeyCode::Esc)
                || self.keybinds.instance_output.matches(key)
                || self.keybinds.session_interrupt.matches(key)
            {
                self.instance_output_open = false;
                self.mark_dirty();
            }
            return;
        }

        if self.command_list_open {
            if self.keybinds.app_exit.matches(key) {
                self.exit = Some(ChatExit::Quit);
                return;
            }
            if self.matches_picker_close(key) || self.keybinds.command_list.matches(key) {
                self.close_command_list();
                return;
            }
            if self.keybinds.dialog_select_submit.matches(key) {
                self.insert_command_list_selection();
                return;
            }
            if self.keybinds.dialog_select_prev.matches(key) {
                self.move_command_list_selection(-1);
                return;
            }
            if self.keybinds.dialog_select_next.matches(key) {
                self.move_command_list_selection(1);
                return;
            }
            if self.keybinds.dialog_select_page_up.matches(key) {
                self.move_command_list_selection(-8);
                return;
            }
            if self.keybinds.dialog_select_page_down.matches(key) {
                self.move_command_list_selection(8);
                return;
            }
            return;
        }

        // `?` opens help only when no text field would consume it (empty
        // composer, no question/follow-up/picker typing). Otherwise it falls
        // through and inserts normally.
        if matches!(key.code, KeyCode::Char('?')) && self.can_open_help_with_question_mark() {
            self.help_open = true;
            return;
        }
        if self.keybinds.which_key_toggle.matches(key) {
            self.help_open = true;
            return;
        }

        if is_ctrl_c(key) {
            self.handle_ctrl_c();
            return;
        }

        if self.keybinds.app_exit.matches(key) {
            self.exit = Some(ChatExit::Quit);
            return;
        }
        if self.keybinds.agent_list.matches(key) {
            self.exit = Some(ChatExit::SelectAgent);
            return;
        }
        if self.keybinds.model_list.matches(key) {
            self.trigger_shortcut("/model", "Opening model…");
            return;
        }
        if self.keybinds.messages_toggle_conceal.matches(key) {
            self.toggle_verbose();
            return;
        }
        if self.keybinds.command_list.matches(key) {
            self.open_command_list();
            return;
        }
        if self.keybinds.instance_output.matches(key) {
            self.instance_output_open = true;
            self.mark_dirty();
            return;
        }
        // CLI-specific extras.
        if self.keybinds.cli_optional_picker.matches(key) {
            self.toggle_optional_picker();
            return;
        }

        // Transcript scroll (when no modal owns the keyboard).
        if self.can_scroll_transcript() {
            if self.keybinds.messages_page_up.matches(key) {
                self.scroll_transcript(TRANSCRIPT_PAGE_LINES as i32);
                return;
            }
            if self.keybinds.messages_page_down.matches(key) {
                self.scroll_transcript(-(TRANSCRIPT_PAGE_LINES as i32));
                return;
            }
            if self.keybinds.messages_half_page_up.matches(key) {
                self.scroll_transcript((TRANSCRIPT_PAGE_LINES / 2) as i32);
                return;
            }
            if self.keybinds.messages_half_page_down.matches(key) {
                self.scroll_transcript(-((TRANSCRIPT_PAGE_LINES / 2) as i32));
                return;
            }
            if self.keybinds.messages_line_up.matches(key) {
                self.scroll_transcript(1);
                return;
            }
            if self.keybinds.messages_line_down.matches(key) {
                self.scroll_transcript(-1);
                return;
            }
            // Home/End double as line start/end in the composer. Only jump the
            // transcript when the composer is empty so typing is not stolen.
            if self.editor.is_empty() {
                if self.keybinds.messages_first.matches(key) {
                    // Jump to the absolute top (clamped on next draw).
                    self.transcript_scroll_back = usize::MAX;
                    return;
                }
                if self.keybinds.messages_last.matches(key) {
                    self.transcript_scroll_back = 0;
                    return;
                }
            }
        }

        // Optional-question picker.
        if self.optional_picker_open {
            if self.keybinds.dialog_select_submit.matches(key) {
                self.select_optional_at_index(self.optional_index);
                return;
            }
            if self.matches_picker_close(key) {
                self.optional_picker_open = false;
                return;
            }
            if self.keybinds.dialog_select_prev.matches(key) {
                let n = self.optional_questions().len();
                if n > 0 {
                    self.optional_index = self.optional_index.saturating_sub(1).min(n - 1);
                }
                return;
            }
            if self.keybinds.dialog_select_next.matches(key) {
                let n = self.optional_questions().len();
                if n > 0 {
                    self.optional_index = (self.optional_index + 1).min(n - 1);
                }
                return;
            }
            if self.keybinds.dialog_select_page_up.matches(key) {
                let n = self.optional_questions().len();
                if n > 0 {
                    self.optional_index = self.optional_index.saturating_sub(8).min(n - 1);
                }
                return;
            }
            if self.keybinds.dialog_select_page_down.matches(key) {
                let n = self.optional_questions().len();
                if n > 0 {
                    self.optional_index = (self.optional_index + 8).min(n - 1);
                }
                return;
            }
            // Capture all other keys while the picker is open.
            return;
        }

        // A focused question captures keys handled by the active session.
        if self.active_question.is_some() {
            if self.keybinds.app_exit.matches(key) {
                self.exit = Some(ChatExit::Quit);
                return;
            }
            self.handle_question_key(key);
            return;
        }

        // A focused followup uses its own composer.
        if self.focused_followup().is_some() {
            if self.keybinds.input_newline.matches(key) {
                self.followup_editor.insert_newline();
                self.clear_stale_selected_chip();
                return;
            }
            if self.keybinds.input_submit.matches(key) {
                self.submit_followup();
                return;
            }
            // Esc cancels the follow-up interaction (null response), matching
            // questions and the help overlay — not agent interrupt.
            if self.keybinds.session_interrupt.matches(key) {
                self.cancel_followup();
                return;
            }
            if apply_editor_keypress(&mut self.followup_editor, key, &self.keybinds) {
                self.clear_stale_selected_chip();
            }
            return;
        }

        // File-search picker navigation takes priority while active.
        if self.filesearch.is_some() {
            if self.keybinds.session_interrupt.matches(key) {
                self.dismiss_filesearch();
                return;
            }
            if self.keybinds.dialog_select_submit.matches(key) || matches!(key.code, KeyCode::Tab) {
                self.insert_selected_filesearch();
                return;
            }
            if self.keybinds.dialog_select_prev.matches(key) {
                self.move_filesearch_selection(-1);
                return;
            }
            if self.keybinds.dialog_select_next.matches(key) {
                self.move_filesearch_selection(1);
                return;
            }
            if self.keybinds.dialog_select_page_up.matches(key) {
                self.move_filesearch_selection(-5);
                return;
            }
            if self.keybinds.dialog_select_page_down.matches(key) {
                self.move_filesearch_selection(5);
                return;
            }
            // Fall through: regular typing/editing narrows the @query and
            // re-syncs the picker via `after_edit`.
        }

        // Completion-picker navigation takes priority while active.
        if self.completion.is_some() {
            if self.keybinds.prompt_autocomplete_hide.matches(key) {
                self.dismiss_completion();
                return;
            }
            if self.keybinds.prompt_autocomplete_complete.matches(key) {
                self.insert_selected_completion();
                return;
            }
            if self.keybinds.prompt_autocomplete_prev.matches(key) {
                self.move_completion_selection(-1);
                return;
            }
            if self.keybinds.prompt_autocomplete_next.matches(key) {
                self.move_completion_selection(1);
                return;
            }
            if self.keybinds.dialog_select_page_up.matches(key) {
                self.move_completion_selection(-5);
                return;
            }
            if self.keybinds.dialog_select_page_down.matches(key) {
                self.move_completion_selection(5);
                return;
            }
            // Fall through: regular typing/editing narrows the /query and
            // re-syncs the picker via `after_edit`.
        }

        // Newline insertion
        if self.keybinds.input_newline.matches(key) {
            self.editor.insert_newline();
            self.after_edit();
            return;
        }

        // Editor editing/navigation (driven by the keybinds struct).
        if apply_editor_keypress(&mut self.editor, key, &self.keybinds) {
            self.after_edit();
            return;
        }

        // Submit / history / interrupt
        // session_interrupt).
        if self.keybinds.input_submit.matches(key) {
            self.submit();
            return;
        }
        if self.keybinds.history_previous.matches(key) {
            self.browse_history(-1);
            return;
        }
        if self.keybinds.history_next.matches(key) {
            self.browse_history(1);
            return;
        }
        if self.keybinds.session_interrupt.matches(key) {
            self.interrupt_session();
            return;
        }
        if self.keybinds.prompt_autocomplete_complete.matches(key) {
            self.extend_command_prefix();
        }
    }

    /// Dispatch a leader-chord second key. A chord always consumes the key
    /// whether or not it matched a binding, so no result is returned.
    fn dispatch_leader(&mut self, key: KeyEvent) {
        if self.keybinds.app_exit.matches_leader(key) {
            self.exit = Some(ChatExit::Quit);
            return;
        }
        if self.keybinds.agent_list.matches_leader(key) {
            self.exit = Some(ChatExit::SelectAgent);
            return;
        }
        if self.keybinds.agent_delete.matches_leader(key) {
            self.confirm_or_delete_agent();
            return;
        }
        if self.keybinds.model_list.matches_leader(key) {
            self.trigger_shortcut("/model", "Opening model…");
            return;
        }
        if self.keybinds.messages_toggle_conceal.matches_leader(key)
            || self.keybinds.tips_toggle.matches_leader(key)
        {
            self.toggle_verbose();
            return;
        }
        // Leader+t is tools; theme is leader+Shift+t.
        if self.keybinds.cli_tools_select.matches_leader(key) {
            self.trigger_shortcut("/tools select", "Opening tools picker…");
            return;
        }
        if self.keybinds.theme_list.matches_leader(key) {
            self.cycle_theme();
            return;
        }
        if self.keybinds.messages_copy.matches_leader(key) {
            self.copy_latest_message();
            return;
        }
        if self.keybinds.sidebar_toggle.matches_leader(key) {
            self.toggle_sidebar();
            return;
        }
        if self.keybinds.status_view.matches_leader(key) {
            self.toggle_status_detail();
            return;
        }
        if self.keybinds.instance_output.matches_leader(key) {
            self.instance_output_open = true;
            self.mark_dirty();
            return;
        }
        if self.keybinds.which_key_toggle.matches_leader(key) {
            self.help_open = true;
            return;
        }

        // Legacy-terminal fallbacks below: everything above this point works
        // fine as a plain `ctrl+<letter>` chord, but the actions here default
        // to modifier combos (ctrl+digit, ctrl+shift+<letter>, ctrl+alt+<letter>,
        // super+*) that many terminals — Apple's Terminal.app among them —
        // cannot report without the Kitty/CSI-u keyboard-enhancement protocol.
        // Routing them through the leader chord instead means the *combo*
        // that reaches the app is always just `ctrl+<letter>` followed by a
        // plain keypress, which every terminal can send.
        if self.keybinds.input_undo.matches_leader(key) {
            if self.focused_followup().is_some() {
                self.followup_editor.undo();
            } else if self.editor.undo() {
                self.after_edit();
            }
            return;
        }
        if self.keybinds.input_redo.matches_leader(key) {
            if self.focused_followup().is_some() {
                self.followup_editor.redo();
            } else if self.editor.redo() {
                self.after_edit();
            }
            return;
        }
        if self.keybinds.input_delete_line.matches_leader(key) {
            if self.focused_followup().is_some() {
                self.followup_editor.delete_line();
                self.clear_stale_selected_chip();
            } else {
                self.editor.delete_line();
                self.after_edit();
            }
            return;
        }
        if self.keybinds.input_select_all.matches_leader(key) {
            if self.focused_followup().is_some() {
                self.followup_editor.move_to_end();
            } else {
                self.editor.move_to_end();
            }
            return;
        }
        if self.can_scroll_transcript() {
            if self.keybinds.messages_line_up.matches_leader(key) {
                self.scroll_transcript(1);
                return;
            }
            if self.keybinds.messages_line_down.matches_leader(key) {
                self.scroll_transcript(-1);
                return;
            }
            if self.keybinds.messages_half_page_up.matches_leader(key) {
                self.scroll_transcript((TRANSCRIPT_PAGE_LINES / 2) as i32);
                return;
            }
            if self.keybinds.messages_half_page_down.matches_leader(key) {
                self.scroll_transcript(-((TRANSCRIPT_PAGE_LINES / 2) as i32));
                return;
            }
        }
        // Quick-reply chips: leader+1 / leader+2 / leader+3. Leader-only (no
        // direct ctrl+digit binding) since ctrl+<digit> has no legacy escape
        // code at all — most terminals never report it, enhancement protocol
        // or not — while the leader chord works everywhere.
        if self.can_show_quick_replies() {
            if let Some(idx) = quick_reply_index_for_key(key, self.quick_reply_chips().len()) {
                self.stage_quick_reply(idx);
                return;
            }
        }
        if self.can_show_followup_quick_replies() {
            if let Some(idx) = quick_reply_index_for_key(key, self.quick_reply_chips().len()) {
                self.stage_followup_quick_reply(idx);
            }
        }
    }

    /// Whether `key` closes a modal picker (Escape/interrupt or `q`).
    fn matches_picker_close(&self, key: KeyEvent) -> bool {
        self.keybinds.session_interrupt.matches(key) || matches!(key.code, KeyCode::Char('q'))
    }

    /// `?` opens the help overlay only when it would not be typed into a field.
    fn can_open_help_with_question_mark(&self) -> bool {
        self.active_question.is_none()
            && self.focused_followup().is_none()
            && self.filesearch.is_none()
            && self.completion.is_none()
            && !self.optional_picker_open
            && !self.command_list_open
            && self.editor.is_empty()
    }

    pub(super) fn handle_mouse(&mut self, event: crossterm::event::MouseEvent) {
        let action =
            self.hit_regions
                .mouse_action(event, self.help_open, self.can_scroll_transcript());
        let Some(action) = action else {
            return;
        };
        match action {
            MouseAction::Scroll(delta) => self.scroll_transcript(delta),
            MouseAction::FocusComposer => self.focus_composer(),
            MouseAction::SelectFilesearch(idx) => {
                if let Some(state) = self.filesearch.as_mut() {
                    state.selected_index = idx.min(state.matches.len().saturating_sub(1));
                }
                self.insert_selected_filesearch();
            }
            MouseAction::SelectCompletion(idx) => {
                if let Some(state) = self.completion.as_mut() {
                    state.selected_index = idx.min(state.matches.len().saturating_sub(1));
                }
                self.insert_selected_completion();
            }
            MouseAction::SelectOptional(idx) => {
                self.select_optional_at_index(idx);
            }
        }
    }
}

fn is_ctrl_c(key: KeyEvent) -> bool {
    key.modifiers.contains(KeyModifiers::CONTROL)
        && matches!(key.code, KeyCode::Char('c') | KeyCode::Char('C'))
}

/// Map a plain digit key (`1`..`9`, no modifier required) to a 0-based
/// quick-reply chip index. Quick replies are leader-only (`<leader>1`, `<leader>2`,
/// …) so the digit itself never needs Ctrl — the leader chord already
/// disambiguated the keypress from ordinary typing.
fn quick_reply_index_for_key(key: KeyEvent, chip_count: usize) -> Option<usize> {
    let KeyCode::Char(c) = key.code else {
        return None;
    };
    let digit = c.to_digit(10)? as usize;
    if digit == 0 {
        return None;
    }
    let index = digit - 1;
    (index < chip_count).then_some(index)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ctrl_c_detection() {
        assert!(is_ctrl_c(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::CONTROL
        )));
        assert!(!is_ctrl_c(KeyEvent::new(
            KeyCode::Char('c'),
            KeyModifiers::NONE
        )));
    }

    #[test]
    fn quick_reply_uses_plain_digit() {
        // Quick replies are leader-only: the digit itself carries no
        // modifier, since `<leader>` already disambiguated it from typing.
        assert_eq!(
            quick_reply_index_for_key(KeyEvent::new(KeyCode::Char('1'), KeyModifiers::NONE), 3),
            Some(0)
        );
        assert_eq!(
            quick_reply_index_for_key(KeyEvent::new(KeyCode::Char('3'), KeyModifiers::NONE), 3),
            Some(2)
        );
        assert_eq!(
            quick_reply_index_for_key(KeyEvent::new(KeyCode::Char('4'), KeyModifiers::NONE), 3),
            None
        );
        assert_eq!(
            quick_reply_index_for_key(KeyEvent::new(KeyCode::Char('0'), KeyModifiers::NONE), 3),
            None
        );
    }
}
