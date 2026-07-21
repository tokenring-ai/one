//! tokenring-one-cli — a Ratatui-powered terminal UI for TokenRing One.
//!
//! Connects to a running TokenRing instance over WebSocket JSON-RPC, creates or
//! attaches to an agent, and renders the live agent event stream.

mod args;
mod config;
mod instance;
mod models;
mod rpc;
mod signal;
mod theme;
mod tui;

use anyhow::Result;

use crate::rpc::RpcClient;

fn main() -> Result<()> {
    // Install before any TUI / child process so SIGINT/SIGTERM always unwind
    // through Drop (terminal restore + backend teardown) instead of aborting.
    signal::install()?;

    let mut config = args::Config::parse()?;
    let mut local_instance = None;
    let mut captured_output = None;

    let ws_url = match config.ws_url.clone() {
        Some(ws_url) => ws_url,
        None => {
            let binary = instance::discover(config.one_binary.as_deref())?;
            if !tui::confirm_local_instance(&binary, &config.project_directory, &config.theme)? {
                return Ok(());
            }
            let launched = instance::LocalInstance::launch(&binary, &config.project_directory)?;
            // Local instance uses generated session credentials only — drop any
            // leftover upgrade bearer from config so we do not dual-auth.
            config.session_auth = Some(launched.session_auth.clone());
            config.auth_header = None;
            let ws_url = launched.ws_url.clone();
            captured_output = Some(launched.captured_output_handle());
            local_instance = Some(launched);
            ws_url
        }
    };
    let client = RpcClient::new(
        ws_url,
        config.auth_header.clone(),
        config.session_auth.clone(),
    )?;

    let result = tui::run_with_options(
        client,
        tui::RunOptions {
            agent_id: config.agent_id,
            agent_type: config.agent_type,
            select: config.select,
            theme: config.theme,
            theme_name: config.theme_name,
            verbose: config.verbose,
            prompt: config.prompt,
            prompt_automation: config.prompt_automation,
            shutdown_when_done: config.shutdown_when_done,
            notifications: config.notifications,
            keybinds: config.keybinds,
            captured_output,
        },
    );
    drop(local_instance);
    result
}
