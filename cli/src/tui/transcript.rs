//! The chat transcript model: an ordered list of entries with streaming-merge
//! semantics for `output.chat` / `output.reasoning`. Ports the transcript
//! state machine in `RawChatUI` (`classifyTranscriptEvent` +
//! `applyTranscriptEvent`).

use crate::models::questions::Interaction;
use crate::models::{AgentEvent, Attachment, ToolCallResult};
use crate::theme::Tone;
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
    Artifact,
    ToolCall,
    Response,
    Input,
    Interaction,
}

/// Whether an entry's full content is only shown in verbose mode.
impl EntryKind {
    /// Whether the entry is omitted entirely in compact (non-verbose) mode.
    pub fn hidden_in_compact(self) -> bool {
        matches!(self, EntryKind::Artifact | EntryKind::Interaction)
    }
}

#[derive(Clone, Debug)]
pub struct TranscriptEntry {
    pub kind: EntryKind,
    pub title: String,
    pub body: String,
    pub verbose_body: Option<String>,
    pub tone: Tone,
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
    /// Entries dropped by the most recent capacity enforcement pass.
    last_drain: usize,
}

impl Transcript {
    pub fn new() -> Self {
        Self::default()
    }

    #[allow(dead_code)] // Session reset hook for future multi-agent flows.
    pub fn clear(&mut self) {
        self.entries.clear();
        self.active_stream = None;
    }

    /// All entries (including verbose-only ones; filter at render time).
    pub fn entries(&self) -> &[TranscriptEntry] {
        &self.entries
    }

    /// Whether there is an active streaming entry.
    #[allow(dead_code)] // Stream-state hook for future spinner/detail UI.
    pub fn is_streaming(&self) -> bool {
        self.active_stream.is_some()
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

    /// How many leading entries were dropped by the last capacity enforcement.
    pub fn take_last_drain(&mut self) -> usize {
        let drained = self.last_drain;
        self.last_drain = 0;
        drained
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
            AgentEvent::OutputArtifact { attachment, .. } => {
                self.clear_stream();
                self.add_with_verbose(
                    EntryKind::Artifact,
                    format!("Artifact: {}", attachment.name),
                    format_artifact_body(attachment, false),
                    Some(format_artifact_body(attachment, true)),
                    Tone::Info,
                );
            }
            AgentEvent::ToolCall { tool, .. } => {
                self.clear_stream();
                self.add_with_verbose(
                    EntryKind::ToolCall,
                    tool.summary.clone(),
                    format_tool_call_body(tool, false),
                    Some(format_tool_call_body(tool, true)),
                    Tone::Info,
                );
            }
            AgentEvent::AgentResponse {
                status, message, ..
            } => {
                self.clear_stream();
                let (title, tone) = if status == "success" {
                    ("Response".to_string(), Tone::Success)
                } else {
                    ("Error".to_string(), Tone::Error)
                };
                self.add(EntryKind::Response, title, message.clone(), tone);
            }
            AgentEvent::InputReceived { input, .. } => {
                self.clear_stream();
                self.add(
                    EntryKind::Input,
                    "You".to_string(),
                    input.message.clone(),
                    Tone::Input,
                );
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
            | AgentEvent::Cancel { .. }
            | AgentEvent::Unknown { .. } => self.clear_stream(),
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
        self.last_drain += drain;
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
        });
        self.active_stream = Some(ActiveStream { index, stream_type });
        self.enforce_max_entries();
    }
}

/// Format an `input.interaction` response event for the verbose audit trail.
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

/// Port of `formatToolCallBody` (`ChatRenderUtils.ts`). Renders actions with
/// `├`/`│`/`└` tree continuity (candy #15). When `include_result` is true
/// (verbose mode), also includes the raw tool result.
pub fn format_tool_call_body(tool: &ToolCallResult, include_result: bool) -> String {
    format_tool_call_body_collapsed(tool, include_result, true)
}

/// Format tool actions, optionally collapsing to the first action only.
pub fn format_tool_call_body_collapsed(
    tool: &ToolCallResult,
    include_result: bool,
    expanded: bool,
) -> String {
    let mut action_lines: Vec<Vec<String>> = Vec::new();
    for action in &tool.actions {
        let action_text = trim_boundary_newlines(action);
        if action_text.is_empty() {
            continue;
        }
        let mut parts = action_text.split('\n');
        let mut lines = Vec::new();
        if let Some(first) = parts.next() {
            lines.push(first.to_string());
            for rest in parts {
                lines.push(rest.to_string());
            }
        }
        if !lines.is_empty() {
            action_lines.push(lines);
        }
    }

    if !expanded && action_lines.len() > 1 {
        let first = &action_lines[0];
        let mut lines = vec![format!("└ {}", first[0])];
        for rest in first.iter().skip(1) {
            lines.push(format!("   {rest}"));
        }
        lines.push(format!(
            "   … {} more actions (Enter to expand)",
            action_lines.len() - 1
        ));
        return lines.join("\n");
    }

    let action_count = action_lines.len();
    let mut lines = Vec::new();
    for (ai, action) in action_lines.iter().enumerate() {
        let is_last_action = ai + 1 == action_count;
        for (li, line) in action.iter().enumerate() {
            let is_last_line = li + 1 == action.len();
            let branch = if is_last_action && is_last_line {
                '└'
            } else if is_last_line {
                '├'
            } else {
                '│'
            };
            let prefix = if li == 0 {
                format!("{branch} ")
            } else if is_last_action {
                "  ".to_string()
            } else {
                format!("{branch} ")
            };
            lines.push(format!("{prefix}{line}"));
        }
    }
    if include_result {
        let result = trim_boundary_newlines(&tool.result);
        if !result.is_empty() {
            if lines.is_empty() {
                lines.push(result.to_string());
            } else {
                lines.push(format!("└ result: {result}"));
            }
        }
    }
    lines.join("\n")
}

/// Port of `formatArtifactBody` (`ChatRenderUtils.ts`). Shows a header line
/// always; in verbose mode also decodes and includes the body content.
fn format_artifact_body(attachment: &Attachment, verbose: bool) -> String {
    let header = format!("{} ({})", attachment.name, attachment.mime_type);
    if !verbose {
        return header;
    }
    let body = if attachment.encoding == "href" {
        format!("[{}]({})", attachment.body, attachment.body)
    } else {
        let decoded = if attachment.encoding == "base64" {
            use base64::{engine::general_purpose, Engine as _};
            general_purpose::STANDARD
                .decode(&attachment.body)
                .ok()
                .and_then(|b| String::from_utf8(b).ok())
                .unwrap_or_default()
        } else {
            attachment.body.clone()
        };
        match attachment.mime_type.as_str() {
            "application/json" => format!("```json\n{decoded}\n```"),
            "text/markdown" | "text/plain" | "message/rfc822" | "text/x-diff" | "text/html" => {
                decoded
            }
            "image/png" | "image/jpeg" => {
                "Artifact is an image and cannot be displayed in the CLI".to_string()
            }
            _ => format!(
                "Unknown MIME type '{}'. Artifact cannot be displayed.",
                attachment.mime_type
            ),
        }
    };
    format!("{header}\n{body}")
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
        assert!(t.is_streaming());
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
        assert_eq!(t.take_last_drain(), 0);
        t.apply(
            &AgentEvent::OutputChat {
                message: "stream".into(),
                timestamp: 0.0,
            },
            false,
        );
        assert_eq!(t.entries().len(), MAX_ENTRIES);
        assert_eq!(t.take_last_drain(), 1);
        assert!(t.is_streaming());
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
        assert!(!t.entries()[0].kind.hidden_in_compact());
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
