//! Agent-completion notifications (nice-to-have #17).

use std::io::Write;
use std::process::{Command, Stdio};
use std::thread;

use crate::config::NotificationConfig;

/// Fire configured notification hooks when the agent becomes idle.
///
/// Returns a human-readable error if a desktop notification or hook fails.
/// Failures must not write to stderr — the TUI owns the alternate screen.
pub fn notify_agent_idle(config: &NotificationConfig, agent_label: &str) -> Option<String> {
    let mut errors = Vec::new();

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
            errors.push(format!("desktop notification failed: {error}"));
        }
    }
    if let Some(hook) = &config.hook {
        if let Err(error) = run_notification_hook(hook, agent_label) {
            errors.push(format!("notification hook failed: {error}"));
        }
    }

    if errors.is_empty() {
        None
    } else {
        Some(errors.join("; "))
    }
}

/// Run the configured hook through a shell so quoting and `$TR_AGENT_LABEL`
/// expansion work as users expect from the config example.
///
/// The child is reaped on a background thread so short-lived hooks do not
/// become zombies under the TUI process.
fn run_notification_hook(hook: &str, agent_label: &str) -> std::io::Result<()> {
    let hook = hook.trim();
    if hook.is_empty() {
        return Ok(());
    }
    let mut child = {
        #[cfg(unix)]
        {
            Command::new("sh")
                .arg("-c")
                .arg(hook)
                .env("TR_AGENT_LABEL", agent_label)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()?
        }
        #[cfg(windows)]
        {
            Command::new("cmd")
                .args(["/C", hook])
                .env("TR_AGENT_LABEL", agent_label)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()?
        }
        #[cfg(not(any(unix, windows)))]
        {
            let mut parts = hook.split_whitespace();
            let Some(program) = parts.next() else {
                return Ok(());
            };
            Command::new(program)
                .args(parts)
                .env("TR_AGENT_LABEL", agent_label)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()?
        }
    };
    thread::Builder::new()
        .name("tr-notify-hook".into())
        .spawn(move || {
            let _ = child.wait();
        })
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
    Ok(())
}
