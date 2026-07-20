//! The agent event stream: draining the channel, exponential-backoff reconnect,
//! applying inbound [`AgentEvent`]s to the transcript, and tracking the live
//! `availableInteractions` set.

use std::time::{Duration, Instant};

use serde_json::Value;

use crate::models::{AgentEvent, Interaction};
use crate::rpc::StreamItem;
use crate::theme::Tone;
use crate::tui::ChatExit;

use super::ChatSession;

/// Event-stream reconnect backoff (mirrors `useAgentEventState.ts`).
pub(super) const STREAM_RECONNECT_INITIAL: Duration = Duration::from_millis(1000);
pub(super) const STREAM_RECONNECT_MAX: Duration = Duration::from_millis(30_000);
pub(super) const STREAM_RECONNECT_BACKOFF: f64 = 1.5;

/// Keep the reconnect warning visible until the scheduled attempt fires.
fn reconnect_flash_duration(delay: Duration) -> Duration {
    delay
        .saturating_add(Duration::from_secs(2))
        .max(Duration::from_secs(10))
}

impl ChatSession {
    /// Drain all buffered stream items.
    pub(super) fn drain_stream(&mut self) {
        while let Ok(item) = self.stream_rx.try_recv() {
            match item {
                StreamItem::Events { events, position } => {
                    self.on_stream_connected();
                    self.stream_position = position;
                    for event in events {
                        self.track_interactions(&event);
                        self.apply_event(AgentEvent::from_value(&event));
                    }
                }
                StreamItem::AgentNotFound => {
                    self.flash(
                        format!("Agent not found: {}", self.agent.id),
                        Tone::Error,
                        Duration::from_secs(10),
                    );
                    self.exit = Some(ChatExit::SelectAgent);
                }
                StreamItem::Ended => {
                    self.schedule_stream_reconnect("Event stream closed.".to_string());
                }
                StreamItem::Error(message) => {
                    self.stream_error = true;
                    self.schedule_stream_reconnect(message);
                }
            }
        }
    }

    /// Reset reconnect backoff after a successful stream batch.
    fn on_stream_connected(&mut self) {
        self.stream_connecting = false;
        self.stream_reconnect_at = None;
        self.stream_reconnect_delay = STREAM_RECONNECT_INITIAL;
        self.stream_error = false;
    }

    /// Schedule a reconnect from the last known [`stream_position`].
    pub(super) fn schedule_stream_reconnect(&mut self, message: String) {
        if self.exit.is_some() {
            return;
        }
        self.stream_connecting = true;
        let delay = self.stream_reconnect_delay;
        self.stream_reconnect_delay = Duration::from_secs_f64(
            (delay.as_secs_f64() * STREAM_RECONNECT_BACKOFF)
                .min(STREAM_RECONNECT_MAX.as_secs_f64()),
        );
        self.stream_reconnect_at = Some(Instant::now() + delay);
        let flash_duration = reconnect_flash_duration(delay);
        self.flash(
            format!("{message} Reconnecting in {}s…", delay.as_secs().max(1)),
            Tone::Warning,
            flash_duration,
        );
    }

    /// Open a fresh event stream when a reconnect is due.
    pub(super) fn maybe_reconnect_stream(&mut self) {
        if self.exit.is_some() {
            return;
        }
        let reconnect_due = self
            .stream_reconnect_at
            .is_some_and(|at| Instant::now() >= at);
        if !reconnect_due {
            return;
        }
        self.stream_reconnect_at = None;
        self.stream_rx = self
            .client
            .spawn_event_stream(&self.agent.id, self.stream_position);
        self.flash(
            "Reconnecting to agent event stream…",
            Tone::Info,
            Duration::from_secs(3),
        );
    }

    /// Track the live `availableInteractions` set from `input.execution` events
    /// (mirrors how `AgentEventState` reconstructs
    /// `currentlyExecutingInputItem.executionState.availableInteractions`).
    pub(super) fn track_interactions(&mut self, event: &Value) {
        if event.get("type").and_then(Value::as_str) != Some("input.execution") {
            return;
        }
        if let Some(request_id) = event.get("requestId").and_then(Value::as_str) {
            self.current_request_id = request_id.to_string();
        }
        let status = event.get("status").and_then(Value::as_str).unwrap_or("");
        if status == "finished" {
            self.interactions.clear();
            self.answered.clear();
            self.active_question = None;
            self.active_optional_id = None;
            self.logged_interactions.clear();
            self.current_request_id.clear();
            self.followup_editor.clear();
            self.clear_composer_pickers();
            self.clamp_optional_picker();
            return;
        }
        if event.get("availableInteractions").is_some() {
            self.interactions = Interaction::parse_all(event);
            let live: std::collections::HashSet<String> = self
                .interactions
                .iter()
                .map(|i| i.interaction_id().to_string())
                .collect();
            if self.verbose {
                let pending: Vec<_> = self
                    .interactions
                    .iter()
                    .filter(|interaction| {
                        !self
                            .logged_interactions
                            .contains(interaction.interaction_id())
                    })
                    .cloned()
                    .collect();
                for interaction in pending {
                    self.logged_interactions
                        .insert(interaction.interaction_id().to_string());
                    self.transcript.log_interaction_request(&interaction);
                    self.mark_dirty();
                }
            }
            self.answered.retain(|id| live.contains(id));

            // Drop stale followup/question session state when an interaction
            // vanishes from the live set (port of `cleanupInteractionState`).
            if let Some(id) = self.active_optional_id.as_ref() {
                if !live.contains(id) {
                    self.active_optional_id = None;
                    self.optional_picker_open = false;
                }
            }
            if let Some(aq) = self.active_question.as_ref() {
                if !live.contains(&aq.id) {
                    self.active_question = None;
                }
            }

            // A pending required question reclaims exclusive focus.
            let has_required = self.interactions.iter().any(|i| {
                matches!(i,
                    Interaction::Question { optional: false, interaction_id, .. }
                        if !self.answered.contains(interaction_id))
            });
            if has_required {
                self.optional_picker_open = false;
                self.active_optional_id = None;
            }

            self.clamp_optional_picker();
            if self.focused_followup().is_none() {
                self.followup_editor.clear();
            }
        }
    }

    pub(super) fn apply_event(&mut self, event: AgentEvent) {
        if let Err(message) = self.try_apply_event(event) {
            self.flash(message, Tone::Error, Duration::from_secs(10));
        }
        self.mark_dirty();
        self.maybe_notify_idle();
    }

    fn try_apply_event(&mut self, event: AgentEvent) -> Result<(), String> {
        match &event {
            AgentEvent::AgentStatus {
                current_activity,
                input_execution_queue,
                ..
            } => {
                self.running = !input_execution_queue.is_empty();
                self.current_activity = if current_activity.is_empty() {
                    "Ready".to_string()
                } else {
                    current_activity.clone()
                };
            }
            AgentEvent::InputExecution {
                status,
                current_activity,
                ..
            } => {
                self.running = status != "finished";
                if let Some(activity) = current_activity {
                    self.current_activity = activity.clone();
                }
            }
            AgentEvent::AgentStopped { .. } => {
                if self.shutdown_when_done && self.prompt_automation {
                    self.exit = Some(ChatExit::Quit);
                } else {
                    self.exit = Some(ChatExit::SelectAgent);
                }
            }
            _ => {}
        }
        self.transcript.apply(&event, self.verbose);
        let drained = self.transcript.take_last_drain();
        self.reconcile_expanded_tool_entries(drained);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reconnect_flash_outlasts_short_backoff() {
        assert_eq!(
            reconnect_flash_duration(Duration::from_secs(3)),
            Duration::from_secs(10)
        );
    }

    #[test]
    fn reconnect_flash_tracks_long_backoff() {
        assert_eq!(
            reconnect_flash_duration(Duration::from_secs(20)),
            Duration::from_secs(22)
        );
    }
}
