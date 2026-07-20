//! Typed wrappers around the most common `/rpc/agent.*` methods.
//! Additional services (chat, filesystem, workflow, …) will be added in later
//! phases as the corresponding TUI features land.

#![allow(dead_code)] // RPC DTOs retain parsed fields for API parity before use.

use anyhow::{bail, ensure, Context, Result};
use serde_json::{json, Value};

use super::client::RpcClient;

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
    Ok(CreatedAgent {
        id: result
            .get("id")
            .and_then(Value::as_str)
            .context("createAgent response missing id")?
            .to_string(),
        display_name: result
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        description: result
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
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
            "input": { "from": "CLI-RS user", "message": message }
        }),
    )?;
    let status = result.get("status").and_then(Value::as_str).unwrap_or("");
    ensure!(status == "success", "sendInput failed: {status}",);
    Ok(result
        .get("requestId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string())
}

/// Abort the agent's current operation.
pub fn abort_current_operation(client: &RpcClient, agent_id: &str, message: &str) -> Result<()> {
    let result = client.call(
        "/rpc/agent.abortCurrentOperation",
        json!({ "agentId": agent_id, "message": message }),
    )?;
    let status = result.get("status").and_then(Value::as_str).unwrap_or("");
    if status != "success" {
        bail!("abortCurrentOperation failed: {status}");
    }
    Ok(())
}

/// Delete an agent (shut it down permanently).
pub fn delete_agent(client: &RpcClient, agent_id: &str, reason: &str) -> Result<()> {
    let result = client.call(
        "/rpc/agent.deleteAgent",
        json!({ "agentId": agent_id, "reason": reason }),
    )?;
    let status = result.get("status").and_then(Value::as_str).unwrap_or("");
    if status != "success" {
        bail!("deleteAgent failed: {status}");
    }
    Ok(())
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
#[derive(Clone, Debug, Default)]
pub struct AgentTypeEntry {
    pub r#type: String,
    pub display_name: String,
    pub description: String,
    pub category: Option<String>,
    pub enabled_tools: Vec<String>,
}

pub fn get_agent_types(client: &RpcClient) -> Result<Vec<AgentTypeEntry>> {
    let result = client.call("/rpc/agent.getAgentTypes", json!({}))?;
    let array = result
        .as_array()
        .context("getAgentTypes result is not an array")?;
    Ok(array
        .iter()
        .map(|v| AgentTypeEntry {
            r#type: v
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
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
            category: v.get("category").and_then(Value::as_str).map(String::from),
            enabled_tools: v
                .get("enabledTools")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect())
}

/// A workflow entry (from `/rpc/workflow.listWorkflows`).
#[derive(Clone, Debug, Default)]
pub struct WorkflowEntry {
    pub name: String,
    pub category: String,
    pub display_name: String,
    pub description: String,
    pub agent_type: String,
    pub steps: Vec<String>,
}

pub fn list_workflows(client: &RpcClient) -> Result<Vec<WorkflowEntry>> {
    let result = client.call("/rpc/workflow.listWorkflows", json!({}))?;
    let array = result
        .as_array()
        .context("listWorkflows result is not an array")?;
    Ok(array
        .iter()
        .map(|v| WorkflowEntry {
            name: v
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            category: v
                .get("category")
                .and_then(Value::as_str)
                .filter(|c| !c.is_empty())
                .unwrap_or("Other")
                .to_string(),
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
            agent_type: v
                .get("agentType")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            steps: v
                .get("steps")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default(),
        })
        .collect())
}

/// Spawn a workflow and return the resulting agent (from
/// `/rpc/workflow.spawnWorkflow`).
pub fn spawn_workflow(client: &RpcClient, name: &str) -> Result<CreatedAgent> {
    let result = client.call(
        "/rpc/workflow.spawnWorkflow",
        json!({ "name": name, "headless": false }),
    )?;
    Ok(CreatedAgent {
        id: result
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        display_name: result
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        description: result
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    })
}

// ---------------------------------------------------------------------------
// Chat RPC (`/rpc/chat.*`)
// ---------------------------------------------------------------------------

/// The model's spec (costs, context length, capabilities) from `getModel`.
#[derive(Clone, Debug, Default)]
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

/// The agent's current model info, or `agentNotFound`.
pub fn get_model(client: &RpcClient, agent_id: &str) -> Result<ModelInfo> {
    let result = client.call("/rpc/chat.getModel", json!({ "agentId": agent_id }))?;
    if result.get("status").and_then(Value::as_str) == Some("agentNotFound") {
        bail!("agent not found: {agent_id}");
    }
    let model = result
        .get("model")
        .and_then(Value::as_str)
        .map(String::from);
    let spec = result.get("modelSpec").and_then(|s| {
        Some(ModelSpec {
            max_context_length: s.get("maxContextLength")?.as_u64()?,
            cost_per_million_input_tokens: s.get("costPerMillionInputTokens")?.as_f64()?,
            cost_per_million_output_tokens: s.get("costPerMillionOutputTokens")?.as_f64()?,
        })
    });
    Ok(ModelInfo { model, spec })
}

/// The agent's currently enabled tool names.
pub fn get_enabled_tools(client: &RpcClient, agent_id: &str) -> Result<Vec<String>> {
    let result = client.call("/rpc/chat.getEnabledTools", json!({ "agentId": agent_id }))?;
    Ok(result
        .get("tools")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default())
}

/// The raw chat-messages array (shapes are opaque/`z.any()` server-side).
pub fn get_chat_messages(client: &RpcClient, agent_id: &str) -> Result<Vec<Value>> {
    let result = client.call("/rpc/chat.getChatMessages", json!({ "agentId": agent_id }))?;
    Ok(result
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

// ---------------------------------------------------------------------------
// Filesystem RPC (`/rpc/filesystem.*`)
// ---------------------------------------------------------------------------

/// The agent's filesystem state (provider + working directory).
#[derive(Clone, Debug, Default)]
pub struct FilesystemState {
    pub provider: String,
    pub working_directory: String,
}

pub fn get_filesystem_state(client: &RpcClient, agent_id: &str) -> Result<FilesystemState> {
    let result = client.call(
        "/rpc/filesystem.getFilesystemState",
        json!({ "agentId": agent_id }),
    )?;
    if result.get("status").and_then(Value::as_str) == Some("agentNotFound") {
        return Ok(FilesystemState::default());
    }
    Ok(FilesystemState {
        provider: result
            .get("provider")
            .and_then(Value::as_str)
            .unwrap_or("posix")
            .to_string(),
        working_directory: result
            .get("workingDirectory")
            .and_then(Value::as_str)
            .unwrap_or(".")
            .to_string(),
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
    Ok(result
        .get("history")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default())
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
    let array = result
        .get("commands")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    Ok(parse_command_defs(&array))
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
    let files: Vec<String> = result
        .get("files")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let total = result
        .get("totalMatches")
        .and_then(Value::as_u64)
        .unwrap_or(files.len() as u64) as usize;
    Ok((files, total))
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
                "timestamp": 0,
                "requestId": request_id,
                "interactionId": interaction_id,
                "result": result,
            }
        }),
    )?;
    let status = result_value
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("");
    if status != "success" {
        bail!("sendInteractionResponse failed: {status}");
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
        assert_eq!(parse_epoch_ms(Some(&json!(1_700_000_000_000u64))), 1_700_000_000_000);
        assert_eq!(parse_epoch_ms(Some(&json!(1_700_000_000_000.0))), 1_700_000_000_000);
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
}
