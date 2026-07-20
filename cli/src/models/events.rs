//! Typed models for TokenRing agent events, ported from `pkg/agent/AgentEvents.ts`
//! and the `/rpc/agent.streamAgentEvents` result envelope.

#![allow(dead_code)] // Defensive parsing retains fields for API parity before use.

use serde_json::Value;

/// A single attachment/file (input or artifact). See `BaseAttachmentSchema`.
#[derive(Clone, Debug, Default)]
pub struct Attachment {
    pub name: String,
    pub description: Option<String>,
    pub encoding: String, // "text" | "base64" | "href"
    pub mime_type: String,
    pub body: String,
}

/// A parsed tool-call result event. See `ToolCallResultSchema`.
#[derive(Clone, Debug, Default)]
pub struct ToolCallResult {
    pub name: String,
    pub summary: String,
    pub result: String,
    pub actions: Vec<String>,
    pub timestamp: f64,
}

/// The input message of an `input.received` event.
#[derive(Clone, Debug, Default)]
pub struct InputMessage {
    pub from: String,
    pub message: String,
    pub request_id: String,
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
    AgentResponse {
        status: String,
        message: String,
        request_id: String,
        timestamp: f64,
    },
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
    OutputArtifact {
        attachment: Attachment,
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
    /// `input.interaction` and `input.interaction.response` (raw payloads —
    /// handled in detail by the question-session subsystem).
    Interaction {
        raw: Value,
        timestamp: f64,
    },
    Cancel {
        request_id: String,
        timestamp: f64,
    },
    Unknown {
        type_name: String,
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
            "agent.response" => AgentEvent::AgentResponse {
                status: value
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("done")
                    .to_string(),
                message: msg(),
                request_id: value
                    .get("requestId")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                timestamp: ts(),
            },
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
            "output.artifact" => AgentEvent::OutputArtifact {
                attachment: parse_attachment(value),
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
                    summary: value
                        .get("summary")
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
                    timestamp: ts(),
                },
                timestamp: ts(),
            },
            "input.interaction" | "input.interaction.response" => AgentEvent::Interaction {
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
            _ => AgentEvent::Unknown { type_name },
        }
    }
}

fn parse_attachment(value: &Value) -> Attachment {
    Attachment {
        name: value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Artifact")
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
    }
}
