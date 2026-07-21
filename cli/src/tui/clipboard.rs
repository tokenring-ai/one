//! Best-effort system clipboard helpers for transcript copy (`messages_copy`).

use std::io::Write;
use std::process::{Command, Stdio};

use base64::{engine::general_purpose::STANDARD, Engine as _};

/// Copy `text` to the system clipboard.
///
/// Tries platform clipboard tools first (`pbcopy` / `wl-copy` / `xclip` /
/// `xsel` / `clip`), then falls back to OSC 52 (works over many SSH terminals).
pub fn copy_text(text: &str) -> Result<(), String> {
    if text.is_empty() {
        return Err("nothing to copy".into());
    }
    if copy_via_command(text).is_ok() {
        return Ok(());
    }
    copy_via_osc52(text)
}

fn copy_via_command(text: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return pipe_to(Command::new("pbcopy"), text);
    }
    #[cfg(target_os = "windows")]
    {
        return pipe_to(Command::new("clip"), text);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        for mut cmd in [
            {
                let mut c = Command::new("wl-copy");
                c
            },
            {
                let mut c = Command::new("xclip");
                c.args(["-selection", "clipboard"]);
                c
            },
            {
                let mut c = Command::new("xsel");
                c.args(["--clipboard", "--input"]);
                c
            },
        ] {
            if pipe_to(cmd, text).is_ok() {
                return Ok(());
            }
        }
        Err("no clipboard helper found".into())
    }
}

fn pipe_to(mut cmd: Command, text: &str) -> Result<(), String> {
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    }
    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("clipboard command exited with {status}"))
    }
}

fn copy_via_osc52(text: &str) -> Result<(), String> {
    // Cap payload size — some terminals reject huge OSC sequences.
    const MAX: usize = 100_000;
    let slice = if text.len() > MAX {
        &text[..MAX]
    } else {
        text
    };
    let b64 = STANDARD.encode(slice.as_bytes());
    let seq = format!("\x1b]52;c;{b64}\x07");
    let mut out = std::io::stdout();
    out.write_all(seq.as_bytes())
        .and_then(|_| out.flush())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_text_errors() {
        assert!(copy_text("").is_err());
    }
}
