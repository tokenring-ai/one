//! Agent-completion notifications (nice-to-have #17).

use std::io::Write;
use std::process::Command;

use crate::config::NotificationConfig;

/// Fire configured notification hooks when the agent becomes idle.
pub fn notify_agent_idle(config: &NotificationConfig, agent_label: &str) {
    if config.bell {
        let _ = std::io::stdout().write_all(b"\x07");
        let _ = std::io::stdout().flush();
    }
    if config.desktop {
        if let Err(error) = notify_rust::Notification::new()
            .summary("TokenRing")
            .body(&format!("{agent_label} is ready"))
            .show()
        {
            eprintln!("tokenring: desktop notification failed: {error}");
        }
    }
    if let Some(hook) = &config.hook {
        let mut parts = hook.split_whitespace();
        if let Some(program) = parts.next() {
            if let Err(error) = Command::new(program)
                .args(parts)
                .env("TR_AGENT_LABEL", agent_label)
                .spawn()
            {
                eprintln!("tokenring: notification hook failed: {error}");
            }
        }
    }
}
