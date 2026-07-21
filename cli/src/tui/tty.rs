//! Interactive TTY liveness checks for event loops.
//!
//! After the controlling terminal hangs up, an orphaned process can keep open
//! pty slave FDs where `isatty` still returns true. Crossterm's default mio
//! event backend then spins forever on `read() → Ok(0)`. We enable
//! `use-dev-tty` so poll returns, and bail from event loops when the session
//! is clearly gone.

use std::io::{stdin, stdout, IsTerminal};

/// True when stdin/stdout are still usable interactive terminals.
///
/// On Unix, also requires that a controlling terminal still exists
/// (`open("/dev/tty")`). That fails with ENXIO after hangup even when the
/// old slave FDs remain open and report as TTYs.
pub(crate) fn is_alive() -> bool {
    if !stdin().is_terminal() || !stdout().is_terminal() {
        return false;
    }

    #[cfg(unix)]
    {
        if std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open("/dev/tty")
            .is_err()
        {
            return false;
        }
    }

    true
}
