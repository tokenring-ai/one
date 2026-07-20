//! The message composer subsystem: re-syncing slash-command completion and
//! `@` file-search after each edit, history browsing, bracketed-paste routing,
//! submission, and global shortcuts (model/tools pickers, verbose toggle,
//! interrupt).

use std::time::{Duration, Instant};

use crate::rpc;
use crate::theme::Tone;
use crate::tui::completion;
use crate::tui::filesearch;
use crate::tui::ChatExit;

use super::interactions::ActiveSession;
use super::ChatSession;

impl ChatSession {
    /// Re-sync completion and file-search pickers from the current editor buffer.
    pub(super) fn sync_composer_pickers(&mut self) {
        let text = self.editor.text();
        let cursor = self.editor.cursor();
        let commands = self.commands.clone();
        let current = self.completion.clone();
        self.completion = completion::sync_completion(
            &current,
            &mut self.dismissed_completion,
            &text,
            cursor,
            &commands,
        );
        self.sync_filesearch(&text, cursor);
    }

    /// Called after a user-driven editor change (port of `afterChatEdit`).
    pub(super) fn after_edit(&mut self) {
        self.history_index = None;
        self.history_draft.clear();
        self.clear_stale_selected_chip();
        self.sync_composer_pickers();
    }

    /// Drop quick-reply chip highlight once the active composer diverges.
    pub(super) fn clear_stale_selected_chip(&mut self) {
        let Some(idx) = self.selected_chip else {
            return;
        };
        let chips = self.quick_reply_chips();
        let active_text = if self.focused_followup().is_some() {
            self.followup_editor.text()
        } else {
            self.editor.text()
        };
        let still_matches = chips.get(idx).is_some_and(|chip| active_text == *chip);
        if !still_matches {
            self.selected_chip = None;
        }
    }

    /// Re-sync the `@` file-search picker (port of `syncChatFileSearchState`).
    pub(super) fn sync_filesearch(&mut self, text: &str, cursor: usize) {
        let token = match filesearch::find_active_file_search_token(text, cursor) {
            Some(token) => token,
            None => {
                self.filesearch = None;
                self.dismissed_filesearch = None;
                self.workspace_search.clear_picker();
                return;
            }
        };

        let signature = format!("{}:{}:{}", token.start, token.end, token.query);
        if self
            .dismissed_filesearch
            .as_ref()
            .is_some_and(|d| d != &signature)
        {
            self.dismissed_filesearch = None;
        }
        if self.dismissed_filesearch.as_ref() == Some(&signature) {
            self.filesearch = None;
            return;
        }

        if let Some(cached) = self
            .workspace_search
            .cache
            .get(&self.provider, &token.query)
        {
            let matches = cached.matches.clone();
            let previous_index = self.filesearch.as_ref().map(|s| s.selected_index);
            let selected_index = previous_index
                .unwrap_or(0)
                .min(matches.len().saturating_sub(1));
            self.filesearch = Some(filesearch::FileSearchState {
                token,
                matches,
                selected_index,
                loading: false,
                error: None,
                indexed_count: cached.total_matches,
            });
            return;
        }

        self.workspace_search
            .ensure_loading(&self.client, &self.provider, &token.query);

        let loading = self.workspace_search.is_loading();
        let previous_index = self.filesearch.as_ref().map(|s| s.selected_index);
        self.filesearch = Some(filesearch::FileSearchState {
            token,
            matches: Vec::new(),
            selected_index: previous_index.unwrap_or(0),
            loading,
            error: None,
            indexed_count: 0,
        });
    }

    /// Drain the backend search result, if ready.
    pub(super) fn drain_search(&mut self) {
        self.workspace_search
            .drain(&self.provider, &mut self.filesearch);
    }

    pub(super) fn insert_selected_filesearch(&mut self) {
        let state = match self.filesearch.clone() {
            Some(state) => state,
            None => return,
        };
        let Some(path) = state.matches.get(state.selected_index).cloned() else {
            self.flash("No matching file.", Tone::Warning, Duration::from_secs(2));
            return;
        };
        let (new_text, cursor) =
            filesearch::replace_file_search_token(&self.editor.text(), &state.token, &path);
        self.editor.set_text_with_cursor(&new_text, cursor);
        self.history_index = None;
        self.history_draft.clear();
        self.dismissed_filesearch = None;
        self.after_edit();
    }

    pub(super) fn move_filesearch_selection(&mut self, offset: i32) {
        let Some(state) = self.filesearch.as_mut() else {
            return;
        };
        if state.matches.is_empty() {
            return;
        }
        let last = state.matches.len() - 1;
        let next = state.selected_index as i32 + offset;
        state.selected_index = next.clamp(0, last as i32) as usize;
    }

    pub(super) fn dismiss_filesearch(&mut self) {
        if let Some(state) = self.filesearch.take() {
            self.dismissed_filesearch = Some(state.signature());
        }
        self.workspace_search.clear_picker();
    }

    /// Run a slash command by name (port of `triggerShortcutCommand`).
    pub(super) fn trigger_shortcut(&mut self, command_name: &str, flash_message: &str) {
        self.clear_composer_pickers();
        if let Err(e) = rpc::send_input(&self.client, &self.agent.id, command_name) {
            self.flash(e.to_string(), Tone::Error, Duration::from_secs(5));
        } else {
            self.flash(flash_message, Tone::Info, Duration::from_millis(1500));
            self.sync_composer_pickers();
        }
    }

    pub(super) fn insert_selected_completion(&mut self) {
        let Some(state) = self.completion.clone() else {
            return;
        };
        let Some(cmd) = state.matches.get(state.selected_index).cloned() else {
            self.flash(
                "No matching command.",
                Tone::Warning,
                Duration::from_secs(2),
            );
            return;
        };
        self.apply_completion(
            state.replacement_start,
            state.replacement_end,
            &format!("{} ", cmd.name),
        );
    }

    /// Bash-style partial `/command` extension when Tab is pressed outside the
    /// completion picker (port of `getLongestCommonPrefix` usage).
    pub(super) fn extend_command_prefix(&mut self) {
        let text = self.editor.text();
        let cursor = self.editor.cursor();
        let Some(ctx) = completion::get_command_completion_context(&text, cursor, &self.commands)
        else {
            return;
        };
        if ctx.matches.is_empty() {
            return;
        }

        let names: Vec<&str> = ctx.matches.iter().map(|m| m.name.as_str()).collect();
        let lcp = completion::longest_common_prefix(&names);
        if lcp.len() > ctx.query.len() {
            self.apply_completion(ctx.replacement_start, ctx.replacement_end, &lcp);
            return;
        }

        if ctx.matches.len() == 1 {
            let name = &ctx.matches[0].name;
            if name.len() > ctx.query.len() {
                self.apply_completion(
                    ctx.replacement_start,
                    ctx.replacement_end,
                    &format!("{name} "),
                );
            }
        }
    }

    pub(super) fn move_completion_selection(&mut self, offset: i32) {
        let Some(state) = self.completion.as_mut() else {
            return;
        };
        if state.matches.is_empty() {
            return;
        }
        let last = state.matches.len() - 1;
        let next = state.selected_index as i32 + offset;
        state.selected_index = next.clamp(0, last as i32) as usize;
    }

    pub(super) fn dismiss_completion(&mut self) {
        if let Some(state) = self.completion.take() {
            self.dismissed_completion = Some(state.signature());
        }
    }

    /// Replace the `/query` span with `/{replacement}` and position the cursor
    /// after it (port of `applyCompletion`).
    fn apply_completion(&mut self, start: usize, end: usize, replacement: &str) {
        let text = self.editor.text();
        let chars: Vec<char> = text.chars().collect();
        let prefix: String = chars[..start].iter().collect();
        let suffix: String = chars[end..].iter().collect();
        let new_text = format!("{prefix}/{replacement}{suffix}");
        let cursor = start + 1 + replacement.chars().count();
        self.editor.set_text_with_cursor(&new_text, cursor);
        self.history_index = None;
        self.history_draft.clear();
        self.dismissed_completion = None;
        self.after_edit();
    }

    /// Submit the current editor contents as a message (port of
    /// `submitCurrentInput`).
    pub(super) fn submit(&mut self) {
        let message = self.editor.text();
        let message = message.trim_end();
        if self.editor.is_empty() || message.trim().is_empty() {
            self.flash(
                "Type a message or command first.",
                Tone::Muted,
                Duration::from_secs(2),
            );
            return;
        }
        self.history_index = None;
        self.history_draft.clear();

        match rpc::send_input(&self.client, &self.agent.id, message) {
            Ok(_) => {
                if self.history.last().map(String::as_str) != Some(message) {
                    self.history.push(message.to_string());
                }
                self.editor.clear();
                self.after_edit();
            }
            Err(e) => self.flash(e.to_string(), Tone::Error, Duration::from_secs(5)),
        }
    }

    /// Navigate command history (port of `browseHistory`). `direction` is -1
    /// for Up (older) and +1 for Down (newer).
    pub(super) fn browse_history(&mut self, direction: i32) {
        if self.history.is_empty() {
            self.flash("History is empty.", Tone::Muted, Duration::from_secs(2));
            return;
        }
        let last = self.history.len() - 1;
        if direction < 0 {
            match self.history_index {
                None => {
                    self.history_draft = self.editor.text();
                    self.history_index = Some(last);
                }
                Some(i) => self.history_index = Some(i.saturating_sub(1)),
            }
        } else {
            match self.history_index {
                None => return,
                Some(i) if i >= last => {
                    self.history_index = None;
                    self.editor.set_text(&self.history_draft);
                    self.sync_composer_pickers();
                    return;
                }
                Some(i) => self.history_index = Some(i + 1),
            }
        }
        let i = self.history_index.unwrap();
        self.editor.set_text(&self.history[i]);
        self.sync_composer_pickers();
    }

    /// Insert pasted text (bracketed paste), normalizing line endings.
    pub(super) fn handle_paste(&mut self, text: &str) {
        if self.help_open || self.optional_picker_open {
            return;
        }

        let normalized: String = text.replace("\r\n", "\n").replace('\r', "\n");

        // Route paste to the active question's text/form editor.
        if let Some(aq) = &mut self.active_question {
            match &mut aq.session {
                ActiveSession::Text(s) => {
                    s.insert_text(&normalized);
                    return;
                }
                ActiveSession::Form(s) => {
                    s.insert_text(&normalized);
                    return;
                }
                _ => return,
            }
        }

        // Route paste to the followup composer.
        if self.focused_followup().is_some() {
            self.followup_editor.insert(&normalized);
            self.clear_stale_selected_chip();
            return;
        }

        self.editor.insert(&normalized);
        self.after_edit();
    }

    /// How long a second Ctrl+C still counts as "press again to exit".
    pub(super) const CTRL_C_EXIT_WINDOW: Duration = Duration::from_secs(2);

    /// Interrupt the running activity, or surface a muted flash when idle.
    pub(super) fn interrupt_session(&mut self) {
        if self.running {
            match rpc::abort_current_operation(
                &self.client,
                &self.agent.id,
                "Cancelled from cli-rs",
            ) {
                Ok(_) => self.flash(
                    "Cancelled the current activity.",
                    Tone::Warning,
                    Duration::from_secs(2),
                ),
                Err(e) => self.flash(e.to_string(), Tone::Error, Duration::from_secs(5)),
            }
        } else {
            self.flash(
                "No active work to cancel.",
                Tone::Muted,
                Duration::from_secs(2),
            );
        }
    }

    /// Handle Ctrl+C: cancel active work on the first press and exit on a
    /// second press within [`Self::CTRL_C_EXIT_WINDOW`].
    pub(super) fn handle_ctrl_c(&mut self) {
        if let Some(at) = self.ctrl_c_pending {
            if at.elapsed() < Self::CTRL_C_EXIT_WINDOW {
                self.exit = Some(ChatExit::Quit);
                return;
            }
        }

        self.ctrl_c_pending = Some(Instant::now());
        self.help_open = false;

        if self.running {
            match rpc::abort_current_operation(
                &self.client,
                &self.agent.id,
                "Cancelled from cli-rs",
            ) {
                Ok(_) => self.flash(
                    "Cancelled. Press Ctrl+C again to exit.",
                    Tone::Warning,
                    Self::CTRL_C_EXIT_WINDOW,
                ),
                Err(e) => self.flash(
                    format!("{e}  Press Ctrl+C again to exit."),
                    Tone::Error,
                    Duration::from_secs(5).max(Self::CTRL_C_EXIT_WINDOW),
                ),
            }
        } else {
            self.flash(
                "Press Ctrl+C again to exit.",
                Tone::Muted,
                Self::CTRL_C_EXIT_WINDOW,
            );
        }
    }

    /// Toggle verbose/conceal filtering and flash the new state.
    pub(super) fn toggle_verbose(&mut self) {
        self.verbose = !self.verbose;
        self.flash(
            format!("Verbose mode {}", if self.verbose { "on" } else { "off" }),
            Tone::Info,
            Duration::from_millis(1500),
        );
    }
}

#[cfg(test)]
mod tests {
    fn chip_still_selected(editor_text: &str, chip_index: Option<usize>, chips: &[&str]) -> bool {
        let Some(idx) = chip_index else {
            return false;
        };
        chips
            .get(idx)
            .is_some_and(|chip| editor_text == *chip)
    }

    #[test]
    fn quick_reply_chip_highlight_survives_exact_match() {
        let chips = ["Review this", "Add tests", "Explain"];
        assert!(chip_still_selected("Add tests", Some(1), &chips));
    }

    #[test]
    fn quick_reply_chip_highlight_clears_after_edit() {
        let chips = ["Review this", "Add tests", "Explain"];
        assert!(!chip_still_selected("Add tests please", Some(1), &chips));
    }
}
