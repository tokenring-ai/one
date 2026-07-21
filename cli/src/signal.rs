//! OS signal handling for clean CLI shutdown.
//!
//! Registers handlers early so SIGINT / SIGTERM (and SIGHUP on Unix) set flags
//! instead of killing the process mid-frame. Event loops poll those flags and
//! unwind normally so [`TerminalGuard`] and [`LocalInstance`] Drop impls restore
//! the terminal and stop the launched backend.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

use anyhow::{Context, Result};

static TERMINATE: OnceLock<Arc<AtomicBool>> = OnceLock::new();
static INTERRUPT: OnceLock<Arc<AtomicBool>> = OnceLock::new();

/// Install process-wide handlers for graceful shutdown signals.
///
/// Safe to call more than once; later calls are no-ops once handlers are live.
pub fn install() -> Result<()> {
    if TERMINATE.get().is_some() {
        return Ok(());
    }

    let terminate = Arc::new(AtomicBool::new(false));
    let interrupt = Arc::new(AtomicBool::new(false));
    let _ = TERMINATE.set(Arc::clone(&terminate));
    let _ = INTERRUPT.set(Arc::clone(&interrupt));

    signal_hook::flag::register(signal_hook::consts::SIGINT, Arc::clone(&interrupt))
        .context("register SIGINT handler")?;
    signal_hook::flag::register(signal_hook::consts::SIGTERM, Arc::clone(&terminate))
        .context("register SIGTERM handler")?;

    #[cfg(unix)]
    {
        // Terminal hangup / disconnected session — treat as terminate.
        signal_hook::flag::register(signal_hook::consts::SIGHUP, Arc::clone(&terminate))
            .context("register SIGHUP handler")?;
    }

    Ok(())
}

/// What the process should do after observing a signal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pending {
    /// No signal since the last poll.
    None,
    /// SIGINT — treat like Ctrl+C (cancel work; second press exits).
    Interrupt,
    /// SIGTERM / SIGHUP — leave the application immediately.
    Terminate,
}

/// Consume any pending signal and return the highest-priority action.
///
/// Terminate wins over Interrupt if both were raised.
pub fn take_pending() -> Pending {
    let terminate = TERMINATE
        .get()
        .map(|f| f.swap(false, Ordering::SeqCst))
        .unwrap_or(false);
    let interrupt = INTERRUPT
        .get()
        .map(|f| f.swap(false, Ordering::SeqCst))
        .unwrap_or(false);

    if terminate {
        Pending::Terminate
    } else if interrupt {
        Pending::Interrupt
    } else {
        Pending::None
    }
}

/// Clear a pending SIGINT without acting on it.
///
/// Used when Ctrl+C is already handled as a terminal key event so the same
/// keystroke is not treated as a second interrupt via the signal flag.
pub fn clear_interrupt() {
    if let Some(flag) = INTERRUPT.get() {
        flag.store(false, Ordering::SeqCst);
    }
}

/// True when any signal asks the current screen/loop to stop.
///
/// Screens treat interrupt and terminate the same (leave immediately).
pub fn take_quit() -> bool {
    !matches!(take_pending(), Pending::None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_pending_is_none_without_install() {
        // Fresh process in unit tests may or may not have handlers; when flags
        // are unset, polling must stay quiet.
        if TERMINATE.get().is_none() {
            assert_eq!(take_pending(), Pending::None);
        }
    }
}
