//! Typed domain models for the TokenRing CLI.

pub mod events;
pub mod questions;

pub use events::{AgentEvent, AgentResponse, Attachment, ToolCallResult};
pub use questions::{Interaction, Question};
