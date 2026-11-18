//! Live goal-mode status received from the goal plugin stream.

use serde_json::{json, Value};

use crate::rpc::{JsonStream, JsonStreamItem, RpcClient};

/// Lifecycle status of the agent's goal.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum GoalStatus {
    #[default]
    Stopped,
    Active,
    Paused,
    Completed,
    Blocked,
    Unknown,
}

impl GoalStatus {
    fn parse(value: &str) -> Self {
        match value {
            "active" => Self::Active,
            "paused" => Self::Paused,
            "completed" => Self::Completed,
            "blocked" => Self::Blocked,
            "stopped" => Self::Stopped,
            _ => Self::Unknown,
        }
    }

    /// Short label for the status line segment.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Active => "",
            Self::Paused => "paused",
            Self::Completed => "done",
            Self::Blocked => "blocked",
            Self::Stopped => "stopped",
            Self::Unknown => "",
        }
    }
}

/// Status of a goal as reported by the persistent verifier.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum GoalVerdictStatus {
    #[default]
    InProgress,
    Achieved,
    Blocked,
    Unknown,
}

impl GoalVerdictStatus {
    fn parse(value: &str) -> Self {
        match value {
            "achieved" => Self::Achieved,
            "in_progress" => Self::InProgress,
            "blocked" => Self::Blocked,
            _ => Self::Unknown,
        }
    }
}

/// The verifier's most recent verdict.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct GoalVerdict {
    pub status: GoalVerdictStatus,
    pub reasoning: String,
    pub guidance: Option<String>,
}

/// Latest goal snapshot for the agent.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Goal {
    pub text: String,
    pub status: GoalStatus,
    pub attempts: u64,
    pub max_turns: u64,
    pub last_verdict: Option<GoalVerdict>,
}

impl Goal {
    /// Compact status-line segment, e.g. `Goal 3/25` or `Goal blocked 3/25`.
    pub fn status_segment(&self) -> String {
        let turns = format!("{}/{}", self.attempts, self.max_turns);
        let suffix = self.status.label();
        if suffix.is_empty() {
            format!("Goal {turns}")
        } else {
            format!("Goal {suffix} {turns}")
        }
    }
}

/// Handle to the live goal stream and its most recently applied snapshot.
pub struct GoalHandle {
    stream: JsonStream,
    latest: Option<Goal>,
}

impl GoalHandle {
    pub fn spawn(client: RpcClient, agent_id: String) -> Self {
        let stream =
            client.spawn_json_stream("/rpc/goal.streamGoal", json!({ "agentId": agent_id }));
        Self {
            stream,
            latest: None,
        }
    }

    /// Drain pending stream items. Returns true only when the goal state changed.
    pub fn refresh(&mut self) -> bool {
        let mut changed = false;
        while let Ok(item) = self.stream.try_recv() {
            match item {
                JsonStreamItem::Data { value, .. } => {
                    changed |= apply_snapshot(&mut self.latest, &value);
                }
                JsonStreamItem::Error(error) => {
                    // Goal status is best-effort — drain errors so the stream stays healthy.
                    drop(error);
                }
                JsonStreamItem::Ended => {}
            }
        }
        changed
    }

    pub fn get(&self) -> Option<Goal> {
        self.latest.clone()
    }
}

fn apply_snapshot(latest: &mut Option<Goal>, value: &Value) -> bool {
    let Some(goal) = parse_goal(value) else {
        return false;
    };
    if latest.as_ref() == Some(&goal) {
        return false;
    }
    *latest = Some(goal);
    true
}

/// Parse a `/rpc/goal.streamGoal` success result. `goal: null` means no goal is set.
fn parse_goal(value: &Value) -> Option<Goal> {
    if value.get("status").and_then(Value::as_str) != Some("success") {
        return None;
    }
    let goal = value.get("goal")?;
    if goal.is_null() {
        return None;
    }
    let status = goal
        .get("status")
        .and_then(Value::as_str)
        .map(GoalStatus::parse)
        .unwrap_or_default();
    let last_verdict = goal.get("lastVerdict").and_then(|verdict| {
        Some(GoalVerdict {
            status: verdict
                .get("status")
                .and_then(Value::as_str)
                .map(GoalVerdictStatus::parse)
                .unwrap_or_default(),
            reasoning: verdict.get("reasoning")?.as_str()?.to_string(),
            guidance: verdict
                .get("guidance")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    });
    Some(Goal {
        text: goal
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        status,
        attempts: goal.get("attempts").and_then(Value::as_u64).unwrap_or(0),
        max_turns: goal.get("maxTurns").and_then(Value::as_u64).unwrap_or(0),
        last_verdict,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_success() -> Value {
        json!({
            "status": "success",
            "goal": {
                "text": "Make all tests pass",
                "status": "active",
                "attempts": 3,
                "maxTurns": 25,
                "startedAt": 1,
                "endedAt": null,
                "lastVerdict": {
                    "status": "in_progress",
                    "reasoning": "2 tests still failing",
                    "guidance": "Fix the auth test"
                }
            }
        })
    }

    #[test]
    fn parses_successful_goal_snapshot() {
        let goal = parse_goal(&sample_success()).unwrap();
        assert_eq!(goal.text, "Make all tests pass");
        assert_eq!(goal.status, GoalStatus::Active);
        assert_eq!(goal.attempts, 3);
        assert_eq!(goal.max_turns, 25);
        let verdict = goal.last_verdict.clone().unwrap();
        assert_eq!(verdict.status, GoalVerdictStatus::InProgress);
        assert_eq!(verdict.guidance.as_deref(), Some("Fix the auth test"));
        assert_eq!(goal.status_segment(), "Goal 3/25");
    }

    #[test]
    fn status_segment_includes_suffix_for_terminal_states() {
        let mut goal = parse_goal(&sample_success()).unwrap();
        goal.status = GoalStatus::Blocked;
        assert_eq!(goal.status_segment(), "Goal blocked 3/25");

        goal.status = GoalStatus::Completed;
        assert_eq!(goal.status_segment(), "Goal done 3/25");
    }

    #[test]
    fn ignores_agent_not_found() {
        assert!(parse_goal(&json!({ "status": "agentNotFound" })).is_none());
    }

    #[test]
    fn ignores_null_goal() {
        assert!(parse_goal(&json!({ "status": "success", "goal": null })).is_none());
    }

    #[test]
    fn only_marks_changed_for_a_new_snapshot() {
        let mut latest = None;
        let first = sample_success();
        assert!(apply_snapshot(&mut latest, &first));
        assert!(!apply_snapshot(&mut latest, &first));

        let mut updated = first;
        updated["goal"]["status"] = json!("completed");
        assert!(apply_snapshot(&mut latest, &updated));
        assert_eq!(latest.as_ref().unwrap().status, GoalStatus::Completed);
    }
}
