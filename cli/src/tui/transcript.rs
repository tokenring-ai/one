//! The chat transcript model: an ordered list of entries with streaming-merge
//! semantics for `output.chat` / `output.reasoning`. Ports the transcript
//! state machine in `RawChatUI` (`classifyTranscriptEvent` +
//! `applyTranscriptEvent`).

use crate::models::questions::Interaction;
use crate::models::{AgentEvent, AgentResponse, Attachment, ToolCallResult};
use crate::theme::Tone;
use crate::tui::diff::{self, AttachmentDisplayKind};
use crate::tui::text::trim_boundary_newlines;

/// Maximum entries retained in memory.
const MAX_ENTRIES: usize = 500;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntryKind {
    System,
    Chat,
    Reasoning,
    Info,
    Warning,
    Error,
    Attachment,
    ToolCall,
    Response,
    Input,
    Interaction,
}

/// Whether an entry's full content is only shown in verbose mode.
impl EntryKind {
    /// Whether the entry is omitted entirely in compact (non-verbose) mode.
    ///
    /// Attachments stay visible so attachment names/descriptions always show.
    /// Tool-call diffs may also expose their compact body immediately.
    pub fn hidden_in_compact(self) -> bool {
        matches!(self, EntryKind::Interaction | EntryKind::Reasoning)
    }
}

#[derive(Clone, Debug)]
pub struct TranscriptEntry {
    pub kind: EntryKind,
    pub title: String,
    pub body: String,
    pub verbose_body: Option<String>,
    pub tone: Tone,
    /// MIME type for [`EntryKind::Attachment`] entries — drives diff colouring
    /// via [`diff::is_diff_mime`] (never content-sniffed).
    pub mime_type: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StreamType {
    Chat,
    Reasoning,
}

struct ActiveStream {
    index: usize,
    stream_type: StreamType,
}

#[derive(Default)]
pub struct Transcript {
    entries: Vec<TranscriptEntry>,
    active_stream: Option<ActiveStream>,
}

impl Transcript {
    pub fn new() -> Self {
        Self::default()
    }

    /// All entries (including verbose-only ones; filter at render time).
    pub fn entries(&self) -> &[TranscriptEntry] {
        &self.entries
    }

    /// Index of the entry currently receiving stream chunks, if any.
    pub fn streaming_entry_index(&self) -> Option<usize> {
        self.active_stream.as_ref().map(|s| s.index)
    }

    /// Record a live interaction request for the verbose audit trail.
    pub fn log_interaction_request(&mut self, interaction: &Interaction) {
        self.clear_stream();
        let (title, body) = format_live_interaction(interaction);
        self.add(EntryKind::Interaction, title, body, Tone::Ask);
    }

    /// Whether the active stream is chat output (vs reasoning).
    pub fn is_streaming_chat(&self) -> bool {
        matches!(
            self.active_stream.as_ref().map(|s| s.stream_type),
            Some(StreamType::Chat)
        )
    }

    /// Whether the active stream is reasoning output.
    pub fn is_streaming_reasoning(&self) -> bool {
        matches!(
            self.active_stream.as_ref().map(|s| s.stream_type),
            Some(StreamType::Reasoning)
        )
    }

    /// Apply one agent event to the transcript state.
    pub fn apply(&mut self, event: &AgentEvent, verbose: bool) {
        match event {
            AgentEvent::AgentCreated { message, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::System,
                    "System".to_string(),
                    message.clone(),
                    Tone::Info,
                );
            }
            AgentEvent::OutputChat { message, .. } => {
                self.append_stream(StreamType::Chat, "Assistant", message, Tone::Chat);
            }
            AgentEvent::OutputReasoning { message, .. } => {
                self.append_stream(StreamType::Reasoning, "Reasoning", message, Tone::Reasoning);
            }
            AgentEvent::OutputInfo { message, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::Info,
                    "Info".to_string(),
                    message.clone(),
                    Tone::Info,
                );
            }
            AgentEvent::OutputWarning { message, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::Warning,
                    "Warning".to_string(),
                    message.clone(),
                    Tone::Warning,
                );
            }
            AgentEvent::OutputError { message, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::Error,
                    "Error".to_string(),
                    message.clone(),
                    Tone::Error,
                );
            }
            AgentEvent::ToolCall { tool, .. } => {
                self.clear_stream();
                self.add_with_verbose(
                    EntryKind::ToolCall,
                    tool.name.clone(),
                    tool.message.clone(),
                    Some(format_tool_call_actions(tool)),
                    if tool.failed {
                        Tone::Error
                    } else {
                        Tone::Success
                    },
                );
                self.add_tool_attachments(&tool.attachments);
            }
            AgentEvent::AgentResponse(response) => {
                self.clear_stream();
                match response {
                    AgentResponse::Success {
                        message,
                        attachments,
                        ..
                    } => {
                        self.add(
                            EntryKind::Response,
                            "Response".to_string(),
                            message.clone(),
                            Tone::Success,
                        );
                        self.add_attachments(attachments);
                    }
                    AgentResponse::Cancelled { message, .. } => {
                        self.add(
                            EntryKind::Response,
                            "Cancelled".to_string(),
                            message.clone(),
                            Tone::Warning,
                        );
                    }
                    AgentResponse::Error { message, .. } => {
                        self.add(
                            EntryKind::Response,
                            "Error".to_string(),
                            message.clone(),
                            Tone::Error,
                        );
                    }
                }
            }
            AgentEvent::InputReceived { input, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::Input,
                    "You".to_string(),
                    input.message.clone(),
                    Tone::Input,
                );
                self.add_attachments(&input.attachments);
            }
            AgentEvent::Interaction { raw, .. } => {
                self.clear_stream();
                if verbose {
                    if let Some((title, body)) = format_interaction_entry(raw) {
                        self.add(EntryKind::Interaction, title, body, Tone::Ask);
                    }
                }
            }
            // Status/lifecycle events finalize the active stream but add nothing.
            AgentEvent::AgentStopped { .. }
            | AgentEvent::AgentStatus { .. }
            | AgentEvent::InputExecution { .. }
            | AgentEvent::Cancel { .. } => self.clear_stream(),
            // Unknown types: clear the stream and leave a diagnostic entry so
            // schema drift is visible (especially in verbose mode).
            AgentEvent::Unknown { type_name, preview } => {
                self.clear_stream();
                let title = format!("Unknown event: {type_name}");
                let body = if preview.is_empty() {
                    format!("Unrecognized agent event type `{type_name}`.")
                } else {
                    format!("Unrecognized agent event type `{type_name}`.\n{preview}")
                };
                self.add_with_verbose(
                    EntryKind::System,
                    title,
                    format!("Unrecognized agent event type `{type_name}`."),
                    Some(body),
                    Tone::Muted,
                );
            }
        }
    }

    fn add(&mut self, kind: EntryKind, title: String, body: String, tone: Tone) {
        self.add_with_verbose(kind, title, body, None, tone);
    }

    fn add_with_verbose(
        &mut self,
        kind: EntryKind,
        title: String,
        body: String,
        verbose_body: Option<String>,
        tone: Tone,
    ) {
        self.entries.push(TranscriptEntry {
            kind,
            title,
            body,
            verbose_body,
            tone,
            mime_type: None,
        });
        self.enforce_max_entries();
    }

    /// Append one [`EntryKind::Attachment`] row per attachment (input, tool call,
    /// or success response). Diff colouring is keyed off `mime_type`.
    fn add_attachments(&mut self, attachments: &[Attachment]) {
        for attachment in attachments {
            self.add_attachment(attachment, false);
        }
    }

    fn add_tool_attachments(&mut self, attachments: &[Attachment]) {
        for attachment in attachments {
            self.add_attachment(attachment, diff::is_diff_mime(&attachment.mime_type));
        }
    }

    fn add_attachment(&mut self, attachment: &Attachment, show_body_in_compact: bool) {
        let (body, verbose_body) = format_attachment_bodies(attachment, show_body_in_compact);
        self.entries.push(TranscriptEntry {
            kind: EntryKind::Attachment,
            // Include MIME in the title as a fallback for title-based detection.
            title: format!("Attachment: {} ({})", attachment.name, attachment.mime_type),
            body,
            verbose_body,
            tone: Tone::Info,
            mime_type: Some(attachment.mime_type.clone()),
        });
        self.enforce_max_entries();
    }

    fn clear_stream(&mut self) {
        self.active_stream = None;
    }

    fn enforce_max_entries(&mut self) {
        if self.entries.len() <= MAX_ENTRIES {
            return;
        }
        let drain = self.entries.len() - MAX_ENTRIES;
        self.entries.drain(0..drain);
        if let Some(active) = &mut self.active_stream {
            if active.index >= drain {
                active.index -= drain;
            } else {
                self.active_stream = None;
            }
        }
    }

    fn append_stream(&mut self, stream_type: StreamType, title: &str, message: &str, tone: Tone) {
        if let Some(active) = &self.active_stream {
            if active.stream_type == stream_type {
                if let Some(entry) = self.entries.get_mut(active.index) {
                    entry.body.push_str(message);
                    return;
                }
            }
        }

        let index = self.entries.len();
        self.entries.push(TranscriptEntry {
            kind: match stream_type {
                StreamType::Chat => EntryKind::Chat,
                StreamType::Reasoning => EntryKind::Reasoning,
            },
            title: title.to_string(),
            body: message.to_string(),
            verbose_body: None,
            tone,
            mime_type: None,
        });
        self.active_stream = Some(ActiveStream { index, stream_type });
        self.enforce_max_entries();
    }
}

/// Format an `input.interaction` event (`InteractionResponseSchema`) for the
/// verbose audit trail.
fn format_interaction_entry(raw: &serde_json::Value) -> Option<(String, String)> {
    if raw.get("type").and_then(|v| v.as_str()) != Some("input.interaction") {
        return None;
    }
    let interaction_id = raw
        .get("interactionId")
        .and_then(|v| v.as_str())
        .unwrap_or("?");
    let result = raw
        .get("result")
        .map(|v| v.to_string())
        .unwrap_or_else(|| "null".to_string());
    Some((
        "Interaction response".to_string(),
        format!("id: {interaction_id}\nresult: {result}"),
    ))
}

fn format_live_interaction(interaction: &Interaction) -> (String, String) {
    match interaction {
        Interaction::Followup {
            interaction_id,
            message,
        } => (
            "Interaction request".to_string(),
            format!("id: {interaction_id}\ntype: followup\n{message}"),
        ),
        Interaction::Question {
            interaction_id,
            message,
            question,
            optional,
            auto_submit_at,
        } => {
            let mut body = format!(
                "id: {interaction_id}\ntype: question\noptional: {optional}\n{}",
                question.label()
            );
            if !message.is_empty() {
                body.push_str(&format!("\n{message}"));
            }
            if let Some(ts) = auto_submit_at {
                body.push_str(&format!("\nauto-submit-at: {ts}"));
            }
            ("Interaction request".to_string(), body)
        }
    }
}

/// Format the verbose-only action list as muted continuations of the tool
/// message. Each item starts with `└` to visually connect it to that message.
fn format_tool_call_actions(tool: &ToolCallResult) -> String {
    let mut lines = Vec::new();
    for action in &tool.actions {
        let action_text = trim_boundary_newlines(action);
        if action_text.is_empty() {
            continue;
        }
        let mut parts = action_text.split('\n');
        if let Some(first) = parts.next() {
            lines.push(format!("└  {first}"));
            for rest in parts {
                lines.push(format!("   {rest}"));
            }
        }
    }
    lines.join("\n")
}

/// Compact body under the artifact title: description only (name + MIME live
/// on the title so the compact view is not redundant).
fn attachment_compact_body(attachment: &Attachment) -> String {
    attachment
        .description
        .as_deref()
        .filter(|d| !d.is_empty())
        .unwrap_or("")
        .to_string()
}

/// Decode attachment body for text/diff display.
fn decode_attachment_text(attachment: &Attachment) -> String {
    if attachment.encoding == "href" {
        return attachment.body.clone();
    }
    if attachment.encoding == "base64" {
        use base64::{engine::general_purpose, Engine as _};
        return general_purpose::STANDARD
            .decode(&attachment.body)
            .ok()
            .and_then(|b| String::from_utf8(b).ok())
            .unwrap_or_default();
    }
    attachment.body.clone()
}

/// Build compact + optional verbose bodies for an attachment entry.
///
/// - **Title** always carries `Attachment: name (mime)`.
/// - **Diff / text**: compact = description unless `show_body_in_compact` is
///   requested for a tool diff; verbose = decoded content. Diff bodies remain
///   pure content so MIME-keyed colouring applies cleanly.
/// - **Audio / video / image / other**: description only — never the binary body.
fn format_attachment_bodies(
    attachment: &Attachment,
    show_body_in_compact: bool,
) -> (String, Option<String>) {
    let compact = attachment_compact_body(attachment);
    match diff::attachment_display_kind(&attachment.mime_type) {
        AttachmentDisplayKind::MetaOnly => (compact, None),
        AttachmentDisplayKind::Diff => {
            let content = decode_attachment_text(attachment);
            if show_body_in_compact {
                (content.clone(), Some(content))
            } else {
                (compact, Some(content))
            }
        }
        AttachmentDisplayKind::Text => {
            let content = decode_attachment_text(attachment);
            let verbose = if attachment.encoding == "href" {
                format!("[{content}]({content})")
            } else if diff::primary_mime(&attachment.mime_type) == "application/json" {
                format!("```json\n{content}\n```")
            } else {
                content
            };
            (compact, Some(verbose))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::AgentEvent;

    #[test]
    fn streams_merge_consecutive_chunks() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::OutputChat {
                message: "Hello".into(),
                timestamp: 0.0,
            },
            false,
        );
        t.apply(
            &AgentEvent::OutputChat {
                message: ", world".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), 1);
        assert_eq!(t.entries()[0].body, "Hello, world");
        assert!(t.is_streaming_chat());
    }

    #[test]
    fn non_stream_event_breaks_the_stream() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::OutputChat {
                message: "Hi".into(),
                timestamp: 0.0,
            },
            false,
        );
        t.apply(
            &AgentEvent::OutputInfo {
                message: "info".into(),
                timestamp: 0.0,
            },
            false,
        );
        t.apply(
            &AgentEvent::OutputChat {
                message: "Again".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), 3);
        assert_eq!(t.entries()[0].body, "Hi");
        assert_eq!(t.entries()[2].body, "Again");
    }

    #[test]
    fn enforce_max_entries_reindexes_active_stream() {
        let mut t = Transcript::new();
        for i in 0..MAX_ENTRIES {
            t.apply(
                &AgentEvent::OutputInfo {
                    message: format!("line {i}"),
                    timestamp: 0.0,
                },
                false,
            );
        }
        t.apply(
            &AgentEvent::OutputChat {
                message: "stream".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), MAX_ENTRIES);
        assert!(t.is_streaming_chat());
        t.apply(
            &AgentEvent::OutputChat {
                message: "!".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().last().map(|e| e.body.as_str()), Some("stream!"));
    }

    #[test]
    fn reasoning_is_verbose_only_kind() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::OutputReasoning {
                message: "thinking".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert!(t.entries()[0].kind.hidden_in_compact());
    }

    fn sample_attachment(
        name: &str,
        mime: &str,
        body: &str,
        description: Option<&str>,
    ) -> Attachment {
        Attachment {
            name: name.into(),
            description: description.map(str::to_string),
            encoding: "text".into(),
            mime_type: mime.into(),
            body: body.into(),
            send_to_llm: false,
        }
    }

    #[test]
    fn success_response_emits_attachment_artifacts() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::AgentResponse(AgentResponse::Success {
                message: "done".into(),
                request_id: "req-1".into(),
                attachments: vec![sample_attachment(
                    "patch.diff",
                    "text/x-diff",
                    "--- a\n+++ b\n",
                    None,
                )],
                timestamp: 0.0,
            }),
            false,
        );
        assert_eq!(t.entries().len(), 2);
        assert_eq!(t.entries()[0].kind, EntryKind::Response);
        assert_eq!(t.entries()[0].title, "Response");
        assert_eq!(t.entries()[1].kind, EntryKind::Attachment);
        assert!(t.entries()[1].title.contains("patch.diff"));
        assert_eq!(t.entries()[1].mime_type.as_deref(), Some("text/x-diff"));
        // Verbose body is pure diff content (no header) for colouring.
        assert_eq!(
            t.entries()[1].verbose_body.as_deref(),
            Some("--- a\n+++ b\n")
        );
        assert!(!t.entries()[1].kind.hidden_in_compact());
    }

    #[test]
    fn input_received_emits_attachments() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::InputReceived {
                input: crate::models::events::InputMessage {
                    from: "CLI".into(),
                    message: "see file".into(),
                    request_id: "req".into(),
                    attachments: vec![sample_attachment(
                        "notes.md",
                        "text/markdown",
                        "# hi",
                        Some("user notes"),
                    )],
                },
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), 2);
        assert_eq!(t.entries()[0].kind, EntryKind::Input);
        assert_eq!(t.entries()[1].kind, EntryKind::Attachment);
        assert!(t.entries()[1].title.contains("notes.md"));
        assert!(t.entries()[1].title.contains("text/markdown"));
        assert_eq!(t.entries()[1].body, "user notes");
        assert_eq!(t.entries()[1].verbose_body.as_deref(), Some("# hi"));
    }

    #[test]
    fn tool_call_emits_attachments() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::ToolCall {
                tool: ToolCallResult {
                    name: "git.diff".into(),
                    args: serde_json::Map::new(),
                    message: "**Git** Compared working tree".into(),
                    result: "ok".into(),
                    actions: vec!["Compared HEAD".into()],
                    failed: false,
                    attachments: vec![sample_attachment(
                        "change.diff",
                        "text/x-diff",
                        "--- a\n+++ b\n",
                        None,
                    )],
                    timestamp: 0.0,
                },
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), 2);
        assert_eq!(t.entries()[0].kind, EntryKind::ToolCall);
        assert_eq!(t.entries()[0].body, "**Git** Compared working tree");
        assert_eq!(t.entries()[0].tone, Tone::Success);
        assert_eq!(
            t.entries()[0].verbose_body.as_deref(),
            Some("└  Compared HEAD")
        );
        assert_eq!(t.entries()[1].kind, EntryKind::Attachment);
        assert_eq!(t.entries()[1].mime_type.as_deref(), Some("text/x-diff"));
        assert_eq!(t.entries()[1].body, "--- a\n+++ b\n");
    }

    #[test]
    fn failed_tool_call_uses_error_tone() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::ToolCall {
                tool: ToolCallResult {
                    name: "search".into(),
                    args: serde_json::Map::new(),
                    message: "**Search** Found nothing".into(),
                    result: "no matches".into(),
                    actions: vec![],
                    failed: true,
                    attachments: vec![],
                    timestamp: 0.0,
                },
                timestamp: 0.0,
            },
            false,
        );

        assert_eq!(t.entries()[0].tone, Tone::Error);
    }

    #[test]
    fn media_attachments_are_meta_only() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::AgentResponse(AgentResponse::Success {
                message: "shot".into(),
                request_id: "req".into(),
                attachments: vec![
                    sample_attachment("pic.png", "image/png", "iVBORw0KGgo=", Some("screenshot")),
                    sample_attachment("clip.wav", "audio/wav", "////", None),
                    sample_attachment("clip.mp4", "video/mp4", "////", None),
                ],
                timestamp: 0.0,
            }),
            false,
        );
        assert_eq!(t.entries().len(), 4); // response + 3 artifacts
        for entry in &t.entries()[1..] {
            assert_eq!(entry.kind, EntryKind::Attachment);
            // No decoded body for media — name/description only.
            assert!(entry.verbose_body.is_none());
            assert!(!entry.body.contains("iVBORw0KGgo"));
            assert!(!entry.body.contains("////"));
        }
        assert!(t.entries()[1].title.contains("pic.png"));
        assert!(t.entries()[1].title.contains("image/png"));
        assert_eq!(t.entries()[1].body, "screenshot");
        assert!(t.entries()[2].title.contains("clip.wav"));
        assert_eq!(t.entries()[2].body, "");
    }

    #[test]
    fn cancelled_and_error_responses_have_distinct_titles() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::AgentResponse(AgentResponse::Cancelled {
                message: "stopped".into(),
                request_id: "req-1".into(),
                timestamp: 0.0,
            }),
            false,
        );
        t.apply(
            &AgentEvent::AgentResponse(AgentResponse::Error {
                message: "boom".into(),
                request_id: "req-2".into(),
                timestamp: 0.0,
            }),
            false,
        );
        assert_eq!(t.entries()[0].title, "Cancelled");
        assert_eq!(t.entries()[0].tone, Tone::Warning);
        assert_eq!(t.entries()[1].title, "Error");
        assert_eq!(t.entries()[1].tone, Tone::Error);
    }

    #[test]
    fn interaction_response_events_format_for_verbose_trail() {
        let raw = serde_json::json!({
            "type": "input.interaction",
            "interactionId": "q1",
            "result": "yes"
        });
        let (title, body) = format_interaction_entry(&raw).expect("response formats");
        assert_eq!(title, "Interaction response");
        assert!(body.contains("q1"));
        assert!(body.contains("yes"));
    }

    #[test]
    fn unknown_event_adds_diagnostic_entry() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::Unknown {
                type_name: "future.thing".into(),
                preview: r#"{"type":"future.thing"}"#.into(),
            },
            false,
        );
        assert_eq!(t.entries().len(), 1);
        assert_eq!(t.entries()[0].kind, EntryKind::System);
        assert!(t.entries()[0].title.contains("future.thing"));
        assert!(t.entries()[0]
            .verbose_body
            .as_ref()
            .is_some_and(|b| b.contains("future.thing")));
    }

    #[test]
    fn reasoning_stream_tracks_active_kind() {
        let mut t = Transcript::new();
        t.apply(
            &AgentEvent::OutputReasoning {
                message: "step one".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert!(t.is_streaming_reasoning());
        assert!(!t.is_streaming_chat());
        t.apply(
            &AgentEvent::OutputChat {
                message: "answer".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert!(!t.is_streaming_reasoning());
        assert!(t.is_streaming_chat());
    }
}
