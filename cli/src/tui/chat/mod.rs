//! A single chat session: transcript rendering (streaming-merge, verbose
//! filtering), the context-aware hint line, the status line, flash messages,
//! and the message composer. Ports the rendering core of `RawChatUI`.
//!
//! Originally a single 3000-line file, the session is decomposed into
//! individually drawable and testable components:
//!
//! - [`session`] owns the [`ChatSession`] state, the [`run_session`]
//!   event loop, and small state/view-model helpers.
//! - [`events`] drains the agent event stream (with reconnect/backoff) and
//!   applies inbound events to the transcript + interaction state.
//! - [`interactions`] resolves the focused question/follow-up and routes input
//!   to the active question session.
//! - [`composer`] drives the message editor: slash-command completion, `@`
//!   file-search, history, paste, and submission.
//! - [`keys`] dispatches keyboard/mouse input (global shortcuts, leader chords,
//!   transcript scrolling, picker navigation).
//! - [`layout`] holds the pure geometry/surface helpers (spacing, blocks,
//!   truncation) shared by every drawable component, with unit tests.
//! - [`render`] is the top-level frame dispatcher and renders the transcript,
//!   hint, composer, status, and help overlay.
//! - [`pickers`] renders the command-completion and file-search pickers.
//! - [`panels`] renders the full-viewport question, optional-question, and
//!   follow-up panels.

mod composer;
mod events;
mod interactions;
mod keys;
mod layout;
mod panels;
mod pickers;
mod render;
mod session;
mod transcript_entries;

pub use session::{run_session, ChatSession};
