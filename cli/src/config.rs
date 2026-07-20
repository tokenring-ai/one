//! TOML configuration for `~/.config/tokenring/cli-rs.toml` (nice-to-have #1).
//!
//! CLI flags take precedence over file values (git-style). Profiles overlay the
//! root table via `[profile.<name>]`.

use std::collections::HashMap;
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
}

impl FileConfig {
    /// Default config path: `~/.config/tokenring/cli-rs.toml`.
    pub fn default_path() -> Option<PathBuf> {
        std::env::var("HOME").ok().map(|h| {
            PathBuf::from(h)
                .join(".config")
                .join("tokenring")
                .join("cli-rs.toml")
        })
    }

    /// Load from an explicit path or the default location. Missing files → empty config.
    pub fn load(path: Option<&Path>) -> Result<Self> {
        let path = path
            .map(PathBuf::from)
            .or_else(Self::default_path)
            .context("could not resolve config path (HOME unset?)")?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let text = std::fs::read_to_string(&path)
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
        Ok(self)
    }
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
}
