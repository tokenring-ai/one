//! Command-line argument parsing, modelled on `backend/tokenring.ts` and adapted
//! for the standalone WebSocket client.

use anyhow::{bail, Result};
use clap::{ArgAction, Parser};
use std::path::PathBuf;
use tungstenite::http::HeaderValue;
use tungstenite::http::Uri;

use crate::config::{FileConfig, NotificationConfig};
use crate::rpc::SessionAuth;
use crate::theme::Theme;

/// A Ratatui-powered terminal UI for TokenRing.
///
/// Connects to a running TokenRing instance over WebSocket JSON-RPC.
#[derive(Parser, Debug)]
#[command(
    name = "tokenring",
    version,
    about = "Ratatui-powered terminal UI for TokenRing"
)]
pub struct RawArgs {
    /// URL of the TokenRing instance (ws://, wss://, http:// or https://).
    ///
    /// `http(s)://` is rewritten to `ws(s)://` and `/rpc:ws` is appended if
    /// missing. Overrides config `url`.
    pub url: Option<String>,

    /// TokenRing One executable used when launching a local instance.
    ///
    /// Defaults to TOKENRING_ONE_BINARY, then /usr/bin/tokenring-one and
    /// /usr/local/bin/tokenring-one.
    #[arg(long, value_name = "PATH", env = "TOKENRING_ONE_BINARY")]
    pub one_binary: Option<PathBuf>,

    /// Project directory passed to a locally launched TokenRing One instance.
    #[arg(long, value_name = "PATH", default_value = ".")]
    pub project_directory: PathBuf,

    /// Attach to an existing agent instead of creating a new one.
    #[arg(long, value_name = "ID", env = "TR_AGENT_ID")]
    pub agent_id: Option<String>,

    /// Agent type to create when no `--agent-id` is given.
    #[arg(long, value_name = "TYPE", env = "TR_AGENT_TYPE")]
    pub agent_type: Option<String>,

    /// Show the agent selection browser instead of spawning immediately.
    #[arg(long, action = ArgAction::SetTrue)]
    pub select: bool,

    /// Skip the agent selection browser (overrides config `select = true`).
    #[arg(long, action = ArgAction::SetTrue, overrides_with = "select")]
    pub no_select: bool,

    /// Bearer token for HTTP basic/bearer auth on the WS upgrade.
    #[arg(long, value_name = "TOKEN", env = "TR_AUTH_BEARER")]
    pub auth_bearer: Option<String>,

    /// Username for HTTP basic auth on the WS upgrade.
    #[arg(long, value_name = "USER", env = "TR_AUTH_USER")]
    pub auth_user: Option<String>,

    /// Password for HTTP basic auth on the WS upgrade.
    #[arg(long, value_name = "PASS", env = "TR_AUTH_PASSWORD")]
    pub auth_password: Option<String>,

    /// Config file path (default: `~/.config/tokenring/cli-rs.toml`).
    #[arg(long, value_name = "PATH")]
    pub config: Option<String>,

    /// Named config profile (`[profile.<name>]` in the config file).
    #[arg(long, value_name = "NAME")]
    pub profile: Option<String>,

    /// Start in verbose transcript mode (Ctrl-x v toggles at runtime).
    #[arg(long, action = ArgAction::SetTrue)]
    pub verbose: bool,

    /// Start in quiet transcript mode (overrides config `verbose = true`).
    #[arg(long, action = ArgAction::SetTrue, overrides_with = "verbose")]
    pub no_verbose: bool,

    /// Colour theme preset (`material-dark`, `framed-light`, …).
    #[arg(long, value_name = "NAME")]
    pub theme: Option<String>,

    /// Panel chrome style (`flat` or `framed`).
    #[arg(long, value_name = "STYLE")]
    pub panel_style: Option<String>,

    /// Send an initial message after the agent attaches (automation).
    #[arg(long, value_name = "TEXT")]
    pub prompt: Option<String>,

    /// Exit when the agent stops (pairs with `--prompt` for one-shot runs).
    #[arg(long, action = ArgAction::SetTrue)]
    pub shutdown_when_done: bool,

    /// Keep the session open when the agent stops (overrides config).
    #[arg(long, action = ArgAction::SetTrue, overrides_with = "shutdown_when_done")]
    pub no_shutdown_when_done: bool,

    /// Ring the terminal bell when the agent finishes a run.
    #[arg(long, action = ArgAction::SetTrue)]
    pub notify_bell: bool,

    /// Disable the terminal bell on completion (overrides config).
    #[arg(long, action = ArgAction::SetTrue, overrides_with = "notify_bell")]
    pub no_notify_bell: bool,

    /// Send a desktop notification when the agent finishes a run.
    #[arg(long, action = ArgAction::SetTrue)]
    pub notify_desktop: bool,

    /// Disable desktop notifications on completion (overrides config).
    #[arg(long, action = ArgAction::SetTrue, overrides_with = "notify_desktop")]
    pub no_notify_desktop: bool,
}

/// Fully-resolved CLI configuration.
#[derive(Clone, Debug)]
pub struct Config {
    pub ws_url: Option<String>,
    pub one_binary: Option<PathBuf>,
    pub project_directory: PathBuf,
    pub agent_id: Option<String>,
    pub agent_type: String,
    pub select: bool,
    pub auth_header: Option<HeaderValue>,
    pub session_auth: Option<SessionAuth>,
    pub verbose: bool,
    pub theme: Theme,
    pub prompt: Option<String>,
    /// True when a `--prompt` / config `prompt` is configured (automation run).
    pub prompt_automation: bool,
    pub shutdown_when_done: bool,
    pub notifications: NotificationConfig,
}

impl Config {
    pub fn parse() -> Result<Self> {
        Self::from_args(RawArgs::parse())
    }

    pub fn from_args(args: RawArgs) -> Result<Self> {
        let mut file = FileConfig::load(args.config.as_deref().map(std::path::Path::new))?;
        if let Some(profile) = &args.profile {
            file = file.with_profile(profile)?;
        }

        let ws_url = args
            .url
            .or(file.url)
            .map(|url| normalize_ws_url(&url))
            .transpose()?;

        let auth_bearer = args.auth_bearer.or(file.auth_bearer);
        let auth_user = args.auth_user.or(file.auth_user);
        let auth_password = args.auth_password.or(file.auth_password);
        let auth_header = build_auth_header(
            auth_bearer.as_deref(),
            auth_user.as_deref(),
            auth_password.as_deref(),
        )?;
        let session_auth = auth_user.map(|username| SessionAuth {
            username,
            password: auth_password.unwrap_or_default(),
        });

        let agent_type = args
            .agent_type
            .or(file.agent_type)
            .unwrap_or_else(|| "code".to_string());

        let select = merge_bool(args.select, args.no_select, file.select.unwrap_or(true));
        let verbose = merge_bool(args.verbose, args.no_verbose, file.verbose.unwrap_or(false));

        let theme_name = args
            .theme
            .or(file.theme)
            .unwrap_or_else(|| "material-dark".to_string());
        let mut theme = Theme::from_name(&theme_name);
        if let Some(style) = args.panel_style.or(file.panel_style) {
            theme = theme.with_panel_style(&style);
        }

        let prompt = args.prompt.or(file.prompt);
        let prompt_automation = prompt.is_some();
        let shutdown_when_done = merge_bool(
            args.shutdown_when_done,
            args.no_shutdown_when_done,
            file.shutdown_when_done.unwrap_or(false),
        );

        let notifications = NotificationConfig {
            bell: merge_bool(
                args.notify_bell,
                args.no_notify_bell,
                file.notifications.bell,
            ),
            desktop: merge_bool(
                args.notify_desktop,
                args.no_notify_desktop,
                file.notifications.desktop,
            ),
            hook: file.notifications.hook,
        };

        Ok(Self {
            ws_url,
            one_binary: args.one_binary,
            project_directory: args.project_directory,
            agent_id: args.agent_id.or(file.agent_id),
            agent_type,
            select,
            auth_header,
            session_auth,
            verbose,
            theme,
            prompt,
            prompt_automation,
            shutdown_when_done,
            notifications,
        })
    }
}

/// Git-style precedence: explicit CLI true/false beats file default.
fn merge_bool(cli_true: bool, cli_false: bool, file_default: bool) -> bool {
    if cli_true {
        return true;
    }
    if cli_false {
        return false;
    }
    file_default
}

/// Build the `Authorization` header value, preferring bearer, then basic.
/// Returns `Ok(None)` when no auth credentials were supplied.
pub(crate) fn build_auth_header(
    bearer: Option<&str>,
    user: Option<&str>,
    password: Option<&str>,
) -> Result<Option<HeaderValue>> {
    if let Some(token) = bearer {
        return Ok(Some(HeaderValue::from_str(&format!("Bearer {token}"))?));
    }
    if let Some(user) = user {
        let password = password.unwrap_or("");
        let credentials = base64_encode(format!("{user}:{password}").as_bytes());
        return Ok(Some(HeaderValue::from_str(&format!(
            "Basic {credentials}"
        ))?));
    }
    Ok(None)
}

/// Normalise an input URL to a `ws(s)://host/rpc:ws` form.
pub fn normalize_ws_url(input: &str) -> Result<String> {
    let uri: Uri = input.parse()?;
    let scheme = match uri.scheme_str() {
        Some("http") => "ws",
        Some("https") => "wss",
        Some("ws") => "ws",
        Some("wss") => "wss",
        _ => bail!("URL must start with ws://, wss://, http://, or https://"),
    };
    let authority = uri
        .authority()
        .ok_or_else(|| anyhow::anyhow!("URL must include a host"))?;
    let path = uri.path();
    let path = if path.is_empty() || path == "/" {
        "/rpc:ws".to_string()
    } else if path == "/rpc:ws" || path.ends_with("/rpc:ws") {
        path.to_string()
    } else {
        format!("{}/rpc:ws", path.trim_end_matches('/'))
    };
    let query = uri
        .query()
        .map(|query| format!("?{query}"))
        .unwrap_or_default();

    Ok(format!("{scheme}://{authority}{path}{query}"))
}

/// Minimal RFC 4648 base64 encoder (no extra dependency).
fn base64_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let triple = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        out.push(ALPHABET[((triple >> 18) & 0x3F) as usize] as char);
        out.push(ALPHABET[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(triple & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw_args_with_config(config: Option<String>) -> RawArgs {
        RawArgs {
            url: None,
            one_binary: None,
            project_directory: PathBuf::from("."),
            agent_id: None,
            agent_type: None,
            select: false,
            no_select: false,
            auth_bearer: None,
            auth_user: None,
            auth_password: None,
            config,
            profile: None,
            verbose: false,
            no_verbose: false,
            theme: None,
            panel_style: None,
            prompt: None,
            shutdown_when_done: false,
            no_shutdown_when_done: false,
            notify_bell: false,
            no_notify_bell: false,
            notify_desktop: false,
            no_notify_desktop: false,
        }
    }

    #[test]
    fn no_flags_are_false_when_absent() {
        let args = RawArgs::try_parse_from(["tokenring", "ws://localhost/rpc:ws"]).unwrap();
        assert!(!args.no_select);
        assert!(!args.no_verbose);
        assert!(!args.no_shutdown_when_done);
        assert!(!args.no_notify_bell);
        assert!(!args.no_notify_desktop);
    }

    #[test]
    fn missing_url_selects_local_startup_flow() {
        let config = Config::from_args(raw_args_with_config(None)).unwrap();
        assert!(config.ws_url.is_none());
        assert_eq!(config.project_directory, PathBuf::from("."));
    }

    #[test]
    fn config_true_booleans_survive_when_no_flag_absent() {
        let path = std::env::temp_dir().join(format!(
            "tokenring-cli-rs-config-{}.toml",
            std::process::id()
        ));
        std::fs::write(
            &path,
            r#"
url = "ws://localhost/rpc:ws"
select = true
verbose = true
shutdown_when_done = true

[notifications]
bell = true
desktop = true
"#,
        )
        .unwrap();

        let config = Config::from_args(raw_args_with_config(Some(
            path.to_string_lossy().to_string(),
        )))
        .unwrap();
        let _ = std::fs::remove_file(path);

        assert!(config.select);
        assert!(config.verbose);
        assert!(config.shutdown_when_done);
        assert!(config.notifications.bell);
        assert!(config.notifications.desktop);
    }

    #[test]
    fn no_flags_override_config_true_booleans() {
        let path = std::env::temp_dir().join(format!(
            "tokenring-cli-rs-config-no-{}.toml",
            std::process::id()
        ));
        std::fs::write(
            &path,
            r#"
url = "ws://localhost/rpc:ws"
select = true
verbose = true
shutdown_when_done = true

[notifications]
bell = true
desktop = true
"#,
        )
        .unwrap();

        let mut args = raw_args_with_config(Some(path.to_string_lossy().to_string()));
        args.no_select = true;
        args.no_verbose = true;
        args.no_shutdown_when_done = true;
        args.no_notify_bell = true;
        args.no_notify_desktop = true;

        let config = Config::from_args(args).unwrap();
        let _ = std::fs::remove_file(path);

        assert!(!config.select);
        assert!(!config.verbose);
        assert!(!config.shutdown_when_done);
        assert!(!config.notifications.bell);
        assert!(!config.notifications.desktop);
    }

    #[test]
    fn normalizes_http_to_ws_and_appends_endpoint() {
        assert_eq!(
            normalize_ws_url("http://127.0.0.1:3000").unwrap(),
            "ws://127.0.0.1:3000/rpc:ws"
        );
        assert_eq!(
            normalize_ws_url("https://example.com/").unwrap(),
            "wss://example.com/rpc:ws"
        );
    }

    #[test]
    fn leaves_existing_rpc_endpoint_intact() {
        assert_eq!(
            normalize_ws_url("ws://127.0.0.1:3000/rpc:ws").unwrap(),
            "ws://127.0.0.1:3000/rpc:ws"
        );
    }

    #[test]
    fn appends_endpoint_by_path_not_substring() {
        assert_eq!(
            normalize_ws_url("http://127.0.0.1:3000/foo/rpc:ws-shadow").unwrap(),
            "ws://127.0.0.1:3000/foo/rpc:ws-shadow/rpc:ws"
        );
    }

    #[test]
    fn rejects_non_websocket_schemes() {
        assert!(normalize_ws_url("ftp://example.com").is_err());
    }

    #[test]
    fn base64_encodes_credentials() {
        assert_eq!(base64_encode(b"user:pass"), "dXNlcjpwYXNz");
        assert_eq!(base64_encode(b"a"), "YQ==");
    }

    #[test]
    fn theme_from_name_parses_presets() {
        assert_eq!(
            Theme::from_name("framed-light").layout.panel_style,
            crate::theme::PanelStyle::Framed
        );
    }

    #[test]
    fn merge_bool_cli_false_overrides_file_true() {
        assert!(!merge_bool(false, true, true));
    }

    #[test]
    fn merge_bool_cli_true_overrides_file_false() {
        assert!(merge_bool(true, false, false));
    }

    #[test]
    fn merge_bool_falls_back_to_file() {
        assert!(merge_bool(false, false, true));
        assert!(!merge_bool(false, false, false));
    }
}
