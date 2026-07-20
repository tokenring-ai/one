//! Keyboard and mouse dispatch: global app shortcuts, leader chords, transcript
//! scrolling, picker navigation, and routing to the active question/follow-up
//! sessions. Also hosts the pure quick-reply chord helpers.

use std::time::{Duration, Instant};

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::theme::Tone;
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
            if matches!(key.code, KeyCode::Char('?') | KeyCode::Esc) {
                self.help_open = false;
            }
            return;
        }

        if matches!(key.code, KeyCode::Char('?')) {
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
            self.trigger_shortcut("/model", "Opening model picker…");
            return;
        }
        if self.keybinds.messages_toggle_conceal.matches(key) {
            self.toggle_verbose();
            return;
        }
        // CLI-specific extras.
        if self.keybinds.cli_optional_picker.matches(key) {
            self.toggle_optional_picker();
            return;
        }

        // Transcript scroll (when the composer is idle).
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
            if self.keybinds.messages_first.matches(key) {
                // Jump toward the top by a generous, finite page so subsequent
                // PgDn never gets "stuck" past the real scroll ceiling.
                self.scroll_transcript(TRANSCRIPT_PAGE_LINES as i32 * 8);
                return;
            }
            if self.keybinds.messages_last.matches(key) {
                self.transcript_scroll_back = 0;
                return;
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
            if self.can_show_followup_quick_replies()
                && (self.quick_reply_pending.is_some() || is_quick_reply_leader(key))
            {
                if let Some(idx) = self.handle_quick_reply_key(key) {
                    self.stage_followup_quick_reply(idx);
                }
                return;
            }
            if self.keybinds.input_newline.matches(key) {
                self.followup_editor.insert_newline();
                self.clear_stale_selected_chip();
                return;
            }
            if self.keybinds.input_submit.matches(key) {
                self.submit_followup();
                return;
            }
            if self.keybinds.session_interrupt.matches(key) {
                self.interrupt_session();
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

        // Quick-reply chips (`Ctrl-R`, then `1`/`2`/...) when the composer is idle.
        if self.can_show_quick_replies()
            && (self.quick_reply_pending.is_some() || is_quick_reply_leader(key))
        {
            if let Some(idx) = self.handle_quick_reply_key(key) {
                self.stage_quick_reply(idx);
            }
            return;
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

        // Expand/collapse a collapsed multi-action tool call visible in the viewport.
        if self.can_scroll_transcript()
            && self.editor.text().trim().is_empty()
            && self.keybinds.input_submit.matches(key)
        {
            if let Some(idx) = self.viewport_collapsible_tool_index {
                self.toggle_tool_entry(idx);
                return;
            }
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
        if self.keybinds.model_list.matches_leader(key) {
            self.trigger_shortcut("/model", "Opening model picker…");
            return;
        }
        if self.keybinds.messages_toggle_conceal.matches_leader(key)
            || self.keybinds.tips_toggle.matches_leader(key)
        {
            self.toggle_verbose();
            return;
        }
        // CLI override: leader+t opens the tools picker
        if self.keybinds.cli_tools_select.matches_leader(key) {
            self.trigger_shortcut("/tools select", "Opening tools picker…");
            return;
        }
        if self.keybinds.sidebar_toggle.matches_leader(key) {
            self.flash(
                "Sidebar toggle (not configured).",
                Tone::Muted,
                Duration::from_secs(2),
            );
            return;
        }
        if self.keybinds.status_view.matches_leader(key) {
            self.flash(
                "Status view (not configured).",
                Tone::Muted,
                Duration::from_secs(2),
            );
        }
    }

    /// Whether `key` closes a modal picker (Escape/interrupt or `q`).
    fn matches_picker_close(&self, key: KeyEvent) -> bool {
        self.keybinds.session_interrupt.matches(key) || matches!(key.code, KeyCode::Char('q'))
    }

    fn handle_quick_reply_key(&mut self, key: KeyEvent) -> Option<usize> {
        if self.quick_reply_pending.take().is_some() {
            let index = quick_reply_index_for_digit_key(key, self.quick_reply_chips().len());
            if index.is_none() {
                self.flash("Quick Reply canceled.", Tone::Muted, Duration::from_secs(2));
                self.mark_dirty();
            }
            return index;
        }

        if is_quick_reply_leader(key) {
            self.quick_reply_pending = Some(Instant::now());
            self.flash(
                "Quick Reply: press 1, 2, or 3.",
                Tone::Info,
                Duration::from_secs(3),
            );
            self.mark_dirty();
        }
        None
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

fn is_quick_reply_leader(key: KeyEvent) -> bool {
    key.modifiers.contains(KeyModifiers::CONTROL)
        && matches!(key.code, KeyCode::Char('r') | KeyCode::Char('R'))
}

fn quick_reply_index_for_digit_key(key: KeyEvent, chip_count: usize) -> Option<usize> {
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
    fn quick_reply_chord_uses_ctrl_r_then_digit() {
        assert!(is_quick_reply_leader(KeyEvent::new(
            KeyCode::Char('r'),
            KeyModifiers::CONTROL
        )));
        assert!(!is_quick_reply_leader(KeyEvent::new(
            KeyCode::Char('r'),
            KeyModifiers::NONE
        )));

        assert_eq!(
            quick_reply_index_for_digit_key(
                KeyEvent::new(KeyCode::Char('1'), KeyModifiers::NONE),
                3
            ),
            Some(0)
        );
        assert_eq!(
            quick_reply_index_for_digit_key(
                KeyEvent::new(KeyCode::Char('4'), KeyModifiers::NONE),
                3
            ),
            None
        );
    }
}
