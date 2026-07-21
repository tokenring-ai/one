//! Typed models for TokenRing agent events, ported from `plugin/agent/AgentEvents.ts`
//! and the `/rpc/agent.streamAgentEvents` result envelope.

use serde_json::Value;

/// A single attachment/file. See `ChatAttachmentSchema` /
/// `ToolCallAttachmentSchema` (`BaseAttachmentSchema` + mime).
#[derive(Clone, Debug, Default)]
pub struct Attachment {
    pub name: String,
    pub description: Option<String>,
    pub encoding: String, // "text" | "base64" | "href"
    pub mime_type: String,
    pub body: String,
    /// Tool-call attachments only (`ToolCallAttachmentSchema.sendToLLM`);
    /// always `false` for chat/input/response attachments.
    pub send_to_llm: bool,
}

/// A parsed tool-call result event. See `ToolCallResultSchema`.
#[derive(Clone, Debug, Default)]
pub struct ToolCallResult {
    pub name: String,
    pub args: serde_json::Map<String, Value>,
    pub message: String,
    pub result: String,
    pub actions: Vec<String>,
    pub failed: bool,
    pub attachments: Vec<Attachment>,
    pub timestamp: f64,
}

/// The input message of an `input.received` event.
#[derive(Clone, Debug, Default)]
pub struct InputMessage {
    pub from: String,
    pub message: String,
    pub request_id: String,
    pub attachments: Vec<Attachment>,
}

/// Terminal `agent.response`, discriminated on `status`
/// (mirrors `AgentResponseSchema` in `AgentEvents.ts`).
#[derive(Clone, Debug)]
pub enum AgentResponse {
    /// `status: "cancelled"` — `AgentCancelledResponseSchema`.
    Cancelled {
        message: String,
        request_id: String,
        timestamp: f64,
    },
    /// `status: "error"` — `AgentErrorResponseSchema`.
    Error {
        message: String,
        request_id: String,
        timestamp: f64,
    },
    /// `status: "success"` — `AgentSuccessResponseSchema`.
    Success {
        message: String,
        request_id: String,
        attachments: Vec<Attachment>,
        timestamp: f64,
    },
}

/// The strongly-typed view of an agent event, used by the TUI.
///
/// Constructed defensively from a raw JSON value so that unknown/future event
/// types or missing fields never break rendering.
#[derive(Clone, Debug)]
pub enum AgentEvent {
    AgentCreated {
        message: String,
        timestamp: f64,
    },
    AgentStopped {
        message: String,
        timestamp: f64,
    },
    AgentStatus {
        status: String,
        current_activity: String,
        input_execution_queue: Vec<String>,
        timestamp: f64,
    },
    /// Nested status union — see [`AgentResponse`].
    AgentResponse(AgentResponse),
    OutputChat {
        message: String,
        timestamp: f64,
    },
    OutputReasoning {
        message: String,
        timestamp: f64,
    },
    OutputInfo {
        message: String,
        timestamp: f64,
    },
    OutputWarning {
        message: String,
        timestamp: f64,
    },
    OutputError {
        message: String,
        timestamp: f64,
    },
    InputReceived {
        input: InputMessage,
        timestamp: f64,
    },
    InputExecution {
        status: String,
        request_id: String,
        current_activity: Option<String>,
        timestamp: f64,
    },
    ToolCall {
        tool: ToolCallResult,
        timestamp: f64,
    },
    /// User answer to an interaction (`InteractionResponseSchema` /
    /// `type: "input.interaction"`). Payload kept raw for the question-session
    /// subsystem.
    Interaction {
        raw: Value,
        timestamp: f64,
    },
    Cancel {
        request_id: String,
        timestamp: f64,
    },
    /// Unrecognized event type — surface for diagnostics instead of silent drop.
    Unknown {
        type_name: String,
        /// Compact JSON preview for verbose transcript / flash detail.
        preview: String,
    },
}

impl AgentEvent {
    /// Parse a raw event JSON value into a typed event.
    pub fn from_value(value: &Value) -> Self {
        let type_name = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();

        let msg = || {
            value
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string()
        };
        let ts = || {
            value
                .get("timestamp")
                .and_then(Value::as_f64)
                .unwrap_or(0.0)
        };

        match type_name.as_str() {
            "agent.created" => AgentEvent::AgentCreated {
                message: msg(),
                timestamp: ts(),
            },
            "agent.stopped" => AgentEvent::AgentStopped {
                message: msg(),
                timestamp: ts(),
            },
            "agent.status" => AgentEvent::AgentStatus {
                status: value
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                current_activity: value
                    .get("currentActivity")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                input_execution_queue: value
                    .get("inputExecutionQueue")
                    .and_then(Value::as_array)
                    .map(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .map(String::from)
                            .collect()
                    })
                    .unwrap_or_default(),
                timestamp: ts(),
            },
            "agent.response" => parse_agent_response(value, msg(), ts()),
            "output.chat" => AgentEvent::OutputChat {
                message: msg(),
                timestamp: ts(),
            },
            "output.reasoning" => AgentEvent::OutputReasoning {
                message: msg(),
                timestamp: ts(),
            },
            "output.info" => AgentEvent::OutputInfo {
                message: msg(),
                timestamp: ts(),
            },
            "output.warning" => AgentEvent::OutputWarning {
                message: msg(),
                timestamp: ts(),
            },
            "output.error" => AgentEvent::OutputError {
                message: msg(),
                timestamp: ts(),
            },
            "input.received" => AgentEvent::InputReceived {
                input: InputMessage {
                    from: value
                        .pointer("/input/from")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    message: value
                        .pointer("/input/message")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    request_id: value
                        .get("requestId")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    // Nested under `input` (`InputMessageSchema.attachments`).
                    attachments: value
                        .get("input")
                        .map(parse_attachments)
                        .unwrap_or_default(),
                },
                timestamp: ts(),
            },
            "input.execution" => AgentEvent::InputExecution {
                status: value
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                request_id: value
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                current_activity: value
                    .get("currentActivity")
                    .and_then(Value::as_str)
                    .map(String::from),
                timestamp: ts(),
            },
            "toolCall" => AgentEvent::ToolCall {
                tool: ToolCallResult {
                    name: value
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    args: value
                        .get("args")
                        .and_then(Value::as_object)
                        .cloned()
                        .unwrap_or_default(),
                    message: value
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Tool call")
                        .to_string(),
                    result: value
                        .get("result")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    actions: value
                        .get("actions")
                        .and_then(Value::as_array)
                        .map(|a| {
                            a.iter()
                                .filter_map(Value::as_str)
                                .map(String::from)
                                .collect()
                        })
                        .unwrap_or_default(),
                    failed: value
                        .get("failed")
                        .and_then(Value::as_bool)
                        .unwrap_or(false),
                    // `ToolCallAttachmentSchema` (includes optional `sendToLLM`).
                    attachments: parse_attachments(value),
                    timestamp: ts(),
                },
                timestamp: ts(),
            },
            "input.interaction" => AgentEvent::Interaction {
                raw: value.clone(),
                timestamp: ts(),
            },
            "cancel" => AgentEvent::Cancel {
                request_id: value
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                timestamp: ts(),
            },
            _ => AgentEvent::Unknown {
                type_name,
                preview: compact_event_preview(value),
            },
        }
    }
}

/// Parse `agent.response`, discriminating on `status` like `AgentResponseSchema`.
fn parse_agent_response(value: &Value, message: String, timestamp: f64) -> AgentEvent {
    let request_id = value
        .get("requestId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    match value.get("status").and_then(Value::as_str).unwrap_or("") {
        "cancelled" => AgentEvent::AgentResponse(AgentResponse::Cancelled {
            message,
            request_id,
            timestamp,
        }),
        "error" => AgentEvent::AgentResponse(AgentResponse::Error {
            message,
            request_id,
            timestamp,
        }),
        "success" => AgentEvent::AgentResponse(AgentResponse::Success {
            message,
            request_id,
            attachments: parse_attachments(value),
            timestamp,
        }),
        other => {
            let type_name = if other.is_empty() {
                "agent.response".to_string()
            } else {
                format!("agent.response/{other}")
            };
            AgentEvent::Unknown {
                type_name,
                preview: compact_event_preview(value),
            }
        }
    }
}

/// Short, single-line JSON preview for unknown-event diagnostics.
fn compact_event_preview(value: &Value) -> String {
    let raw = value.to_string();
    const MAX: usize = 200;
    if raw.chars().count() <= MAX {
        return raw;
    }
    let truncated: String = raw.chars().take(MAX).collect();
    format!("{truncated}…")
}

/// Parse an `attachments` array from a JSON object (`ChatAttachmentSchema` or
/// `ToolCallAttachmentSchema` items).
fn parse_attachments(value: &Value) -> Vec<Attachment> {
    value
        .get("attachments")
        .and_then(Value::as_array)
        .map(|arr| arr.iter().map(parse_attachment).collect())
        .unwrap_or_default()
}

/// Parse one attachment object. `sendToLLM` is only meaningful for tool-call
/// attachments; defaults to `false` when absent.
fn parse_attachment(value: &Value) -> Attachment {
    Attachment {
        name: value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Attachment")
            .to_string(),
        description: value
            .get("description")
            .and_then(Value::as_str)
            .map(String::from),
        encoding: value
            .get("encoding")
            .and_then(Value::as_str)
            .unwrap_or("text")
            .to_string(),
        mime_type: value
            .get("mimeType")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        body: value
            .get("body")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        send_to_llm: value
            .get("sendToLLM")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn unknown_event_type_preserves_name_and_preview() {
        let value = json!({ "type": "future.thing", "payload": 1 });
        match AgentEvent::from_value(&value) {
            AgentEvent::Unknown { type_name, preview } => {
                assert_eq!(type_name, "future.thing");
                assert!(preview.contains("future.thing"));
            }
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn known_event_still_parses() {
        let value = json!({ "type": "output.chat", "message": "hi", "timestamp": 1.0 });
        match AgentEvent::from_value(&value) {
            AgentEvent::OutputChat { message, .. } => assert_eq!(message, "hi"),
            other => panic!("expected OutputChat, got {other:?}"),
        }
    }

    #[test]
    fn agent_success_response_parses_attachments() {
        let value = json!({
            "type": "agent.response",
            "status": "success",
            "message": "done",
            "requestId": "req-1",
            "timestamp": 1.0,
            "attachments": [{
                "name": "patch.diff",
                "encoding": "text",
                "mimeType": "text/x-diff",
                "body": "--- a\n+++ b\n"
            }]
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::AgentResponse(AgentResponse::Success {
                request_id,
                attachments,
                message,
                ..
            }) => {
                assert_eq!(request_id, "req-1");
                assert_eq!(message, "done");
                assert_eq!(attachments.len(), 1);
                assert_eq!(attachments[0].name, "patch.diff");
                assert_eq!(attachments[0].mime_type, "text/x-diff");
                assert_eq!(attachments[0].encoding, "text");
                assert!(attachments[0].body.contains("+++ b"));
            }
            other => panic!("expected AgentResponse::Success, got {other:?}"),
        }
    }

    #[test]
    fn agent_error_and_cancelled_responses_are_distinct() {
        let error = json!({
            "type": "agent.response",
            "status": "error",
            "message": "failed",
            "requestId": "req-2",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&error) {
            AgentEvent::AgentResponse(AgentResponse::Error {
                message,
                request_id,
                ..
            }) => {
                assert_eq!(message, "failed");
                assert_eq!(request_id, "req-2");
            }
            other => panic!("expected AgentResponse::Error, got {other:?}"),
        }

        let cancelled = json!({
            "type": "agent.response",
            "status": "cancelled",
            "message": "stopped",
            "requestId": "req-3",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&cancelled) {
            AgentEvent::AgentResponse(AgentResponse::Cancelled {
                message,
                request_id,
                ..
            }) => {
                assert_eq!(message, "stopped");
                assert_eq!(request_id, "req-3");
            }
            other => panic!("expected AgentResponse::Cancelled, got {other:?}"),
        }
    }

    #[test]
    fn agent_response_unknown_status_is_unknown_event() {
        let value = json!({
            "type": "agent.response",
            "status": "pending",
            "message": "?",
            "requestId": "req-x",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::Unknown { type_name, .. } => {
                assert_eq!(type_name, "agent.response/pending");
            }
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn removed_output_artifact_is_unknown() {
        let value = json!({
            "type": "output.artifact",
            "name": "old",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::Unknown { type_name, .. } => assert_eq!(type_name, "output.artifact"),
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn removed_input_interaction_response_is_unknown() {
        let value = json!({
            "type": "input.interaction.response",
            "interactionId": "q1",
            "result": "yes",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::Unknown { type_name, .. } => {
                assert_eq!(type_name, "input.interaction.response");
            }
            other => panic!("expected Unknown, got {other:?}"),
        }
    }

    #[test]
    fn input_interaction_still_parses() {
        let value = json!({
            "type": "input.interaction",
            "requestId": "req-1",
            "interactionId": "q1",
            "result": "yes",
            "timestamp": 1.0
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::Interaction { raw, .. } => {
                assert_eq!(raw.get("interactionId").and_then(Value::as_str), Some("q1"));
            }
            other => panic!("expected Interaction, got {other:?}"),
        }
    }

    #[test]
    fn input_received_parses_nested_attachments() {
        let value = json!({
            "type": "input.received",
            "requestId": "req-in",
            "timestamp": 1.0,
            "input": {
                "from": "CLI",
                "message": "see file",
                "attachments": [{
                    "name": "notes.md",
                    "encoding": "text",
                    "mimeType": "text/markdown",
                    "body": "# hello",
                    "description": "user notes"
                }]
            }
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::InputReceived { input, .. } => {
                assert_eq!(input.from, "CLI");
                assert_eq!(input.message, "see file");
                assert_eq!(input.request_id, "req-in");
                assert_eq!(input.attachments.len(), 1);
                assert_eq!(input.attachments[0].name, "notes.md");
                assert_eq!(input.attachments[0].mime_type, "text/markdown");
                assert_eq!(input.attachments[0].body, "# hello");
                assert_eq!(
                    input.attachments[0].description.as_deref(),
                    Some("user notes")
                );
                assert!(!input.attachments[0].send_to_llm);
            }
            other => panic!("expected InputReceived, got {other:?}"),
        }
    }

    #[test]
    fn input_received_without_attachments_is_empty() {
        let value = json!({
            "type": "input.received",
            "requestId": "req-in",
            "timestamp": 1.0,
            "input": { "from": "CLI", "message": "hi" }
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::InputReceived { input, .. } => {
                assert!(input.attachments.is_empty());
            }
            other => panic!("expected InputReceived, got {other:?}"),
        }
    }

    #[test]
    fn tool_call_parses_attachments_with_send_to_llm() {
        let value = json!({
            "type": "toolCall",
            "timestamp": 1.0,
            "name": "git.diff",
            "args": { "base": "HEAD" },
            "message": "**Git** Compared working tree",
            "result": "ok",
            "actions": ["Compared HEAD"],
            "failed": true,
            "attachments": [{
                "name": "change.diff",
                "encoding": "text",
                "mimeType": "text/x-diff",
                "body": "--- a\n+++ b\n",
                "sendToLLM": true
            }]
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::ToolCall { tool, .. } => {
                assert_eq!(tool.name, "git.diff");
                assert_eq!(tool.args.get("base"), Some(&json!("HEAD")));
                assert_eq!(tool.message, "**Git** Compared working tree");
                assert_eq!(tool.actions, vec!["Compared HEAD"]);
                assert!(tool.failed);
                assert_eq!(tool.attachments.len(), 1);
                assert_eq!(tool.attachments[0].name, "change.diff");
                assert_eq!(tool.attachments[0].mime_type, "text/x-diff");
                assert!(tool.attachments[0].send_to_llm);
                assert!(tool.attachments[0].body.contains("+++ b"));
            }
            other => panic!("expected ToolCall, got {other:?}"),
        }
    }

    #[test]
    fn tool_call_send_to_llm_defaults_false() {
        let value = json!({
            "type": "toolCall",
            "timestamp": 1.0,
            "name": "bash",
            "args": {},
            "message": "**Shell** Listed files",
            "result": "",
            "attachments": [{
                "name": "out.txt",
                "encoding": "text",
                "mimeType": "text/plain",
                "body": "x"
            }]
        });
        match AgentEvent::from_value(&value) {
            AgentEvent::ToolCall { tool, .. } => {
                assert!(!tool.failed);
                assert_eq!(tool.attachments.len(), 1);
                assert!(!tool.attachments[0].send_to_llm);
            }
            other => panic!("expected ToolCall, got {other:?}"),
        }
    }
}
