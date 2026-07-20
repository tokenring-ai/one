//! Question/interaction models, ported from `pkg/agent/question.ts` and
//! `AgentEvents.ts` (`FollowupInteractionSchema` / `QuestionInteractionSchema`).
//!
//! All fields are parsed defensively from raw JSON so that unknown shapes never
//! break rendering.

#![allow(dead_code)] // Defensive parsing retains fields for API parity before use.

use serde_json::Value;

/// A tree node: either a value leaf or a branch with children.
#[derive(Clone, Debug, PartialEq)]
pub enum TreeLeaf {
    Value {
        name: String,
        value: String,
    },
    Branch {
        name: String,
        children: Vec<TreeLeaf>,
    },
}

impl TreeLeaf {
    pub fn name(&self) -> &str {
        match self {
            TreeLeaf::Value { name, .. } => name,
            TreeLeaf::Branch { name, .. } => name,
        }
    }
}

/// The four question kinds.
#[derive(Clone, Debug, PartialEq)]
pub enum Question {
    Text {
        label: String,
        description: Option<String>,
        required: bool,
        default_value: String,
        expected_lines: usize,
        masked: bool,
    },
    TreeSelect {
        label: String,
        description: Option<String>,
        minimum_selections: Option<usize>,
        maximum_selections: Option<usize>,
        default_value: Vec<String>,
        tree: Vec<TreeLeaf>,
    },
    FileSelect {
        label: String,
        description: Option<String>,
        allow_files: bool,
        allow_directories: bool,
        minimum_selections: Option<usize>,
        maximum_selections: Option<usize>,
        default_value: Vec<String>,
    },
    Form {
        sections: Vec<FormSection>,
    },
}

impl Question {
    pub fn label(&self) -> &str {
        match self {
            Question::Text { label, .. }
            | Question::TreeSelect { label, .. }
            | Question::FileSelect { label, .. } => label,
            Question::Form { .. } => "Form",
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct FormSection {
    pub name: String,
    pub description: Option<String>,
    pub fields: Vec<(String, Question)>, // primitive questions only
}

/// An interaction the agent is waiting on.
#[derive(Clone, Debug)]
pub enum Interaction {
    Followup {
        interaction_id: String,
        message: String,
    },
    Question {
        interaction_id: String,
        message: String,
        question: Question,
        optional: bool,
        auto_submit_at: Option<f64>,
    },
}

impl Interaction {
    pub fn interaction_id(&self) -> &str {
        match self {
            Interaction::Followup { interaction_id, .. } => interaction_id,
            Interaction::Question { interaction_id, .. } => interaction_id,
        }
    }

    /// Parse the `availableInteractions` array from an `input.execution` event.
    pub fn parse_all(value: &Value) -> Vec<Interaction> {
        value
            .get("availableInteractions")
            .and_then(Value::as_array)
            .map(|arr| arr.iter().filter_map(Interaction::from_value).collect())
            .unwrap_or_default()
    }

    fn from_value(value: &Value) -> Option<Interaction> {
        let ty = value.get("type").and_then(Value::as_str)?;
        let interaction_id = value
            .get("interactionId")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        match ty {
            "followup" => Some(Interaction::Followup {
                interaction_id,
                message: value
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
            }),
            "question" => Some(Interaction::Question {
                interaction_id,
                message: value
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                question: parse_question(value.get("question")?)?,
                optional: value
                    .get("optional")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
                auto_submit_at: value.get("autoSubmitAt").and_then(Value::as_f64),
            }),
            _ => None,
        }
    }
}

fn parse_question(value: &Value) -> Option<Question> {
    let ty = value.get("type").and_then(Value::as_str)?;
    let label = value
        .get("label")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let description = value
        .get("description")
        .and_then(Value::as_str)
        .map(String::from);
    match ty {
        "text" => Some(Question::Text {
            label,
            description,
            required: value
                .get("required")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            default_value: value
                .get("defaultValue")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string(),
            expected_lines: value
                .get("expectedLines")
                .and_then(Value::as_u64)
                .unwrap_or(1) as usize,
            masked: value
                .get("masked")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        }),
        "treeSelect" => Some(Question::TreeSelect {
            label,
            description,
            minimum_selections: value
                .get("minimumSelections")
                .and_then(Value::as_u64)
                .map(|n| n as usize),
            maximum_selections: value
                .get("maximumSelections")
                .and_then(Value::as_u64)
                .map(|n| n as usize),
            default_value: value
                .get("defaultValue")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default(),
            tree: value
                .get("tree")
                .and_then(Value::as_array)
                .map(|a| a.iter().filter_map(parse_tree_leaf).collect())
                .unwrap_or_default(),
        }),
        "fileSelect" => Some(Question::FileSelect {
            label,
            description,
            allow_files: value
                .get("allowFiles")
                .and_then(Value::as_bool)
                .unwrap_or(true),
            allow_directories: value
                .get("allowDirectories")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            minimum_selections: value
                .get("minimumSelections")
                .and_then(Value::as_u64)
                .map(|n| n as usize),
            maximum_selections: value
                .get("maximumSelections")
                .and_then(Value::as_u64)
                .map(|n| n as usize),
            default_value: value
                .get("defaultValue")
                .and_then(Value::as_array)
                .map(|a| {
                    a.iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect()
                })
                .unwrap_or_default(),
        }),
        "form" => Some(Question::Form {
            sections: value
                .get("sections")
                .and_then(Value::as_array)
                .map(|a| a.iter().filter_map(parse_form_section).collect())
                .unwrap_or_default(),
        }),
        _ => None,
    }
}

fn parse_tree_leaf(value: &Value) -> Option<TreeLeaf> {
    let name = value
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if let Some(children) = value.get("children").and_then(Value::as_array) {
        Some(TreeLeaf::Branch {
            name,
            children: children.iter().filter_map(parse_tree_leaf).collect(),
        })
    } else {
        Some(TreeLeaf::Value {
            name: name.clone(),
            value: value
                .get("value")
                .and_then(Value::as_str)
                .unwrap_or(&name)
                .to_string(),
        })
    }
}

fn parse_form_section(value: &Value) -> Option<FormSection> {
    Some(FormSection {
        name: value
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        description: value
            .get("description")
            .and_then(Value::as_str)
            .map(String::from),
        fields: value
            .get("fields")
            .and_then(Value::as_object)
            .map(|obj| {
                obj.iter()
                    .filter_map(|(key, v)| parse_question(v).map(|q| (key.clone(), q)))
                    .collect()
            })
            .unwrap_or_default(),
    })
}
