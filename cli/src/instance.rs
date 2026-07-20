//! Discovery and lifecycle management for a TokenRing One backend launched by
//! the terminal client.

use std::collections::VecDeque;
use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use anyhow::{bail, Context, Result};

use crate::rpc::SessionAuth;

const SYSTEM_ONE_PATHS: [&str; 2] = ["/usr/bin/tokenring-one", "/usr/local/bin/tokenring-one"];
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_CAPTURED_LINES: usize = 200;

/// A local TokenRing One child process. Dropping the handle terminates the
/// backend, so the instance lifetime is tied to the CLI session.
pub struct LocalInstance {
    child: Child,
    captured_output: Arc<Mutex<VecDeque<String>>>,
    pub ws_url: String,
    pub session_auth: SessionAuth,
}

impl LocalInstance {
    /// Launch TokenRing One on a free loopback port. Both output streams are
    /// piped and drained on background threads so backend logs never corrupt
    /// the alternate-screen TUI (and cannot fill a pipe and stall the server).
    pub fn launch(binary: &Path, project_directory: &Path) -> Result<Self> {
        let port = reserve_loopback_port()?;
        let username = "tokenring-cli";
        let password = random_password();
        let captured_output = Arc::new(Mutex::new(VecDeque::new()));

        let mut child = Command::new(binary)
            .arg("--listen")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(port.to_string())
            .arg("--projectDirectory")
            .arg(project_directory)
            .env("TR_ADMIN_USER", username)
            .env("TR_ADMIN_PASSWORD", &password)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .with_context(|| format!("launch TokenRing One at {}", binary.display()))?;

        if let Some(stdout) = child.stdout.take() {
            drain_output(stdout, "stdout", Arc::clone(&captured_output));
        }
        if let Some(stderr) = child.stderr.take() {
            drain_output(stderr, "stderr", Arc::clone(&captured_output));
        }

        let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
        if let Err(error) = wait_until_ready(&mut child, address, &captured_output) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }

        Ok(Self {
            child,
            captured_output,
            ws_url: format!("ws://127.0.0.1:{port}/rpc:ws"),
            session_auth: SessionAuth {
                username: username.to_string(),
                password,
            },
        })
    }

    #[allow(dead_code)]
    pub fn captured_output(&self) -> Vec<String> {
        self.captured_output
            .lock()
            .map(|lines| lines.iter().cloned().collect())
            .unwrap_or_default()
    }
}

impl Drop for LocalInstance {
    fn drop(&mut self) {
        if matches!(self.child.try_wait(), Ok(None)) {
            let _ = self.child.kill();
        }
        let _ = self.child.wait();
    }
}

/// Find the backend supplied explicitly (the npm launcher sets
/// TOKENRING_ONE_BINARY) or installed by a Debian/RPM package.
pub fn discover(explicit: Option<&Path>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        return validate_binary(path);
    }

    for candidate in SYSTEM_ONE_PATHS {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Ok(path);
        }
    }

    bail!(
        "TokenRing One was not found. Install @tokenring/one, install the \
         tokenring-one system package, or set TOKENRING_ONE_BINARY"
    )
}

fn validate_binary(path: &Path) -> Result<PathBuf> {
    if !path.is_file() {
        bail!("TokenRing One executable not found: {}", path.display());
    }
    Ok(path.to_path_buf())
}

fn reserve_loopback_port() -> Result<u16> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .context("reserve a loopback port for TokenRing One")?;
    Ok(listener.local_addr()?.port())
}

fn wait_until_ready(
    child: &mut Child,
    address: SocketAddr,
    captured_output: &Arc<Mutex<VecDeque<String>>>,
) -> Result<()> {
    let started = Instant::now();
    while started.elapsed() < STARTUP_TIMEOUT {
        if crate::signal::take_quit() {
            bail!("interrupted while starting TokenRing One");
        }

        if let Some(status) = child.try_wait().context("check TokenRing One status")? {
            bail!(
                "TokenRing One exited during startup with {status}.{}",
                output_suffix(captured_output)
            );
        }

        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(50));
    }

    bail!(
        "timed out waiting for TokenRing One at {address}.{}",
        output_suffix(captured_output)
    )
}

fn drain_output<R: Read + Send + 'static>(
    reader: R,
    stream: &'static str,
    captured_output: Arc<Mutex<VecDeque<String>>>,
) {
    thread::Builder::new()
        .name(format!("tokenring-one-{stream}"))
        .spawn(move || {
            for line in BufReader::new(reader).lines().map_while(|line| line.ok()) {
                if let Ok(mut lines) = captured_output.lock() {
                    if lines.len() == MAX_CAPTURED_LINES {
                        lines.pop_front();
                    }
                    lines.push_back(format!("[{stream}] {line}"));
                }
            }
        })
        .ok();
}

fn output_suffix(captured_output: &Arc<Mutex<VecDeque<String>>>) -> String {
    let Ok(lines) = captured_output.lock() else {
        return String::new();
    };
    if lines.is_empty() {
        String::new()
    } else {
        format!(
            "\n\nCaptured backend output:\n{}",
            lines.iter().cloned().collect::<Vec<_>>().join("\n")
        )
    }
}

fn random_password() -> String {
    let mut bytes = [0u8; 24];
    if File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut bytes))
        .is_err()
    {
        let fallback = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
            ^ u128::from(std::process::id());
        bytes[..16].copy_from_slice(&fallback.to_le_bytes());
    }
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explicit_binary_is_preferred() {
        let path = std::env::current_exe().unwrap();
        assert_eq!(discover(Some(&path)).unwrap(), path);
    }

    #[test]
    fn missing_explicit_binary_is_an_error() {
        let path = std::env::temp_dir().join("missing-tokenring-one");
        assert!(discover(Some(&path)).is_err());
    }

    #[test]
    fn generated_password_has_entropy_length() {
        assert_eq!(random_password().len(), 48);
    }
}
