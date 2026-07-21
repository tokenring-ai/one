//! Resolves the currently focused question or follow-up from the live
//! interaction set, (re)creates the active question session, routes input keys
//! to it, and drives the optional-questions picker.

use crossterm::event::KeyEvent;

use crate::models::{Interaction, Question};
use crate::rpc;
use crate::theme::Tone;
use crate::tui::questions::{
    is_confirmation_question, ConfirmSession, FileSession, FormSession, QuestionAction,
    TextSession, TreeSession,
};

use super::ChatSession;

/// The currently-focused question session.
pub(super) struct ActiveQuestion {
    pub(super) id: String,
    /// Server-side auto-submit deadline (unix seconds), if any. Surfaced as a
    /// countdown so users know the server will answer for them shortly.
    pub(super) auto_submit_at: Option<f64>,
    /// Snapshot of the question payload used to detect server-side updates.
    pub(super) question: Question,
    pub(super) session: ActiveSession,
}

pub(super) enum ActiveSession {
    Text(TextSession),
    Tree(TreeSession),
    File(FileSession),
    Form(FormSession),
    Confirm(ConfirmSession),
}

impl ActiveSession {
    pub(super) fn cursor(&self, width: usize) -> Option<(usize, usize)> {
        match self {
            ActiveSession::Text(s) => s.cursor(width),
            ActiveSession::Form(s) => s.cursor(width),
            _ => None,
        }
    }

    fn poll(&mut self, client: &crate::rpc::RpcClient) -> bool {
        match self {
            ActiveSession::File(session) => session.ensure_loaded(client),
            ActiveSession::Form(session) => session.ensure_loaded(client),
            _ => false,
        }
    }
}

impl ChatSession {
    /// The first non-optional, not-yet-answered question, if any.
    pub(super) fn focused_question(&self) -> Option<&Interaction> {
        // Non-optional questions take priority.
        if let Some(q) = self.interactions.iter().find(|i| match i {
            Interaction::Question {
                optional: false,
                interaction_id,
                ..
            } => !self.answered.contains(interaction_id),
            _ => false,
        }) {
            return Some(q);
        }
        // Then an explicitly-selected optional question.
        if let Some(id) = &self.active_optional_id {
            if let Some(q) = self.interactions.iter().find(|i| {
                matches!(i, Interaction::Question { optional: true, interaction_id, .. }
                    if interaction_id == id && !self.answered.contains(interaction_id))
            }) {
                return Some(q);
            }
        }
        None
    }

    /// The optional, not-yet-answered questions (for the Alt+Q picker).
    pub(super) fn optional_questions(&self) -> Vec<&Interaction> {
        self.interactions
            .iter()
            .filter(|i| match i {
                Interaction::Question {
                    optional: true,
                    interaction_id,
                    ..
                } => !self.answered.contains(interaction_id),
                _ => false,
            })
            .collect()
    }

    /// The first not-yet-answered followup, if any.
    pub(super) fn focused_followup(&self) -> Option<&Interaction> {
        self.interactions.iter().find(|i| match i {
            Interaction::Followup { interaction_id, .. } => !self.answered.contains(interaction_id),
            _ => false,
        })
    }

    /// (Re)create the active question session to match the focused question.
    pub(super) fn refresh_active_question(&mut self) {
        let focused = self.focused_question().cloned();
        let focused_id = focused.as_ref().map(|i| i.interaction_id().to_string());

        // Drop the active session if it no longer matches the focused question.
        if let Some(active_id) = self.active_question.as_ref().map(|q| q.id.clone()) {
            if Some(active_id) != focused_id {
                self.active_question = None;
            }
        }

        let Some(Interaction::Question {
            interaction_id,
            question,
            auto_submit_at,
            ..
        }) = focused
        else {
            // No focused question — restore any draft that was stashed for one.
            self.restore_composer_stash_if_idle();
            return;
        };

        if let Some(active) = self.active_question.as_mut() {
            if active.id == interaction_id {
                active.auto_submit_at = auto_submit_at;
                if active.session.poll(&self.client) {
                    self.dirty = true;
                }
                if active.question == question {
                    return;
                }
                self.active_question = None;
            }
        }

        if self.active_question.is_some() {
            return;
        }

        // Any question panel steals the main composer — stash the draft first.
        self.stash_composer_if_needed();

        let question_snapshot = question.clone();
        let mut session = match question {
            Question::Text { .. } => ActiveSession::Text(TextSession::new(question)),
            Question::TreeSelect { .. } if is_confirmation_question(&question_snapshot) => {
                ActiveSession::Confirm(ConfirmSession::new(question))
            }
            Question::TreeSelect { .. } => ActiveSession::Tree(TreeSession::new(question)),
            Question::FileSelect { .. } => {
                let mut fs = FileSession::new(
                    question,
                    self.provider.clone(),
                    self.working_directory.clone(),
                );
                fs.ensure_loaded(&self.client);
                ActiveSession::File(fs)
            }
            Question::Form { .. } => ActiveSession::Form(FormSession::new(
                question,
                self.provider.clone(),
                self.working_directory.clone(),
            )),
        };
        session.poll(&self.client);
        self.active_question = Some(ActiveQuestion {
            id: interaction_id,
            auto_submit_at,
            question: question_snapshot,
            session,
        });
    }

    /// Send an interaction response and mark the interaction answered.
    /// Returns `true` when the RPC succeeded.
    pub(super) fn respond(&mut self, interaction_id: &str, value: serde_json::Value) -> bool {
        if self.current_request_id.is_empty() {
            self.flash(
                "No active interaction is waiting for a response.",
                Tone::Muted,
                std::time::Duration::from_secs(3),
            );
            return false;
        }
        let request_id = self.current_request_id.clone();
        let agent_id = self.agent.id.clone();
        let id = interaction_id.to_string();
        match rpc::send_interaction_response(&self.client, &agent_id, &request_id, &id, value) {
            Ok(()) => {
                self.answered.insert(id);
                self.active_question = None;
                if self.active_optional_id.as_deref() == Some(interaction_id) {
                    self.active_optional_id = None;
                }
                self.optional_picker_open = false;
                self.followup_editor.clear();
                self.restore_composer_stash_if_idle();
                true
            }
            Err(e) => {
                self.flash(e.to_string(), Tone::Error, std::time::Duration::from_secs(5));
                false
            }
        }
    }

    /// Route a key to the active question session. Returns `true` if consumed.
    pub(super) fn handle_question_key(&mut self, key: KeyEvent) -> bool {
        let id = match self.active_question.as_ref().map(|q| q.id.clone()) {
            Some(id) => id,
            None => return false,
        };

        // File sessions need the client for lazy directory loads.
        let action = match self.active_question.as_mut() {
            Some(ActiveQuestion {
                session: ActiveSession::Text(s),
                ..
            }) => s.handle_key(key, &self.keybinds),
            Some(ActiveQuestion {
                session: ActiveSession::Confirm(s),
                ..
            }) => s.handle_key(key),
            Some(ActiveQuestion {
                session: ActiveSession::Tree(s),
                ..
            }) => s.handle_key(key),
            Some(ActiveQuestion {
                session: ActiveSession::File(s),
                ..
            }) => {
                s.ensure_loaded(&self.client);
                s.handle_key(key, &self.client)
            }
            Some(ActiveQuestion {
                session: ActiveSession::Form(s),
                ..
            }) => s.handle_key(key, &self.client, &self.keybinds),
            None => None,
        };

        match action {
            Some(QuestionAction::Submit(value)) => {
                self.respond(&id, value);
                true
            }
            Some(QuestionAction::Cancel) => {
                self.respond(&id, serde_json::Value::Null);
                true
            }
            None => false,
        }
    }

    /// Submit the focused followup's editor contents.
    pub(super) fn submit_followup(&mut self) {
        let Some(Interaction::Followup { interaction_id, .. }) = self.focused_followup().cloned()
        else {
            return;
        };
        let value = self.followup_editor.text().trim().to_string();
        if value.is_empty() {
            self.flash(
                "Type a follow-up reply first.",
                Tone::Muted,
                std::time::Duration::from_secs(2),
            );
            return;
        }
        self.respond(&interaction_id, serde_json::Value::String(value));
    }

    /// Cancel the focused follow-up by sending a null interaction response.
    pub(super) fn cancel_followup(&mut self) {
        let Some(Interaction::Followup { interaction_id, .. }) = self.focused_followup().cloned()
        else {
            return;
        };
        self.respond(&interaction_id, serde_json::Value::Null);
    }

    /// Open the optional question at `index`, closing the picker.
    pub(super) fn select_optional_at_index(&mut self, index: usize) {
        let (clamped, interaction_id) = {
            let optionals = self.optional_questions();
            if optionals.is_empty() {
                return;
            }
            let clamped = index.min(optionals.len() - 1);
            let interaction_id = optionals[clamped].interaction_id().to_string();
            (clamped, interaction_id)
        };
        self.optional_index = clamped;
        self.active_optional_id = Some(interaction_id);
        self.optional_picker_open = false;
        self.refresh_active_question();
    }

    /// Toggle the optional-questions picker (Alt+Q / F6).
    pub(super) fn toggle_optional_picker(&mut self) {
        // Required (non-optional) questions take exclusive focus: mirror the
        // TS `getFocusedQuestion` behaviour of closing the optional picker
        // whenever a required question is outstanding.
        let has_required = self.interactions.iter().any(|i| {
            matches!(i,
                Interaction::Question { optional: false, interaction_id, .. }
                    if !self.answered.contains(interaction_id))
        });
        if has_required {
            self.optional_picker_open = false;
            self.active_optional_id = None;
            self.flash(
                "Answer the required question first.",
                Tone::Muted,
                std::time::Duration::from_secs(2),
            );
            return;
        }
        let count = self.optional_questions().len();
        if count == 0 {
            self.optional_picker_open = false;
            self.flash(
                "No optional questions available.",
                Tone::Muted,
                std::time::Duration::from_secs(2),
            );
            return;
        }
        // Mirror TS `toggleOptionalQuestions`: reopen the picker when already
        // answering an optional question (clears focus so render shows the list).
        if self.active_optional_id.is_some() {
            self.active_optional_id = None;
            self.active_question = None;
            self.optional_picker_open = true;
        } else {
            self.optional_picker_open = !self.optional_picker_open;
        }
        if self.optional_picker_open {
            self.clamp_optional_picker();
        }
    }

    /// Keep the optional-questions picker index in range when the live set changes.
    pub(super) fn clamp_optional_picker(&mut self) {
        let count = self.optional_questions().len();
        if count == 0 {
            self.optional_picker_open = false;
            self.optional_index = 0;
            return;
        }
        self.optional_index = self.optional_index.min(count - 1);
    }
}
