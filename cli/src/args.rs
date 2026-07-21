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
use crate::tui::keybinds::Keybinds;

/// A Ratatui-powered terminal UI for TokenRing.
///
/// Connects to a running TokenRing instance over WebSocket JSON-RPC.
#[derive(Parser, Debug)]
#[command(
    name = "tokenring-one-cli",
    version,
    about = "Ratatui-powered terminal UI for TokenRing One"
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
    ///
    /// Defaults to `.` when neither the flag nor config set a path.
    #[arg(long, value_name = "PATH")]
    pub project_directory: Option<PathBuf>,

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

    /// Bearer token for the WebSocket HTTP upgrade (`Authorization: Bearer`).
    #[arg(long, value_name = "TOKEN", env = "TR_AUTH_BEARER")]
    pub auth_bearer: Option<String>,

    /// Username for WebSocket session `auth` (JSON-RPC after connect; not HTTP Basic).
    #[arg(long, value_name = "USER", env = "TR_AUTH_USER")]
    pub auth_user: Option<String>,

    /// Password for WebSocket session `auth` (JSON-RPC after connect).
    #[arg(long, value_name = "PASS", env = "TR_AUTH_PASSWORD")]
    pub auth_password: Option<String>,

    /// Config file path (default: `~/.config/tokenring/cli.toml`).
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
    /// Canonical theme preset name (for cycling / status).
    pub theme_name: String,
    pub prompt: Option<String>,
    /// True when a `--prompt` / config `prompt` is configured (automation run).
    pub prompt_automation: bool,
    pub shutdown_when_done: bool,
    pub notifications: NotificationConfig,
    pub keybinds: Keybinds,
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
        // Username: flag/config → TR_ADMIN_USER → "admin".
        // Password: flag/config (TR_AUTH_PASSWORD via clap) → TR_ADMIN_PASSWORD → required for remote.
        let auth_user = args
            .auth_user
            .or(file.auth_user)
            .or_else(|| env_nonempty("TR_ADMIN_USER"))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "admin".to_string());
        let auth_password = args
            .auth_password
            .or(file.auth_password)
            .or_else(|| env_nonempty("TR_ADMIN_PASSWORD"))
            .filter(|s| !s.is_empty());
        // Bearer may ride the upgrade header only. Username/password use the
        // WebSocket session `auth` method — never HTTP Basic (avoids dual auth).
        let auth_header = build_auth_header(auth_bearer.as_deref())?;
        let session_auth = if ws_url.is_some() {
            let password = auth_password.ok_or_else(|| {
                anyhow::anyhow!(
                    "auth password required for remote connections \
                     (--auth-password, TR_AUTH_PASSWORD, TR_ADMIN_PASSWORD, or config auth_password)"
                )
            })?;
            Some(SessionAuth {
                username: auth_user,
                password,
            })
        } else {
            // Local launch injects generated session credentials.
            None
        };

        let agent_type = args
            .agent_type
            .or(file.agent_type)
            .unwrap_or_else(|| "code".to_string());

        let select = merge_bool(args.select, args.no_select, file.select.unwrap_or(true));
        let verbose = merge_bool(args.verbose, args.no_verbose, file.verbose.unwrap_or(false));

        let theme_name = Theme::canonical_name(
            args.theme
                .or(file.theme)
                .as_deref()
                .unwrap_or("material-dark"),
        )
        .to_string();
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

        let mut keybinds = Keybinds::defaults();
        if !file.keybinds.is_empty() {
            keybinds.apply_overrides(&file.keybinds);
        }

        let project_directory = args
            .project_directory
            .or(file.project_directory)
            .unwrap_or_else(|| PathBuf::from("."));
        let one_binary = args.one_binary.or(file.one_binary);

        Ok(Self {
            ws_url,
            one_binary,
            project_directory,
            agent_id: args.agent_id.or(file.agent_id),
            agent_type,
            select,
            auth_header,
            session_auth,
            verbose,
            theme,
            theme_name,
            prompt,
            prompt_automation,
            shutdown_when_done,
            notifications,
            keybinds,
        })
    }
}

fn env_nonempty(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|s| !s.is_empty())
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

/// Build an optional `Authorization: Bearer …` header for the WebSocket upgrade.
/// Username/password are **not** turned into HTTP Basic — they use session auth.
pub(crate) fn build_auth_header(bearer: Option<&str>) -> Result<Option<HeaderValue>> {
    match bearer {
        Some(token) if !token.is_empty() => {
            Ok(Some(HeaderValue::from_str(&format!("Bearer {token}"))?))
        }
        _ => Ok(None),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn raw_args_with_config(config: Option<String>) -> RawArgs {
        RawArgs {
            url: None,
            one_binary: None,
            project_directory: None,
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
        let args =
            RawArgs::try_parse_from(["tokenring-one-cli", "ws://localhost/rpc:ws"]).unwrap();
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
            "tokenring-cli-config-{}.toml",
            std::process::id()
        ));
        std::fs::write(
            &path,
            r#"
url = "ws://localhost/rpc:ws"
auth_password = "test-secret"
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
            "tokenring-cli-config-no-{}.toml",
            std::process::id()
        ));
        std::fs::write(
            &path,
            r#"
url = "ws://localhost/rpc:ws"
auth_password = "test-secret"
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
    fn auth_header_is_bearer_only_never_basic() {
        let header = build_auth_header(Some("secret-token")).unwrap().unwrap();
        assert_eq!(header.to_str().unwrap(), "Bearer secret-token");
        // User/password do not produce an Authorization header.
        assert!(build_auth_header(None).unwrap().is_none());
        assert!(build_auth_header(Some("")).unwrap().is_none());
    }

    #[test]
    fn session_auth_from_user_password() {
        let mut args = raw_args_with_config(None);
        args.auth_user = Some("cli".into());
        args.auth_password = Some("secret".into());
        args.url = Some("ws://localhost/rpc:ws".into());
        let config = Config::from_args(args).unwrap();
        assert!(config.auth_header.is_none());
        let auth = config.session_auth.expect("session auth");
        assert_eq!(auth.username, "cli");
        assert_eq!(auth.password, "secret");
    }

    #[test]
    fn remote_url_requires_password() {
        let mut args = raw_args_with_config(None);
        args.url = Some("ws://localhost/rpc:ws".into());
        assert!(Config::from_args(args).is_err());
    }

    #[test]
    fn remote_url_defaults_username_to_admin() {
        let mut args = raw_args_with_config(None);
        args.url = Some("ws://localhost/rpc:ws".into());
        args.auth_password = Some("secret".into());
        let config = Config::from_args(args).unwrap();
        let auth = config.session_auth.expect("session auth");
        assert_eq!(auth.username, "admin");
        assert_eq!(auth.password, "secret");
    }

    #[test]
    fn local_startup_does_not_require_password() {
        let config = Config::from_args(raw_args_with_config(None)).unwrap();
        assert!(config.ws_url.is_none());
        assert!(config.session_auth.is_none());
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
