//! TOML configuration for the platform config dir (`cli.toml`) (nice-to-have #1).
//!
//! Default path is `{dirs::config_dir()}/tokenring/cli.toml` (XDG on Linux,
//! Application Support on macOS, RoamingAppData on Windows). CLI flags take
//! precedence over file values (git-style). Profiles overlay the root table via
//! `[profile.<name>]`.
//!
//! On load, existing config files are forced to mode `0600` (Unix) so secrets
//! are not world-readable.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde::Deserialize;

/// Notification preferences (nice-to-have #17).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct NotificationConfig {
    pub bell: bool,
    pub desktop: bool,
    pub hook: Option<String>,
}

/// Values loaded from the config file (all optional).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct FileConfig {
    pub url: Option<String>,
    pub auth_bearer: Option<String>,
    pub auth_user: Option<String>,
    pub auth_password: Option<String>,
    pub agent_id: Option<String>,
    pub agent_type: Option<String>,
    pub select: Option<bool>,
    pub verbose: Option<bool>,
    pub theme: Option<String>,
    pub panel_style: Option<String>,
    pub prompt: Option<String>,
    pub shutdown_when_done: Option<bool>,
    pub notifications: NotificationConfig,
    /// Optional path to the TokenRing One binary for local launch.
    pub one_binary: Option<PathBuf>,
    /// Project directory for local launch (default `.` when unset).
    pub project_directory: Option<PathBuf>,
    /// Optional keybind overrides (`command_list = "ctrl+p"`, `leader = "ctrl+x"`, …).
    #[serde(default)]
    pub keybinds: HashMap<String, String>,
    #[serde(default)]
    pub profile: HashMap<String, ProfileConfig>,
}

/// Per-profile overrides (`[profile.work]`, etc.).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct ProfileConfig {
    pub url: Option<String>,
    pub auth_bearer: Option<String>,
    pub auth_user: Option<String>,
    pub auth_password: Option<String>,
    pub agent_id: Option<String>,
    pub agent_type: Option<String>,
    pub select: Option<bool>,
    pub verbose: Option<bool>,
    pub theme: Option<String>,
    pub panel_style: Option<String>,
    pub prompt: Option<String>,
    pub shutdown_when_done: Option<bool>,
    pub notifications: Option<NotificationConfig>,
    pub one_binary: Option<PathBuf>,
    pub project_directory: Option<PathBuf>,
    #[serde(default)]
    pub keybinds: HashMap<String, String>,
}

impl FileConfig {
    /// Preferred config path: `{config_dir}/tokenring/cli.toml`.
    pub fn default_path() -> Option<PathBuf> {
        Self::config_dir().map(|dir| dir.join("cli.toml"))
    }

    /// Legacy path from the `cli-rs` branding era (same config dir).
    pub fn legacy_path() -> Option<PathBuf> {
        Self::config_dir().map(|dir| dir.join("cli-rs.toml"))
    }

    /// Extra legacy path under `$HOME/.config/tokenring` when `dirs` resolves
    /// elsewhere (e.g. macOS Application Support) so older installs still load.
    fn home_dot_config_legacy_paths() -> Vec<PathBuf> {
        let Some(home) = dirs::home_dir() else {
            return Vec::new();
        };
        let base = home.join(".config").join("tokenring");
        vec![base.join("cli.toml"), base.join("cli-rs.toml")]
    }

    fn config_dir() -> Option<PathBuf> {
        dirs::config_dir().map(|dir| dir.join("tokenring"))
    }

    /// Resolve which default file to load: platform `cli.toml`, then legacy names.
    fn resolve_default_path() -> Option<PathBuf> {
        if let Some(path) = Self::default_path() {
            if path.exists() {
                return Some(path);
            }
        }
        if let Some(legacy) = Self::legacy_path() {
            if legacy.exists() {
                return Some(legacy);
            }
        }
        for path in Self::home_dot_config_legacy_paths() {
            if path.exists() {
                return Some(path);
            }
        }
        Self::default_path()
    }

    /// Load from an explicit path or the default location. Missing files → empty config.
    /// Existing files are forced to mode `0600` on Unix (secrets at rest).
    pub fn load(path: Option<&Path>) -> Result<Self> {
        let path = path
            .map(PathBuf::from)
            .or_else(Self::resolve_default_path)
            .context("could not resolve config path (home/config dir unavailable)")?;
        if !path.exists() {
            return Ok(Self::default());
        }
        enforce_private_mode(&path)?;
        let text = fs::read_to_string(&path)
            .with_context(|| format!("read config {}", path.display()))?;
        toml::from_str(&text).with_context(|| format!("parse config {}", path.display()))
    }

    /// Apply a named profile overlay onto the root config.
    pub fn with_profile(mut self, name: &str) -> Result<Self> {
        let Some(profile) = self.profile.remove(name) else {
            bail!("unknown config profile '{name}'");
        };
        if let Some(v) = profile.url {
            self.url = Some(v);
        }
        if let Some(v) = profile.auth_bearer {
            self.auth_bearer = Some(v);
        }
        if let Some(v) = profile.auth_user {
            self.auth_user = Some(v);
        }
        if let Some(v) = profile.auth_password {
            self.auth_password = Some(v);
        }
        if let Some(v) = profile.agent_id {
            self.agent_id = Some(v);
        }
        if let Some(v) = profile.agent_type {
            self.agent_type = Some(v);
        }
        if profile.select.is_some() {
            self.select = profile.select;
        }
        if profile.verbose.is_some() {
            self.verbose = profile.verbose;
        }
        if let Some(v) = profile.theme {
            self.theme = Some(v);
        }
        if let Some(v) = profile.panel_style {
            self.panel_style = Some(v);
        }
        if let Some(v) = profile.prompt {
            self.prompt = Some(v);
        }
        if profile.shutdown_when_done.is_some() {
            self.shutdown_when_done = profile.shutdown_when_done;
        }
        if let Some(n) = profile.notifications {
            self.notifications = n;
        }
        if let Some(v) = profile.one_binary {
            self.one_binary = Some(v);
        }
        if let Some(v) = profile.project_directory {
            self.project_directory = Some(v);
        }
        if !profile.keybinds.is_empty() {
            self.keybinds.extend(profile.keybinds);
        }
        Ok(self)
    }
}

/// Force `0600` on a config file so bearer tokens / passwords are not group- or
/// world-readable. No-op on non-Unix platforms.
fn enforce_private_mode(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata =
            fs::metadata(path).with_context(|| format!("stat config {}", path.display()))?;
        let mode = metadata.permissions().mode() & 0o777;
        if mode != 0o600 {
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))
                .with_context(|| format!("set mode 0600 on config {}", path.display()))?;
        }
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_profile_errors() {
        let cfg = FileConfig::default();
        assert!(cfg.with_profile("missing").is_err());
    }

    #[test]
    fn profile_overlays_url() {
        let mut cfg = FileConfig {
            url: Some("ws://default/rpc:ws".into()),
            ..FileConfig::default()
        };
        cfg.profile.insert(
            "work".into(),
            ProfileConfig {
                url: Some("ws://work/rpc:ws".into()),
                ..ProfileConfig::default()
            },
        );
        let merged = cfg.with_profile("work").unwrap();
        assert_eq!(merged.url.as_deref(), Some("ws://work/rpc:ws"));
    }

    #[test]
    fn parses_notifications_from_toml() {
        let cfg: FileConfig = toml::from_str(
            r#"
[notifications]
bell = true
hook = "echo done"
"#,
        )
        .unwrap();
        assert!(cfg.notifications.bell);
        assert_eq!(cfg.notifications.hook.as_deref(), Some("echo done"));
    }

    #[test]
    #[cfg(unix)]
    fn load_forces_private_mode() {
        use std::os::unix::fs::PermissionsExt;
        let path = std::env::temp_dir().join(format!(
            "tokenring-cli-perms-{}-{}.toml",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::write(&path, "verbose = true\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        FileConfig::load(Some(&path)).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        let _ = fs::remove_file(&path);
        assert_eq!(mode, 0o600);
    }
}
