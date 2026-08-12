//! Typed wrappers around the most common `/rpc/agent.*` methods.
//! Additional services (chat, filesystem, workflow, …) will be added in later
//! phases as the corresponding TUI features land.

use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{bail, ensure, Context, Result};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

use super::client::RpcClient;

fn decode_response<T: DeserializeOwned>(value: Value, method: &str) -> Result<T> {
    serde_json::from_value(value).with_context(|| format!("decode {method} response"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatedAgentResponse {
    id: String,
    #[serde(default)]
    display_name: String,
    #[serde(default)]
    description: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
    #[serde(default)]
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendInputResponse {
    #[serde(default)]
    status: String,
    #[serde(default)]
    request_id: String,
}

#[derive(Deserialize)]
struct ToolsResponse {
    #[serde(default)]
    tools: Vec<String>,
}

#[derive(Deserialize)]
struct MessagesResponse {
    #[serde(default)]
    messages: Vec<Value>,
}

#[derive(Deserialize)]
struct HistoryResponse {
    #[serde(default)]
    history: Vec<String>,
}

#[derive(Deserialize)]
struct CommandsResponse {
    #[serde(default)]
    commands: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceSearchResponse {
    #[serde(default)]
    files: Vec<String>,
    total_matches: Option<u64>,
}

/// Current wall-clock time as Unix epoch milliseconds.
fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Result of `/rpc/agent.createAgent`.
#[derive(Clone, Debug)]
pub struct CreatedAgent {
    pub id: String,
    pub display_name: String,
    pub description: String,
}

/// Create a new agent of the given type.
pub fn create_agent(client: &RpcClient, agent_type: &str, headless: bool) -> Result<CreatedAgent> {
    let result = client.call(
        "/rpc/agent.createAgent",
        json!({ "agentType": agent_type, "headless": headless }),
    )?;
    let response: CreatedAgentResponse = decode_response(result, "createAgent")?;
    Ok(CreatedAgent {
        id: response.id,
        display_name: response.display_name,
        description: response.description,
    })
}

/// Snapshot of agent events from `/rpc/agent.getAgentEvents`.
#[derive(Clone, Debug)]
pub struct AgentEventsSnapshot {
    pub events: Vec<Value>,
    pub position: usize,
}

/// Fetch agent events from a cursor position (synchronous hydration before
/// subscribing to the live stream).
pub fn get_agent_events(
    client: &RpcClient,
    agent_id: &str,
    from_position: usize,
) -> Result<AgentEventsSnapshot> {
    let result = client.call(
        "/rpc/agent.getAgentEvents",
        json!({
            "agentId": agent_id,
            "fromPosition": from_position,
        }),
    )?;
    if result.get("status").and_then(Value::as_str) == Some("agentNotFound") {
        bail!("agent not found: {agent_id}");
    }
    Ok(AgentEventsSnapshot {
        events: result
            .get("events")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default(),
        position: result.get("position").and_then(Value::as_u64).unwrap_or(0) as usize,
    })
}

/// Send a user message to an agent. Returns the assigned `requestId`.
pub fn send_input(client: &RpcClient, agent_id: &str, message: &str) -> Result<String> {
    let result = client.call(
        "/rpc/agent.sendInput",
        json!({
            "agentId": agent_id,
            "input": { "from": "CLI", "message": message }
        }),
    )?;
    let response: SendInputResponse = decode_response(result, "sendInput")?;
    ensure!(
        response.status == "success",
        "sendInput failed: {}",
        response.status
    );
    Ok(response.request_id)
}

/// Abort the agent's current operation.
pub fn abort_current_operation(client: &RpcClient, agent_id: &str, message: &str) -> Result<()> {
    let result = client.call(
        "/rpc/agent.abortCurrentOperation",
        json!({ "agentId": agent_id, "message": message }),
    )?;
    let response: StatusResponse = decode_response(result, "abortCurrentOperation")?;
    if response.status != "success" {
        bail!("abortCurrentOperation failed: {}", response.status);
    }
    Ok(())
}

/// Delete an agent (shut it down permanently).
pub fn delete_agent(client: &RpcClient, agent_id: &str, reason: &str) -> Result<()> {
    let result = client.call(
        "/rpc/agent.deleteAgent",
        json!({ "agentId": agent_id, "reason": reason }),
    )?;
    let response: StatusResponse = decode_response(result, "deleteAgent")?;
    if response.status != "success" {
        bail!("deleteAgent failed: {}", response.status);
    }
    Ok(())
}

/// A saved agent checkpoint (from `/rpc/checkpoint.listCheckpoints`).
#[derive(Clone, Debug, Default)]
pub struct CheckpointEntry {
    pub id: u64,
    pub session_id: String,
    pub name: String,
    pub agent_id: String,
    pub agent_type: String,
    pub created_at: i64,
}

/// List saved checkpoints without loading their full state payloads.
pub fn list_checkpoints(client: &RpcClient) -> Result<Vec<CheckpointEntry>> {
    let result = client.call("/rpc/checkpoint.listCheckpoints", json!({}))?;
    let array = result
        .as_array()
        .context("listCheckpoints result is not an array")?;
    Ok(array
        .iter()
        .map(|v| CheckpointEntry {
            id: v
                .get("id")
                .and_then(|id| id.as_u64().or_else(|| id.as_f64().map(|n| n as u64)))
                .unwrap_or(0),
            session_id: v
                .get("sessionId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            name: v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            agent_id: v
                .get("agentId")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            agent_type: v
                .get("agentType")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            created_at: parse_epoch_ms(v.get("createdAt")),
        })
        .collect())
}

/// Launch a new interactive agent from a saved checkpoint.
pub fn launch_agent_from_checkpoint(
    client: &RpcClient,
    checkpoint_id: u64,
) -> Result<CreatedAgent> {
    let result = client.call(
        "/rpc/checkpoint.launchAgentFromCheckpoint",
        json!({ "checkpointId": checkpoint_id, "headless": false }),
    )?;
    let status = result.get("status").and_then(Value::as_str).unwrap_or("");
    if status == "checkpointNotFound" {
        bail!("checkpoint not found: {checkpoint_id}");
    }
    ensure!(
        status == "success",
        "launchAgentFromCheckpoint failed: {status}"
    );
    Ok(CreatedAgent {
        id: result
            .get("agentId")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty())
            .context("launchAgentFromCheckpoint response missing agentId")?
            .to_string(),
        display_name: result
            .get("agentName")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        description: String::new(),
    })
}

/// A running agent (from `/rpc/agent.listAgents`).
#[derive(Clone, Debug, Default)]
pub struct RunningAgent {
    pub id: String,
    pub created_at: i64,
    pub display_name: String,
    pub description: String,
    pub idle: bool,
    pub current_activity: String,
}

fn parse_epoch_ms(value: Option<&Value>) -> i64 {
    value
        .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|n| n as i64)))
        .unwrap_or(0)
}

pub fn list_agents(client: &RpcClient) -> Result<Vec<RunningAgent>> {
    let result = client.call("/rpc/agent.listAgents", json!({}))?;
    let array = result
        .as_array()
        .context("listAgents result is not an array")?;
    Ok(array
        .iter()
        .map(|v| RunningAgent {
            id: v
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            created_at: parse_epoch_ms(v.get("createdAt")),
            display_name: v
                .get("displayName")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            description: v
                .get("description")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            idle: v.get("idle").and_then(Value::as_bool).unwrap_or(false),
            current_activity: v
                .get("currentActivity")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
        })
        .collect())
}

/// A spawnable agent type (from `/rpc/agent.getAgentTypes`).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AgentTypeEntry {
    pub r#type: String,
    pub display_name: String,
    pub description: String,
    pub category: Option<String>,
    pub enabled_tools: Vec<String>,
}

pub fn get_agent_types(client: &RpcClient) -> Result<Vec<AgentTypeEntry>> {
    let result = client.call("/rpc/agent.getAgentTypes", json!({}))?;
    decode_response(result, "getAgentTypes")
}

/// A single workflow step from `/rpc/workflow.listWorkflows`.
///
/// Matches the backend `WorkflowStepSchema`: a plain string is a chat message,
/// and an object is a structured agent command (`/command …`).
#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum WorkflowStep {
    Message(String),
    Command {
        command: String,
        #[serde(default)]
        arguments: serde_json::Map<String, Value>,
        #[serde(default)]
        remainder: String,
    },
}

impl WorkflowStep {
    /// Short label for UI lists and previews (mirrors `formatWorkflowStepLabel`).
    pub fn label(&self) -> String {
        match self {
            WorkflowStep::Message(text) => text.clone(),
            WorkflowStep::Command {
                command,
                arguments,
                remainder,
            } => {
                let mut parts = vec![format!("/{command}")];
                for (name, value) in arguments {
                    match value {
                        Value::Bool(true) => parts.push(format!("--{name}")),
                        Value::Bool(false) | Value::Null => {}
                        Value::String(s) if s.is_empty() => {}
                        other => parts.push(format!("--{name} {other}")),
                    }
                }
                let remainder = remainder.trim();
                if !remainder.is_empty() {
                    parts.push(remainder.to_string());
                }
                parts.join(" ")
            }
        }
    }
}

/// A workflow entry (from `/rpc/workflow.listWorkflows`).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WorkflowEntry {
    pub name: String,
    pub category: String,
    pub display_name: String,
    pub description: String,
    pub agent_type: String,
    pub steps: Vec<WorkflowStep>,
}

pub fn list_workflows(client: &RpcClient) -> Result<Vec<WorkflowEntry>> {
    let result = client.call("/rpc/workflow.listWorkflows", json!({}))?;
    let mut workflows: Vec<WorkflowEntry> = decode_response(result, "listWorkflows")?;
    for workflow in &mut workflows {
        if workflow.category.is_empty() {
            workflow.category = "Other".to_string();
        }
    }
    Ok(workflows)
}

/// Spawn a workflow and return the resulting agent (from
/// `/rpc/workflow.spawnWorkflow`).
pub fn spawn_workflow(client: &RpcClient, name: &str) -> Result<CreatedAgent> {
    let result = client.call(
        "/rpc/workflow.spawnWorkflow",
        json!({ "name": name, "headless": false }),
    )?;
    let response: CreatedAgentResponse = decode_response(result, "spawnWorkflow")?;
    ensure!(!response.id.is_empty(), "spawnWorkflow response missing id");
    Ok(CreatedAgent {
        id: response.id,
        display_name: response.display_name,
        description: response.description,
    })
}

// ---------------------------------------------------------------------------
// Chat RPC (`/rpc/chat.*`)
// ---------------------------------------------------------------------------

/// The model's spec (costs, context length, capabilities) from `getModel`.
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub max_context_length: u64,
    pub cost_per_million_input_tokens: f64,
    pub cost_per_million_output_tokens: f64,
}

/// The agent's current model info, including spec.
#[derive(Clone, Debug, Default)]
pub struct ModelInfo {
    pub model: Option<String>,
    pub spec: Option<ModelSpec>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelResponse {
    #[serde(default)]
    status: String,
    model: Option<String>,
    model_spec: Option<Value>,
}

/// The agent's current model info, or `agentNotFound`.
pub fn get_model(client: &RpcClient, agent_id: &str) -> Result<ModelInfo> {
    let result = client.call("/rpc/chat.getModel", json!({ "agentId": agent_id }))?;
    let response: ModelResponse = decode_response(result, "getModel")?;
    if response.status == "agentNotFound" {
        bail!("agent not found: {agent_id}");
    }
    let spec = response
        .model_spec
        .and_then(|value| serde_json::from_value(value).ok());
    Ok(ModelInfo {
        model: response.model,
        spec,
    })
}

/// The agent's currently enabled tool names.
pub fn get_enabled_tools(client: &RpcClient, agent_id: &str) -> Result<Vec<String>> {
    let result = client.call("/rpc/chat.getEnabledTools", json!({ "agentId": agent_id }))?;
    let response: ToolsResponse = decode_response(result, "getEnabledTools")?;
    Ok(response.tools)
}

/// The raw chat-messages array (shapes are opaque/`z.any()` server-side).
pub fn get_chat_messages(client: &RpcClient, agent_id: &str) -> Result<Vec<Value>> {
    let result = client.call("/rpc/chat.getChatMessages", json!({ "agentId": agent_id }))?;
    let response: MessagesResponse = decode_response(result, "getChatMessages")?;
    Ok(response.messages)
}

// ---------------------------------------------------------------------------
// Filesystem RPC (`/rpc/filesystem.*`)
// ---------------------------------------------------------------------------

/// The agent's filesystem state (provider + working directory).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesystemState {
    pub provider: String,
    pub working_directory: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilesystemResponse {
    #[serde(default)]
    status: String,
    provider: Option<String>,
    working_directory: Option<String>,
}

pub fn get_filesystem_state(client: &RpcClient, agent_id: &str) -> Result<FilesystemState> {
    let result = client.call(
        "/rpc/filesystem.getFilesystemState",
        json!({ "agentId": agent_id }),
    )?;
    let response: FilesystemResponse = decode_response(result, "getFilesystemState")?;
    if response.status == "agentNotFound" {
        return Ok(FilesystemState::default());
    }
    Ok(FilesystemState {
        provider: response.provider.unwrap_or_else(|| "posix".to_string()),
        working_directory: response
            .working_directory
            .unwrap_or_else(|| ".".to_string()),
    })
}

// ---------------------------------------------------------------------------
// Agent history (`/rpc/agent.getCommandHistory`)
// ---------------------------------------------------------------------------

/// The agent's command history (most-recent-last).
pub fn get_command_history(client: &RpcClient, agent_id: &str) -> Result<Vec<String>> {
    let result = client.call(
        "/rpc/agent.getCommandHistory",
        json!({ "agentId": agent_id }),
    )?;
    let response: HistoryResponse = decode_response(result, "getCommandHistory")?;
    Ok(response.history)
}

/// A slash-command definition (name + description) from `getAvailableCommands`.
#[derive(Clone, Debug, Default)]
pub struct CommandDef {
    pub name: String,
    pub description: String,
}

/// The slash-commands available to the agent (`getAvailableCommands`).
pub fn get_available_commands(client: &RpcClient, agent_id: &str) -> Result<Vec<CommandDef>> {
    let result = client.call(
        "/rpc/agent.getAvailableCommands",
        json!({ "agentId": agent_id }),
    )?;
    let response: CommandsResponse = decode_response(result, "getAvailableCommands")?;
    Ok(parse_command_defs(&response.commands))
}

fn parse_command_defs(array: &[Value]) -> Vec<CommandDef> {
    let mut defs: Vec<CommandDef> = array
        .iter()
        .filter_map(|v| {
            // Support both old (string) and new ({name, description}) formats.
            if let Some(s) = v.as_str() {
                Some(CommandDef {
                    name: s.to_string(),
                    description: String::new(),
                })
            } else {
                Some(CommandDef {
                    name: v.get("name")?.as_str()?.to_string(),
                    description: v
                        .get("description")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                })
            }
        })
        .collect();
    // Deduplicate by name (server may return aliases under canonical names).
    let mut seen = std::collections::HashSet::new();
    defs.retain(|def| seen.insert(def.name.clone()));
    defs
}

/// Search workspace files on the backend (nice-to-have #18).
pub fn search_workspace_files(
    client: &RpcClient,
    provider: &str,
    query: &str,
    limit: usize,
) -> Result<(Vec<String>, usize)> {
    let result = client.call(
        "/rpc/filesystem.searchWorkspaceFiles",
        json!({
            "provider": provider,
            "query": query,
            "limit": limit,
        }),
    )?;
    let response: WorkspaceSearchResponse = decode_response(result, "searchWorkspaceFiles")?;
    let total = response
        .total_matches
        .unwrap_or(response.files.len() as u64) as usize;
    Ok((response.files, total))
}

/// A directory entry from `/rpc/filesystem.listDirectory`.
#[derive(Clone, Debug)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
}

/// List a directory (non-recursive) for the file-select question browser.
pub fn list_directory(
    client: &RpcClient,
    provider: &str,
    path: &str,
    show_hidden: bool,
) -> Result<Vec<DirEntry>> {
    let result = client.call(
        "/rpc/filesystem.listDirectory",
        json!({ "provider": provider, "path": path, "showHidden": show_hidden, "recursive": false }),
    )?;
    Ok(parse_directory_entries(&result))
}

fn parse_directory_entries(result: &Value) -> Vec<DirEntry> {
    if let Some(files) = result.get("files").and_then(Value::as_array) {
        return files
            .iter()
            .filter_map(Value::as_str)
            .map(dir_entry_from_path)
            .collect();
    }
    let entries = result
        .get("entries")
        .and_then(Value::as_array)
        .or_else(|| result.as_array());
    entries
        .map(|a| {
            a.iter()
                .filter_map(|v| {
                    if let Some(path) = v.as_str() {
                        return Some(dir_entry_from_path(path));
                    }
                    let name = v.get("name").and_then(Value::as_str)?.to_string();
                    let is_directory = v
                        .get("isDirectory")
                        .and_then(Value::as_bool)
                        .unwrap_or_else(|| {
                            v.get("type").and_then(Value::as_str) == Some("directory")
                        });
                    Some(DirEntry { name, is_directory })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn dir_entry_from_path(path: &str) -> DirEntry {
    let is_directory = path.ends_with('/');
    let trimmed = path.trim_end_matches('/');
    let name = trimmed
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .unwrap_or(trimmed)
        .to_string();
    DirEntry { name, is_directory }
}

/// Respond to an agent interaction (question/followup). `result` is the
/// free-form answer payload.
pub fn send_interaction_response(
    client: &RpcClient,
    agent_id: &str,
    request_id: &str,
    interaction_id: &str,
    result: Value,
) -> Result<()> {
    let result_value = client.call(
        "/rpc/agent.sendInteractionResponse",
        json!({
            "agentId": agent_id,
            "response": {
                "type": "input.interaction",
                "timestamp": now_epoch_ms(),
                "requestId": request_id,
                "interactionId": interaction_id,
                "result": result,
            }
        }),
    )?;
    let response: StatusResponse = decode_response(result_value, "sendInteractionResponse")?;
    if response.status != "success" {
        bail!("sendInteractionResponse failed: {}", response.status);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_backend_files_directory_shape() {
        let entries = parse_directory_entries(&json!({
            "files": ["/repo/src/", "/repo/README.md"]
        }));

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "src");
        assert!(entries[0].is_directory);
        assert_eq!(entries[1].name, "README.md");
        assert!(!entries[1].is_directory);
    }

    #[test]
    fn parses_legacy_object_directory_shape() {
        let entries = parse_directory_entries(&json!({
            "entries": [
                { "name": "src", "isDirectory": true },
                { "name": "README.md", "isDirectory": false }
            ]
        }));

        assert_eq!(entries.len(), 2);
        assert!(entries[0].is_directory);
        assert!(!entries[1].is_directory);
    }

    #[test]
    fn parse_epoch_ms_accepts_integer_and_float() {
        assert_eq!(
            parse_epoch_ms(Some(&json!(1_700_000_000_000u64))),
            1_700_000_000_000
        );
        assert_eq!(
            parse_epoch_ms(Some(&json!(1_700_000_000_000.0))),
            1_700_000_000_000
        );
        assert_eq!(parse_epoch_ms(None), 0);
    }

    #[test]
    fn command_defs_deduplicate_non_adjacent_names() {
        let defs = parse_command_defs(&[
            json!({ "name": "model", "description": "first" }),
            json!({ "name": "help", "description": "help" }),
            json!({ "name": "model", "description": "duplicate" }),
        ]);
        let names: Vec<&str> = defs.iter().map(|def| def.name.as_str()).collect();
        assert_eq!(names, vec!["model", "help"]);
        assert_eq!(defs[0].description, "first");
    }

    #[test]
    fn typed_agent_type_response_uses_defaults() {
        let entries: Vec<AgentTypeEntry> = decode_response(
            json!([{ "type": "coding", "displayName": "Coding" }]),
            "test",
        )
        .unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].r#type, "coding");
        assert_eq!(entries[0].display_name, "Coding");
        assert!(entries[0].description.is_empty());
        assert!(entries[0].enabled_tools.is_empty());
    }

    #[test]
    fn typed_model_spec_uses_camel_case_fields() {
        let spec: ModelSpec = decode_response(
            json!({
                "maxContextLength": 200_000,
                "costPerMillionInputTokens": 2.5,
                "costPerMillionOutputTokens": 10.0
            }),
            "test",
        )
        .unwrap();

        assert_eq!(spec.max_context_length, 200_000);
        assert_eq!(spec.cost_per_million_input_tokens, 2.5);
        assert_eq!(spec.cost_per_million_output_tokens, 10.0);
    }

    #[test]
    fn created_agent_response_requires_an_id() {
        let error = match decode_response::<CreatedAgentResponse>(json!({}), "createAgent") {
            Ok(_) => panic!("missing id should fail to decode"),
            Err(error) => error.to_string(),
        };

        assert!(error.contains("decode createAgent response"));
    }

    #[test]
    fn list_workflows_accepts_string_and_command_steps() {
        let workflows: Vec<WorkflowEntry> = decode_response(
            json!([{
                "name": "bugHunter",
                "displayName": "Bug Hunter",
                "category": "Code Review",
                "description": "find bugs",
                "agentType": "leader",
                "updatedAt": "2026-01-01T00:00:00.000Z",
                "steps": [
                    "look around",
                    {
                        "command": "for",
                        "arguments": {},
                        "remainder": "$pkg in @packages { /eval fix $pkg }"
                    },
                    {
                        "command": "agent run",
                        "arguments": { "type": "code", "neverFail": true },
                        "remainder": "fix it"
                    }
                ],
                "subAgent": { "timeout": 0 }
            }]),
            "listWorkflows",
        )
        .unwrap();

        assert_eq!(workflows.len(), 1);
        assert_eq!(workflows[0].name, "bugHunter");
        assert_eq!(workflows[0].agent_type, "leader");
        assert_eq!(workflows[0].steps.len(), 3);
        assert_eq!(workflows[0].steps[0].label(), "look around");
        assert_eq!(
            workflows[0].steps[1].label(),
            "/for $pkg in @packages { /eval fix $pkg }"
        );
        assert!(workflows[0].steps[2].label().starts_with("/agent run"));
        assert!(workflows[0].steps[2].label().contains("fix it"));
    }

    #[test]
    fn now_epoch_ms_is_recent() {
        let now = now_epoch_ms();
        // After 2020-01-01 and not absurdly far in the future.
        assert!(now > 1_577_836_800_000);
        assert!(now < 4_102_444_800_000);
    }
}
