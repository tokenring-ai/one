//! Live todo list received from the todo plugin stream.

use serde_json::{json, Value};

use crate::rpc::{JsonStream, JsonStreamItem, RpcClient};

/// Status of a single todo item.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum TodoStatus {
    #[default]
    Pending,
    InProgress,
    Completed,
    Unknown,
}

impl TodoStatus {
    fn parse(value: &str) -> Self {
        match value {
            "pending" => Self::Pending,
            "in_progress" => Self::InProgress,
            "completed" => Self::Completed,
            _ => Self::Unknown,
        }
    }

    /// Checkbox glyph for the sidebar list.
    pub fn marker(&self) -> &'static str {
        match self {
            Self::Pending => "[ ]",
            Self::InProgress => "[>]",
            Self::Completed => "[x]",
            Self::Unknown => "[?]",
        }
    }
}

/// A single todo item for the sidebar.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TodoItem {
    pub id: String,
    pub content: String,
    pub status: TodoStatus,
}

/// Latest todo snapshot for the agent.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Todos {
    pub items: Vec<TodoItem>,
}

impl Todos {
    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn completed_count(&self) -> usize {
        self.items
            .iter()
            .filter(|item| item.status == TodoStatus::Completed)
            .count()
    }
}

/// Handle to the live todos stream and its most recently applied snapshot.
pub struct TodosHandle {
    stream: JsonStream,
    latest: Option<Todos>,
}

impl TodosHandle {
    pub fn spawn(client: RpcClient, agent_id: String) -> Self {
        let stream =
            client.spawn_json_stream("/rpc/todo.streamTodos", json!({ "agentId": agent_id }));
        Self {
            stream,
            latest: None,
        }
    }

    /// Drain pending stream items. Returns true only when the todo list changed.
    pub fn refresh(&mut self) -> bool {
        let mut changed = false;
        while let Ok(item) = self.stream.try_recv() {
            match item {
                JsonStreamItem::Data { value, .. } => {
                    changed |= apply_snapshot(&mut self.latest, &value);
                }
                JsonStreamItem::Error(error) => {
                    // Todos are best-effort — drain errors so the stream stays healthy.
                    drop(error);
                }
                JsonStreamItem::Ended => {}
            }
        }
        changed
    }

    pub fn get(&self) -> Option<Todos> {
        self.latest.clone()
    }

    pub fn is_empty(&self) -> bool {
        self.latest.as_ref().is_none_or(Todos::is_empty)
    }
}

fn apply_snapshot(latest: &mut Option<Todos>, value: &Value) -> bool {
    let Some(todos) = parse_todos(value) else {
        return false;
    };
    if latest.as_ref() == Some(&todos) {
        return false;
    }
    *latest = Some(todos);
    true
}

/// Parse a `/rpc/todo.streamTodos` success result.
fn parse_todos(value: &Value) -> Option<Todos> {
    if value.get("status").and_then(Value::as_str) != Some("success") {
        return None;
    }
    let items = value
        .get("todos")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let id = item.get("id")?.as_str()?.to_string();
                    let content = item.get("content")?.as_str()?.to_string();
                    let status = TodoStatus::parse(item.get("status")?.as_str()?);
                    Some(TodoItem { id, content, status })
                })
                .collect()
        })
        .unwrap_or_default();
    Some(Todos { items })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_success() -> Value {
        json!({
            "status": "success",
            "todos": [
                { "id": "1", "content": "Explore code", "status": "completed" },
                { "id": "2", "content": "Add streamTodos RPC", "status": "in_progress" },
                { "id": "3", "content": "Wire CLI sidebar", "status": "pending" },
            ]
        })
    }

    #[test]
    fn parses_successful_todos_snapshot() {
        let todos = parse_todos(&sample_success()).unwrap();
        assert_eq!(todos.items.len(), 3);
        assert_eq!(todos.items[0].status, TodoStatus::Completed);
        assert_eq!(todos.items[1].status, TodoStatus::InProgress);
        assert_eq!(todos.items[2].status, TodoStatus::Pending);
        assert_eq!(todos.completed_count(), 1);
        assert_eq!(todos.items[1].status.marker(), "[>]");
    }

    #[test]
    fn ignores_agent_not_found() {
        assert!(parse_todos(&json!({ "status": "agentNotFound" })).is_none());
    }

    #[test]
    fn only_marks_changed_for_a_new_snapshot() {
        let mut latest = None;
        let first = sample_success();
        assert!(apply_snapshot(&mut latest, &first));
        assert!(!apply_snapshot(&mut latest, &first));

        let mut updated = first;
        updated["todos"][2]["status"] = json!("completed");
        assert!(apply_snapshot(&mut latest, &updated));
        assert_eq!(latest.as_ref().unwrap().completed_count(), 2);
    }

    #[test]
    fn empty_list_is_valid() {
        let todos = parse_todos(&json!({ "status": "success", "todos": [] })).unwrap();
        assert!(todos.is_empty());
    }
}
