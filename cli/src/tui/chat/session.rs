//! Owns the [`ChatSession`] state, the [`run_session`] event loop, and the
//! small state/view-model helpers (dirty tracking, flash messages, the hint
//! and status line computation, transcript scroll, quick-reply staging).

use std::collections::HashSet;
use std::time::{Duration, Instant};

use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};

use ratatui::{
    style::Style,
    text::{Line, Span},
    Terminal,
};

use crate::config::NotificationConfig;
use crate::instance::CapturedOutput;
use crate::models::{AgentEvent, Interaction};
use crate::rpc::{self, EventStream, RpcClient};
use crate::theme::{StatusStyle, Theme, Tone};
use crate::tui::candy::{self, StreamHealth};
use crate::tui::completion;
use crate::tui::editor::InputEditor;
use crate::tui::filesearch;
use crate::tui::keybinds::Keybinds;
use crate::tui::metrics::MetricsHandle;
use crate::tui::notify;
use crate::tui::spinner::spinner_frame;
use crate::tui::text::{format_compact_number, format_currency, shorten_path, visible_len};
use crate::tui::todos::TodosHandle;
use crate::tui::transcript::{EntryKind, Transcript};
use crate::tui::ui_layout::UiHitRegions;
use crate::tui::workspace_search::WorkspaceSearch;
use crate::tui::{AgentHandle, ChatExit};

use super::interactions::ActiveQuestion;
use super::layout::truncate;

/// Spinner cadence (ms) — matches the TS `start()` interval.
pub(super) const SPINNER_INTERVAL: Duration = Duration::from_millis(120);

/// Event-loop poll interval. The loop blocks on `event::poll` for this long
/// between redraws, bounding CPU usage when idle while staying responsive to
/// streaming events and spinner animation.
pub(super) const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// A transient inline message.
pub(super) struct Flash {
    text: String,
    tone: Tone,
    expires_at: Instant,
}

/// Execution lifecycle reconstructed from agent status and input events.
///
/// Keeping these related flags together makes the `running` invariant explicit
/// and gives idle-edge notification logic a single owner.
pub(super) struct ExecutionState {
    pub(super) activity: String,
    pub(super) running: bool,
    pub(super) execution_busy: bool,
    pub(super) queue_busy: bool,
    pub(super) was_running: bool,
}

impl Default for ExecutionState {
    fn default() -> Self {
        Self {
            activity: "Ready".to_string(),
            running: false,
            execution_busy: false,
            queue_busy: false,
            was_running: false,
        }
    }
}

impl ExecutionState {
    pub(super) fn recompute_running(&mut self) {
        self.running = self.queue_busy || self.execution_busy;
    }

    pub(super) fn stop(&mut self) {
        self.queue_busy = false;
        self.execution_busy = false;
        self.running = false;
    }
}

/// Live event-stream connection, cursor, and reconnect state.
pub(super) struct StreamState {
    pub(super) handle: EventStream,
    pub(super) position: usize,
    pub(super) connecting: bool,
    pub(super) reconnect_at: Option<Instant>,
    pub(super) reconnect_delay: Duration,
    pub(super) error: bool,
}

impl StreamState {
    fn new(handle: EventStream) -> Self {
        Self {
            handle,
            position: 0,
            connecting: false,
            reconnect_at: None,
            reconnect_delay: super::events::STREAM_RECONNECT_INITIAL,
            error: false,
        }
    }
}

pub struct ChatSession {
    pub(super) client: RpcClient,
    pub(super) agent: AgentHandle,
    pub(super) transcript: Transcript,
    pub(super) metrics: MetricsHandle,
    pub(super) todos: TodosHandle,
    pub(super) working_directory: String,
    pub(super) home: Option<String>,
    pub(super) execution: ExecutionState,
    pub(super) verbose: bool,
    pub(super) flash: Option<Flash>,
    pub(super) spinner_tick: usize,
    pub(super) last_spinner: Instant,
    pub(super) editor: InputEditor,
    pub(super) history: Vec<String>,
    pub(super) history_index: Option<usize>,
    pub(super) history_draft: String,
    pub(super) commands: Vec<completion::CommandMatch>,
    pub(super) completion: Option<completion::CompletionState>,
    pub(super) dismissed_completion: Option<String>,
    pub(super) provider: String,
    pub(super) workspace_search: WorkspaceSearch,
    pub(super) filesearch: Option<filesearch::FileSearchState>,
    pub(super) dismissed_filesearch: Option<String>,
    pub(super) interactions: Vec<Interaction>,
    pub(super) answered: HashSet<String>,
    pub(super) current_request_id: String,
    pub(super) active_question: Option<ActiveQuestion>,
    pub(super) active_optional_id: Option<String>,
    pub(super) optional_picker_open: bool,
    pub(super) optional_index: usize,
    pub(super) followup_editor: InputEditor,
    pub(super) exit: Option<ChatExit>,
    pub(super) stream: StreamState,
    /// Leader+d pressed once; second press within the window confirms delete.
    pub(super) delete_confirm_pending: Option<Instant>,
    /// Lines scrolled back from the transcript tail (`0` = follow latest).
    pub(super) transcript_scroll_back: usize,
    pub(super) theme: Theme,
    /// Declarative keybind configuration
    pub(super) keybinds: Keybinds,
    /// When `Some`, the leader key was pressed and we await the chord's second
    /// key (stored with the press time for timeout enforcement).
    pub(super) leader_pending: Option<Instant>,
    /// Ctrl+C was pressed recently; a second press within the window exits.
    pub(super) ctrl_c_pending: Option<Instant>,
    /// Quick-reply chip keyboard selection (`1`/`2`/`3`).
    pub(super) selected_chip: Option<usize>,
    /// Whether the one-time narrow-width hint should flash (candy #30).
    pub(super) width_hint_pending: bool,
    /// Shortcut cheat-sheet overlay open (nice-to-have #16).
    pub(super) help_open: bool,
    /// Full command list overlay (`command_list` / Ctrl+P).
    pub(super) command_list_open: bool,
    pub(super) command_list_index: usize,
    /// Metrics sidebar open (`sidebar_toggle`).
    pub(super) sidebar_open: bool,
    /// Expanded status detail overlay (`status_view`).
    pub(super) status_detail_open: bool,
    /// Captured stdout/stderr overlay for a locally launched backend.
    pub(super) instance_output_open: bool,
    pub(super) captured_output: Option<CapturedOutput>,
    /// Theme preset name for cycling (`theme_list`).
    pub(super) theme_name: String,
    /// Send after hydration (nice-to-have #3).
    pub(super) initial_prompt: Option<String>,
    /// Whether this session was started with an automation prompt.
    pub(super) prompt_automation: bool,
    /// Exit on `agent.stopped` when `prompt_automation` (nice-to-have #3).
    pub(super) shutdown_when_done: bool,
    /// Last-frame layout for mouse hit-testing.
    pub(super) hit_regions: UiHitRegions,
    /// Idle notifications (nice-to-have #17).
    pub(super) notifications: NotificationConfig,
    /// Interaction IDs already written to the verbose audit trail.
    pub(super) logged_interactions: HashSet<String>,
    /// Skip full-frame redraws when nothing visible changed.
    pub(super) dirty: bool,
    /// Last known terminal size for resize detection.
    pub(super) terminal_size: (u16, u16),
    /// Maximum meaningful `transcript_scroll_back` from the last render pass.
    pub(super) transcript_max_scroll_back: usize,
    /// Line count from the previous transcript render (for scroll pin while streaming).
    pub(super) prev_transcript_line_count: usize,
    /// Composer text stashed when a required question steals focus.
    pub(super) composer_stash: Option<(String, usize)>,
    /// Last frame reported a terminal too small for the full UI.
    pub(super) terminal_too_small: bool,
}

impl ChatSession {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        client: RpcClient,
        agent: AgentHandle,
        working_directory: String,
        provider: String,
        home: Option<String>,
        history: Vec<String>,
        commands: Vec<completion::CommandMatch>,
        stream: EventStream,
        metrics: MetricsHandle,
        todos: TodosHandle,
        theme: Theme,
        verbose: bool,
        initial_prompt: Option<String>,
        prompt_automation: bool,
        shutdown_when_done: bool,
        notifications: NotificationConfig,
        keybinds: Keybinds,
        theme_name: String,
        captured_output: Option<CapturedOutput>,
    ) -> Self {
        Self {
            client,
            agent,
            transcript: Transcript::new(),
            metrics,
            todos,
            working_directory,
            home,
            execution: ExecutionState::default(),
            verbose,
            flash: None,
            spinner_tick: 0,
            last_spinner: Instant::now(),
            editor: InputEditor::new(),
            history,
            history_index: None,
            history_draft: String::new(),
            commands,
            completion: None,
            dismissed_completion: None,
            provider,
            workspace_search: WorkspaceSearch::default(),
            filesearch: None,
            dismissed_filesearch: None,
            interactions: Vec::new(),
            answered: HashSet::new(),
            current_request_id: String::new(),
            active_question: None,
            active_optional_id: None,
            optional_picker_open: false,
            optional_index: 0,
            followup_editor: InputEditor::new(),
            exit: None,
            stream: StreamState::new(stream),
            delete_confirm_pending: None,
            transcript_scroll_back: 0,
            theme,
            keybinds,
            leader_pending: None,
            ctrl_c_pending: None,
            selected_chip: None,
            width_hint_pending: !candy::width_hint_already_shown(),
            help_open: false,
            command_list_open: false,
            command_list_index: 0,
            sidebar_open: false,
            status_detail_open: false,
            instance_output_open: false,
            captured_output,
            theme_name,
            initial_prompt,
            prompt_automation,
            shutdown_when_done,
            notifications,
            logged_interactions: HashSet::new(),
            dirty: true,
            terminal_size: (0, 0),
            hit_regions: UiHitRegions::default(),
            transcript_max_scroll_back: 0,
            prev_transcript_line_count: 0,
            composer_stash: None,
            terminal_too_small: false,
        }
    }

    pub(super) fn mark_dirty(&mut self) {
        self.dirty = true;
    }

    pub(super) fn needs_redraw(&self) -> bool {
        // Spinner ticks mark dirty when the agent is running; avoid full redraws
        // on every poll while streaming.
        self.dirty || self.instance_output_open
    }

    pub(super) fn handle_resize(&mut self, width: u16, height: u16) {
        let next = (width.max(1), height.max(1));
        let prev_width = self.terminal_size.0;
        if self.terminal_size == (0, 0) {
            self.terminal_size = next;
            // Auto-show the sidebar on wide terminals (≥ 80 cols).
            self.sidebar_open = width >= candy::SPLIT_PANE_WIDTH;
            self.mark_dirty();
            return;
        }
        if self.terminal_size != next {
            self.terminal_size = next;
            self.transcript_scroll_back = 0;
            // Cross the 80-col breakpoint → auto open / close the sidebar column.
            if prev_width < candy::SPLIT_PANE_WIDTH && width >= candy::SPLIT_PANE_WIDTH {
                self.sidebar_open = true;
            } else if prev_width >= candy::SPLIT_PANE_WIDTH && width < candy::SPLIT_PANE_WIDTH {
                self.sidebar_open = false;
            }
            self.flash("Terminal resized.", Tone::Muted, Duration::from_secs(2));
            self.mark_dirty();
        }
    }

    /// Send `--prompt` after hydration (nice-to-have #3).
    pub fn send_initial_prompt(&mut self) {
        let Some(message) = self.initial_prompt.take() else {
            return;
        };
        if message.trim().is_empty() {
            return;
        }
        match rpc::send_input(&self.client, &self.agent.id, &message) {
            Ok(_) => {}
            Err(error) => self.flash(
                format!("Failed to send --prompt: {error:#}"),
                Tone::Error,
                Duration::from_secs(8),
            ),
        }
    }

    pub(super) fn focus_composer(&mut self) {
        self.transcript_scroll_back = 0;
        self.help_open = false;
    }

    pub(super) fn stream_health(&self) -> StreamHealth {
        if self.stream.connecting {
            StreamHealth::Reconnecting
        } else if self.stream.error {
            StreamHealth::Error
        } else {
            StreamHealth::Connected
        }
    }

    pub(super) fn maybe_notify_idle(&mut self) {
        if self.execution.was_running && !self.execution.running {
            if let Some(error) = notify::notify_agent_idle(&self.notifications, &self.agent.label) {
                self.flash(error, Tone::Warning, Duration::from_secs(4));
            }
        }
        self.execution.was_running = self.execution.running;
    }

    /// Replay historical agent events before the live stream attaches.
    pub fn hydrate_from_events(&mut self, events: Vec<serde_json::Value>, position: usize) {
        for event in events {
            self.track_interactions(&event);
            self.apply_event(AgentEvent::from_value(&event));
        }
        self.stream.position = position;
    }

    pub(super) fn flash(&mut self, text: impl Into<String>, tone: Tone, duration: Duration) {
        self.flash = Some(Flash {
            text: text.into(),
            tone,
            expires_at: Instant::now() + duration,
        });
        self.mark_dirty();
    }

    /// Stash in-progress composer text when a question panel takes focus.
    pub(super) fn stash_composer_if_needed(&mut self) {
        if self.composer_stash.is_some() || self.editor.is_empty() {
            return;
        }
        self.composer_stash = Some((self.editor.text(), self.editor.cursor()));
        // Clear without growing undo history for a buffer the user cannot edit
        // while the question owns the footer.
        self.editor.set_text("");
        self.clear_composer_pickers();
        self.mark_dirty();
    }

    /// Restore stashed composer text when no question panel is focused.
    pub(super) fn restore_composer_stash_if_idle(&mut self) {
        if self.active_question.is_some() {
            return;
        }
        let Some((text, cursor)) = self.composer_stash.take() else {
            return;
        };
        self.editor.set_text_with_cursor(&text, cursor);
        self.mark_dirty();
    }

    pub(super) fn take_expired_flash(&mut self) {
        if matches!(&self.flash, Some(f) if f.expires_at <= Instant::now()) {
            self.flash = None;
            // Force a redraw on this iteration so the expired flash text is
            // actually cleared from the screen (otherwise it can linger until
            // the next redraw trigger while the agent is idle).
            self.mark_dirty();
        }
    }

    /// Flash the one-time narrow-terminal width hint (candy #30).
    pub(super) fn maybe_show_width_hint(&mut self, width: u16) {
        if !self.width_hint_pending || width >= candy::SPLIT_PANE_WIDTH {
            return;
        }
        self.width_hint_pending = false;
        candy::mark_width_hint_shown();
        self.flash(
            format!(
                "Widen to {}+ cols for split-pane preview",
                candy::SPLIT_PANE_OPTIMAL
            ),
            Tone::Info,
            Duration::from_secs(6),
        );
    }

    /// Clear a leader-chord that has outlived [`Keybinds::leader_timeout`].
    pub(super) fn expire_leader(&mut self) {
        if let Some(at) = self.leader_pending {
            if at.elapsed() > self.keybinds.leader_timeout {
                self.leader_pending = None;
            }
        }
    }

    /// Whether the session has received user input (for quick-reply chips).
    pub(super) fn has_user_input(&self) -> bool {
        self.transcript
            .entries()
            .iter()
            .any(|e| e.kind == EntryKind::Input)
    }

    /// Quick-reply chip labels for the current session state.
    pub(super) fn quick_reply_chips(&self) -> &'static [&'static str] {
        candy::quick_reply_chips(self.has_user_input())
    }

    /// Copy a quick-reply chip into the main composer by index (`0`-based).
    pub(super) fn stage_quick_reply(&mut self, index: usize) {
        let chips = self.quick_reply_chips();
        let Some(text) = chips.get(index) else {
            return;
        };
        self.editor.set_text(text);
        self.selected_chip = Some(index);
        self.after_edit();
    }

    /// Copy a quick-reply chip into the follow-up composer by index (`0`-based).
    pub(super) fn stage_followup_quick_reply(&mut self, index: usize) {
        let chips = self.quick_reply_chips();
        let Some(text) = chips.get(index) else {
            return;
        };
        self.followup_editor.set_text(text);
        self.selected_chip = Some(index);
    }

    pub(super) fn activity_label(&self) -> String {
        if self.stream.connecting {
            return format!(
                "{} Reconnecting to agent stream…",
                spinner_frame(self.spinner_tick)
            );
        }
        if self.execution.running
            && !self.execution.activity.is_empty()
            && self.execution.activity != "Ready"
        {
            format!(
                "{} {}",
                spinner_frame(self.spinner_tick),
                self.execution.activity
            )
        } else {
            "Ready".to_string()
        }
    }

    /// Build the hint line, mirroring `getHintLine`.
    pub(super) fn hint_line(&self, width: usize) -> Line<'static> {
        let theme = &self.theme;
        let plain = |text: String, tone: Tone| {
            Line::from(Span::styled(
                text,
                Style::default()
                    .fg(tone.color(theme))
                    .bg(theme.hint.background_color.color()),
            ))
        };

        if self.help_open {
            return plain(truncate("Help open · ? or Esc close", width), Tone::Info);
        }

        if let Some(hint) = candy::parse_rate_limit_hint(&self.execution.activity) {
            if self.execution.running {
                return plain(truncate(&hint, width), Tone::Warning);
            }
        }

        // Leader chord in progress.
        if self.leader_pending.is_some() {
            return plain(
                truncate(
                    &format!("{} … awaiting key", self.keybinds.leader_label()),
                    width,
                ),
                Tone::Info,
            );
        }

        // A live flash takes precedence. (Expired flashes are cleared each
        // loop iteration by `take_expired_flash` before this runs.)
        if let Some(flash) = &self.flash {
            if flash.expires_at > Instant::now() {
                return plain(truncate(&flash.text, width), flash.tone);
            }
        }

        if let Some(completion) = &self.completion {
            if !completion.matches.is_empty() {
                return plain(
                    truncate("/ commands · Up/Down move  Enter insert  Esc close", width),
                    Tone::Info,
                );
            }
        }

        if let Some(state) = &self.filesearch {
            let (text, tone) = if state.loading {
                (
                    "@ file search · Indexing workspace files...  Esc close".to_string(),
                    Tone::Info,
                )
            } else if let Some(error) = &state.error {
                (
                    truncate(&format!("@ file search · {error}  Esc close"), width),
                    Tone::Warning,
                )
            } else {
                (
                    "@ file search · Up/Down move  Enter insert  Esc close".to_string(),
                    Tone::Info,
                )
            };
            return plain(text, tone);
        }

        if self.optional_picker_open {
            return plain(
                truncate(
                    "Optional questions · Up/Down move  Enter open  Esc close",
                    width,
                ),
                Tone::Info,
            );
        }

        if self.transcript_scroll_back > 0 && self.transcript_max_scroll_back > 0 {
            return plain(
                truncate(
                    "Viewing earlier transcript · PgUp/PgDn scroll  End follow latest",
                    width,
                ),
                Tone::Info,
            );
        }

        let optional_hint = {
            let count = self.optional_questions().len();
            if count > 0 {
                format!(" · Alt+Q optional {count}")
            } else {
                String::new()
            }
        };

        let leader = self.keybinds.leader_hint_label();
        let muted = Style::default()
            .fg(Tone::Muted.color(theme))
            .bg(theme.hint.background_color.color());
        let hotkeys = if self.execution.running {
            format!(
                "{} · Hotkeys: {leader} + [a] Agents · Esc interrupt{optional_hint}",
                self.activity_label(),
            )
        } else {
            format!(
                "{} · Hotkeys: {leader} + [m] Model · [t] Tools · ",
                self.activity_label(),
            )
        };

        if self.execution.running {
            return Line::from(Span::styled(truncate(&hotkeys, width), muted));
        }

        let verbose_key = "[v] Verbose";
        let suffix = format!(" · [a] Agents{optional_hint}");
        let full = format!("{hotkeys}{verbose_key}{suffix}");
        if visible_len(&full) > width {
            return Line::from(Span::styled(truncate(&full, width), muted));
        }

        let verbose_style = if self.verbose {
            Style::default()
                .fg(Tone::Success.color(theme))
                .bg(theme.hint.background_color.color())
        } else {
            muted
        };

        Line::from(vec![
            Span::styled(hotkeys, muted),
            Span::styled(verbose_key.to_string(), verbose_style),
            Span::styled(suffix, muted),
        ])
    }

    pub(super) fn status_line(&self, width: usize) -> Line<'static> {
        let metrics = self.metrics.get().unwrap_or_default();
        let theme = &self.theme;
        let model = metrics
            .model
            .clone()
            .unwrap_or_else(|| "(no model)".to_string());
        let context_label = metrics
            .context_percent_left
            .map(|p| format!("{p}% context left"))
            .unwrap_or_else(|| "-- context left".to_string());
        let tokens = format_compact_number(Some(metrics.tokens), "");
        let cost = format_currency(Some(metrics.cost));
        let cwd = shorten_path(&self.working_directory, self.home.as_deref());

        match theme.layout.status_style {
            StatusStyle::Inverted => candy::format_status_segments(
                theme,
                self.stream_health(),
                model,
                context_label,
                metrics.context_percent_left,
                metrics.rpc_latency_ms,
                metrics.tools,
                tokens,
                cost,
                cwd,
                width,
            ),
            StatusStyle::Flat => {
                let stream = self.stream_health();
                let segments = [
                    model,
                    context_label,
                    format!("{} tools", metrics.tools),
                    format!("{tokens} tk"),
                    cost,
                    cwd,
                ];
                let detail =
                    candy::format_status_flat(theme, &segments, metrics.context_percent_left);
                let connection = stream.status_text(metrics.rpc_latency_ms);
                let sep = theme.layout.separator.clone();
                let text = truncate(
                    &format!("{connection}{sep}{detail}"),
                    width.saturating_sub(2),
                );
                let mut spans = vec![Span::styled(
                    "● ".to_string(),
                    Style::default().fg(stream.dot_color(theme, metrics.rpc_latency_ms)),
                )];
                spans.push(Span::styled(
                    text,
                    Style::default().fg(theme.status.flat_text_color.color()),
                ));
                Line::from(spans)
            }
        }
    }

    /// Whether quick-reply chips should show above the composer.
    pub(super) fn can_show_quick_replies(&self) -> bool {
        !self.execution.running
            && self.active_question.is_none()
            && self.focused_followup().is_none()
            && !self.optional_picker_open
            && self.filesearch.is_none()
            && self.completion.is_none()
            && self.editor.text().trim().is_empty()
    }

    /// Whether quick-reply chips should show above the follow-up composer.
    pub(super) fn can_show_followup_quick_replies(&self) -> bool {
        !self.execution.running && self.followup_editor.text().trim().is_empty()
    }

    /// Whether transcript scroll keys should be handled (composer idle).
    pub(super) fn can_scroll_transcript(&self) -> bool {
        self.active_question.is_none()
            && self.focused_followup().is_none()
            && !self.optional_picker_open
            && self.filesearch.is_none()
            && self.completion.is_none()
    }

    /// Scroll the transcript away from the tail. Positive `lines` moves up.
    pub(super) fn scroll_transcript(&mut self, lines: i32) {
        if lines > 0 {
            self.transcript_scroll_back = self
                .transcript_scroll_back
                .saturating_add(lines as usize)
                .min(self.transcript_max_scroll_back);
        } else {
            self.transcript_scroll_back = self
                .transcript_scroll_back
                .saturating_sub((-lines) as usize);
        }
    }

    /// Tear down slash-completion and `@` file-search picker state.
    pub(super) fn clear_composer_pickers(&mut self) {
        self.completion = None;
        self.dismissed_completion = None;
        self.filesearch = None;
        self.dismissed_filesearch = None;
        self.workspace_search.clear_picker();
    }
}

/// Run the session loop until it exits. Returns the exit reason.
pub fn run_session<C: ratatui::backend::Backend>(
    terminal: &mut Terminal<C>,
    session: &mut ChatSession,
) -> Result<ChatExit> {
    loop {
        // Terminal hangup / orphaned session: exit before event::poll so we do
        // not spend another timeout spinning on a dead TTY (see tui::tty).
        if !crate::tui::tty::is_alive() {
            return Ok(ChatExit::Quit);
        }

        session.take_expired_flash();
        session.expire_leader();
        session.maybe_reconnect_stream();
        session.drain_stream();
        if session.metrics.refresh() {
            session.mark_dirty();
        }
        let had_todos = !session.todos.is_empty();
        if session.todos.refresh() {
            // Auto-open the sidebar when a todo list first appears (if wide enough).
            if !had_todos
                && !session.todos.is_empty()
                && session.terminal_size.0 >= candy::SPLIT_PANE_WIDTH
            {
                session.sidebar_open = true;
            }
            session.mark_dirty();
        }
        session.drain_search();
        session.maybe_notify_idle();
        session.refresh_active_question();
        let term_size = terminal.size().unwrap_or_default();
        session.handle_resize(term_size.width, term_size.height);
        session.maybe_show_width_hint(term_size.width);
        if session.needs_redraw() {
            match terminal.draw(|frame| super::render::draw(frame, &mut *session)) {
                Ok(_) => session.dirty = false,
                Err(error) => {
                    session.flash(
                        format!("Failed to render UI: {error}"),
                        Tone::Error,
                        Duration::from_secs(10),
                    );
                    session.mark_dirty();
                }
            }
        }

        if let Some(exit) = session.exit.take() {
            return Ok(exit);
        }

        // Prefer terminal key events for Ctrl+C. SIGINT from the same keystroke
        // is cleared when the key is handled so we do not double-count as
        // "press again to exit". External `kill -INT` still reaches the signal path.
        let mut handled_ctrl_c_key = false;
        if event::poll(POLL_INTERVAL)? {
            match event::read()? {
                Event::Key(key) if is_ctrl_c_key(key) => {
                    // Drop any concurrent SIGINT from this keystroke.
                    crate::signal::clear_interrupt();
                    session.handle_ctrl_c();
                    session.mark_dirty();
                    handled_ctrl_c_key = true;
                }
                Event::Key(key) => {
                    session.handle_key(key);
                    session.mark_dirty();
                }
                Event::Paste(text) => {
                    session.handle_paste(&text);
                    session.mark_dirty();
                }
                Event::Mouse(mouse) => {
                    session.handle_mouse(mouse);
                    session.mark_dirty();
                }
                Event::Resize(width, height) => session.handle_resize(width, height),
                _ => {}
            }
        }

        match crate::signal::take_pending() {
            crate::signal::Pending::Terminate => {
                return Ok(ChatExit::Quit);
            }
            crate::signal::Pending::Interrupt if !handled_ctrl_c_key => {
                session.handle_ctrl_c();
                session.mark_dirty();
                if let Some(exit) = session.exit.take() {
                    return Ok(exit);
                }
            }
            crate::signal::Pending::Interrupt | crate::signal::Pending::None => {}
        }

        if let Some(exit) = session.exit.take() {
            return Ok(exit);
        }

        if session.last_spinner.elapsed() >= SPINNER_INTERVAL {
            session.spinner_tick = session.spinner_tick.wrapping_add(1);
            session.last_spinner = Instant::now();
            if session.execution.running {
                session.mark_dirty();
            }
        }
    }
}

fn is_ctrl_c_key(key: KeyEvent) -> bool {
    key.modifiers.contains(KeyModifiers::CONTROL)
        && matches!(key.code, KeyCode::Char('c') | KeyCode::Char('C'))
}

#[cfg(test)]
mod tests {
    use super::ExecutionState;

    #[test]
    fn execution_state_combines_queue_and_input_activity() {
        let mut state = ExecutionState {
            queue_busy: true,
            ..ExecutionState::default()
        };
        state.recompute_running();
        assert!(state.running);

        state.queue_busy = false;
        state.execution_busy = true;
        state.recompute_running();
        assert!(state.running);

        state.execution_busy = false;
        state.recompute_running();
        assert!(!state.running);
    }

    #[test]
    fn stopping_execution_clears_all_busy_flags() {
        let mut state = ExecutionState {
            running: true,
            queue_busy: true,
            execution_busy: true,
            ..ExecutionState::default()
        };
        state.stop();
        assert!(!state.running);
        assert!(!state.queue_busy);
        assert!(!state.execution_busy);
    }
}
