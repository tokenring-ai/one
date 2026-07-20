//! WebSocket JSON-RPC client and typed method wrappers.

pub mod client;
pub mod methods;

pub use client::{RpcClient, SessionAuth, StreamItem};
pub use methods::{
    abort_current_operation, create_agent, delete_agent, get_agent_events, get_agent_types,
    get_available_commands, get_chat_messages, get_command_history, get_enabled_tools,
    get_filesystem_state, get_model, list_agents, list_directory, list_workflows,
    search_workspace_files, send_input, send_interaction_response, spawn_workflow,
    AgentEventsSnapshot, AgentTypeEntry, RunningAgent, WorkflowEntry,
};
