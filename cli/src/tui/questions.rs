//! Inline question sessions (text / tree-select / file-select / form), ported
//! from `pkg/cli/raw/InlineQuestions.ts`. Each session renders its lines and
//! handles keys, returning an answer payload on submit.

use std::collections::HashSet;

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use serde_json::{json, Value};

use crate::models::questions::{FormSection, Question, TreeLeaf};
use crate::rpc::{self, RpcClient};
use crate::theme::{Theme, Tone};
use crate::tui::candy;
use crate::tui::editor::{apply_editor_keypress, render_editor, InputEditor};
use crate::tui::keybinds::Keybinds;
use crate::tui::text::{fit_line, wrap_plain_text};

/// The answer to a question (or cancellation).
pub enum QuestionAction {
    /// Submit this answer payload.
    Submit(Value),
    /// Cancel the question (sends `null`).
    Cancel,
}

// ---------------- Text ----------------

pub struct TextSession {
    question: Question,
    editor: InputEditor,
    flash: Option<String>,
}

impl TextSession {
    pub fn new(question: Question) -> Self {
        let default_value = match &question {
            Question::Text { default_value, .. } => default_value.clone(),
            _ => String::new(),
        };
        Self {
            question,
            editor: InputEditor::from_text(&default_value),
            flash: None,
        }
    }

    /// Insert pasted text into the editor.
    pub fn insert_text(&mut self, text: &str) {
        self.editor.insert(text);
    }

    pub fn render(&self, width: usize, theme: &Theme) -> Vec<(String, Tone)> {
        let Question::Text {
            label,
            description,
            required,
            expected_lines,
            masked,
            ..
        } = &self.question
        else {
            return Vec::new();
        };
        let text_indent = &theme.layout.text_indent;
        let mut lines = vec![(label.clone(), Tone::Ask)];
        if let Some(desc) = description {
            for l in wrap_plain_text(desc, width.saturating_sub(text_indent.len())) {
                lines.push((format!("{text_indent}{l}"), Tone::Muted));
            }
        }
        let inner_width = width.saturating_sub(3).max(10);
        let max_lines = (*expected_lines).clamp(1, 10);
        let view = render_editor(&self.editor, inner_width, max_lines, *masked);
        for (i, line) in view.lines.iter().enumerate() {
            if view.is_empty && i == 0 {
                let ph = if *required {
                    "Required response"
                } else {
                    "Optional response"
                };
                lines.push((format!(" → {ph}"), Tone::Muted));
            } else {
                let prefix = if i == 0 { " → " } else { "   " };
                lines.push((format!("{prefix}{line}"), Tone::Chat));
            }
        }
        if let Some(flash) = &self.flash {
            lines.push((flash.clone(), Tone::Error));
        }
        let hint = if *expected_lines > 1 {
            "Enter submit  Alt+Enter newline  Esc cancel"
        } else {
            "Enter submit  Esc cancel"
        };
        lines.push((hint.to_string(), Tone::Muted));
        lines
    }

    pub fn cursor(&self, width: usize) -> Option<(usize, usize)> {
        let Question::Text {
            expected_lines,
            masked,
            ..
        } = &self.question
        else {
            return None;
        };
        let inner_width = width.saturating_sub(3).max(10);
        let max_lines = (*expected_lines).clamp(1, 10);
        let view = render_editor(&self.editor, inner_width, max_lines, *masked);
        // row offset = lines before the editor block.
        let Question::Text { description, .. } = &self.question else {
            return None;
        };
        let header = 1 + description
            .as_ref()
            .map(|d| wrap_plain_text(d, width.saturating_sub(3)).len())
            .unwrap_or(0);
        if view.is_empty {
            // Placeholder line uses prefix " → " (3 columns).
            return Some((header, 3));
        }
        let row = header + view.cursor_row;
        let col = 3 + view.cursor_column;
        Some((row, col))
    }

    pub fn handle_key(&mut self, key: KeyEvent, kb: &Keybinds) -> Option<QuestionAction> {
        let Question::Text { required, .. } = &self.question else {
            return None;
        };
        let required = *required;
        match (key.modifiers, key.code) {
            (_, KeyCode::Esc) => Some(QuestionAction::Cancel),
            (m, KeyCode::Enter)
                if m.contains(KeyModifiers::ALT) || m.contains(KeyModifiers::CONTROL) =>
            {
                self.editor.insert_newline();
                self.flash = None;
                None
            }
            (_, KeyCode::Enter) => {
                let value = self.editor.text();
                let trimmed = value.trim();
                if required && trimmed.is_empty() {
                    self.flash = Some("A response is required.".to_string());
                    return None;
                }
                let answer = if trimmed.is_empty() {
                    Value::Null
                } else {
                    json!(value.trim_end())
                };
                Some(QuestionAction::Submit(answer))
            }
            _ => {
                if apply_editor_keypress(&mut self.editor, key, kb) {
                    self.flash = None;
                }
                None
            }
        }
    }
}

// ---------------- Tree ----------------

struct FlatItem {
    key: String,
    depth: usize,
    node: TreeLeaf,
    is_expanded: bool,
    descendant_leaf_count: usize,
    selected_leaf_count: usize,
}

pub struct TreeSession {
    question: Question,
    selected: usize,
    scroll: usize,
    expanded: HashSet<String>,
    checked: HashSet<String>,
    flash: Option<String>,
}

impl TreeSession {
    pub fn new(question: Question) -> Self {
        let (default_value, _) = match &question {
            Question::TreeSelect { default_value, .. } => (default_value.clone(), ()),
            _ => (Vec::new(), ()),
        };
        Self {
            question,
            selected: 0,
            scroll: 0,
            expanded: HashSet::new(),
            checked: default_value.into_iter().collect(),
            flash: None,
        }
    }

    fn tree(&self) -> &[TreeLeaf] {
        match &self.question {
            Question::TreeSelect { tree, .. } => tree,
            _ => &[],
        }
    }
    fn max_selections(&self) -> Option<usize> {
        match &self.question {
            Question::TreeSelect {
                maximum_selections, ..
            } => *maximum_selections,
            _ => None,
        }
    }
    fn min_selections(&self) -> Option<usize> {
        match &self.question {
            Question::TreeSelect {
                minimum_selections, ..
            } => *minimum_selections,
            _ => None,
        }
    }

    fn flat(&self) -> Vec<FlatItem> {
        let mut out = Vec::new();
        fn walk(
            node: &TreeLeaf,
            depth: usize,
            ancestry: &[String],
            sess: &TreeSession,
            out: &mut Vec<FlatItem>,
        ) {
            let key = match node {
                TreeLeaf::Value { value, .. } => value.clone(),
                TreeLeaf::Branch { name, .. } => {
                    let mut a = ancestry.to_vec();
                    a.push(name.clone());
                    a.join("/")
                }
            };
            let is_expanded = sess.expanded.contains(&key);
            let (desc, sel) = match node {
                TreeLeaf::Branch { children: _, .. } => {
                    (count_leaves(node), count_selected(node, &sess.checked))
                }
                _ => (0, 0),
            };
            out.push(FlatItem {
                key: key.clone(),
                depth,
                node: node.clone(),
                is_expanded,
                descendant_leaf_count: desc,
                selected_leaf_count: sel,
            });
            if let TreeLeaf::Branch { children, .. } = node {
                if sess.expanded.contains(&key) {
                    let mut child_ancestry = ancestry.to_vec();
                    if let TreeLeaf::Branch { name, .. } = node {
                        child_ancestry.push(name.clone());
                    }
                    for child in children {
                        walk(child, depth + 1, &child_ancestry, sess, out);
                    }
                }
            }
            let _ = is_expanded;
        }
        for node in self.tree() {
            walk(node, 0, &[], self, &mut out);
        }
        out
    }

    pub fn render(&self, width: usize, rows: usize, theme: &Theme) -> Vec<(String, Tone)> {
        let Question::TreeSelect {
            label, description, ..
        } = &self.question
        else {
            return Vec::new();
        };
        let text_indent = &theme.layout.text_indent;
        let mut lines = vec![(label.clone(), Tone::Ask)];
        if let Some(desc) = description {
            for l in wrap_plain_text(desc, width.saturating_sub(3)) {
                lines.push((format!("{text_indent}{l}"), Tone::Muted));
            }
        }
        let flat = self.flat();
        let max_visible = flat.len().max(4).min(rows.saturating_sub(8)).max(4);
        let flat_len = flat.len();
        let scroll = self.scroll_for(max_visible, flat_len);
        let multiple = self.max_selections() != Some(1);
        for (i, item) in flat.iter().enumerate().skip(scroll).take(max_visible) {
            let is_selected = i == self.selected;
            let is_checked =
                matches!(&item.node, TreeLeaf::Value { value, .. } if self.checked.contains(value));
            let glyph = match &item.node {
                TreeLeaf::Branch { .. } => {
                    if multiple {
                        if item.selected_leaf_count > 0 {
                            "◐"
                        } else {
                            "○"
                        }
                    } else if item.is_expanded {
                        "▾"
                    } else {
                        "▸"
                    }
                }
                TreeLeaf::Value { .. } => {
                    if is_checked {
                        "●"
                    } else {
                        "-"
                    }
                }
            };
            let pointer = if is_selected { "›" } else { " " };
            let indent = "  ".repeat(item.depth);
            let count = if multiple
                && matches!(item.node, TreeLeaf::Branch { .. })
                && item.descendant_leaf_count > 0
            {
                format!(
                    " ({}/{})",
                    item.selected_leaf_count, item.descendant_leaf_count
                )
            } else {
                String::new()
            };
            let avail = width.saturating_sub(indent.chars().count() + 8).max(10);
            let label_line = format!("{}{}", item.node.name(), count);
            let text = format!(
                " {pointer} {indent}{glyph} {}",
                fit_line(&label_line, avail)
            );
            let tone = if is_selected {
                Tone::Reasoning
            } else if is_checked {
                Tone::Chat
            } else if matches!(item.node, TreeLeaf::Branch { .. }) && item.selected_leaf_count > 0 {
                Tone::TreePartial
            } else {
                Tone::Muted
            };
            lines.push((text, tone));
        }
        if multiple {
            let min = self
                .min_selections()
                .map(|m| format!("  min {m}"))
                .unwrap_or_default();
            let max = self
                .max_selections()
                .map(|m| format!("  max {m}"))
                .unwrap_or_default();
            lines.push((
                format!("Selected {}{}{}", self.checked.len(), min, max),
                Tone::Ask,
            ));
        }
        if let Some(flash) = &self.flash {
            lines.push((flash.clone(), Tone::Error));
        }
        lines.push((
            "Up/Down move  Right/Left expand  Space toggle  Enter submit  Esc cancel".to_string(),
            Tone::Muted,
        ));
        lines
    }

    fn scroll_for(&self, max_visible: usize, flat_len: usize) -> usize {
        if flat_len == 0 {
            return 0;
        }
        let max_visible = max_visible.min(flat_len);
        if self.selected < self.scroll {
            self.selected
        } else if self.selected >= self.scroll + max_visible {
            self.selected + 1 - max_visible
        } else {
            self.scroll
        }
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> Option<QuestionAction> {
        let flat = self.flat();
        let current = flat.get(self.selected);
        let multiple = self.max_selections() != Some(1);
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => Some(QuestionAction::Cancel),
            KeyCode::Up => {
                self.selected = self.selected.saturating_sub(1);
                self.flash = None;
                None
            }
            KeyCode::Down => {
                self.selected = (self.selected + 1).min(flat.len().saturating_sub(1));
                self.flash = None;
                None
            }
            KeyCode::PageUp => {
                self.selected = self.selected.saturating_sub(8);
                self.flash = None;
                None
            }
            KeyCode::PageDown => {
                self.selected = (self.selected + 8).min(flat.len().saturating_sub(1));
                self.flash = None;
                None
            }
            KeyCode::Right => {
                if let Some(FlatItem {
                    key,
                    node: TreeLeaf::Branch { .. },
                    is_expanded: false,
                    ..
                }) = current
                {
                    self.expanded.insert(key.clone());
                    self.flash = None;
                }
                None
            }
            KeyCode::Left => {
                if let Some(FlatItem {
                    key,
                    node: TreeLeaf::Branch { .. },
                    is_expanded: true,
                    ..
                }) = current
                {
                    self.expanded.remove(key);
                    self.flash = None;
                }
                None
            }
            KeyCode::Char(' ') => {
                if let Some(item) = current {
                    if multiple {
                        self.toggle(&item.node);
                    } else if let TreeLeaf::Branch { .. } = &item.node {
                        if self.expanded.contains(&item.key) {
                            self.expanded.remove(&item.key);
                        } else {
                            self.expanded.insert(item.key.clone());
                        }
                    } else if let TreeLeaf::Value { value, .. } = &item.node {
                        return Some(QuestionAction::Submit(json!([value])));
                    }
                }
                None
            }
            KeyCode::Enter => {
                if multiple {
                    if let Some(min) = self.min_selections() {
                        if self.checked.len() < min {
                            self.flash = Some(format!(
                                "Select at least {min} item{}.",
                                if min == 1 { "" } else { "s" }
                            ));
                            return None;
                        }
                    }
                    let values: Vec<String> = self.checked.iter().cloned().collect();
                    return Some(QuestionAction::Submit(json!(values)));
                }
                if let Some(item) = current {
                    if let TreeLeaf::Branch { .. } = &item.node {
                        if self.expanded.contains(&item.key) {
                            self.expanded.remove(&item.key);
                        } else {
                            self.expanded.insert(item.key.clone());
                        }
                    } else if let TreeLeaf::Value { value, name, .. } = &item.node {
                        return Some(QuestionAction::Submit(json!([if value.is_empty() {
                            name.clone()
                        } else {
                            value.clone()
                        }])));
                    }
                }
                None
            }
            _ => None,
        }
    }

    fn descendant_values(node: &TreeLeaf) -> Vec<String> {
        match node {
            TreeLeaf::Value { value, .. } => vec![value.clone()],
            TreeLeaf::Branch { children, .. } => {
                children.iter().flat_map(Self::descendant_values).collect()
            }
        }
    }

    fn toggle(&mut self, node: &TreeLeaf) {
        let values = Self::descendant_values(node);
        let all_checked = values.iter().all(|v| self.checked.contains(v));
        if all_checked {
            if let Some(min) = self.min_selections() {
                let next = self.checked.len()
                    - values.iter().filter(|v| self.checked.contains(*v)).count();
                if next < min {
                    self.flash = Some(format!(
                        "At least {min} item{} must remain selected.",
                        if min == 1 { "" } else { "s" }
                    ));
                    return;
                }
            }
            for v in &values {
                self.checked.remove(v);
            }
            self.flash = None;
        } else {
            if let Some(max) = self.max_selections() {
                let next = self.checked.len()
                    + values.iter().filter(|v| !self.checked.contains(*v)).count();
                if next > max {
                    self.flash = Some(format!(
                        "Select at most {max} item{}.",
                        if max == 1 { "" } else { "s" }
                    ));
                    return;
                }
            }
            for v in &values {
                self.checked.insert(v.clone());
            }
            self.flash = None;
        }
    }
}

fn count_leaves(node: &TreeLeaf) -> usize {
    match node {
        TreeLeaf::Value { .. } => 1,
        TreeLeaf::Branch { children, .. } => children.iter().map(count_leaves).sum(),
    }
}
fn count_selected(node: &TreeLeaf, checked: &HashSet<String>) -> usize {
    match node {
        TreeLeaf::Value { value, .. } => checked.contains(value) as usize,
        TreeLeaf::Branch { children, .. } => {
            children.iter().map(|c| count_selected(c, checked)).sum()
        }
    }
}

// ---------------- File ----------------

struct FileNode {
    name: String,
    value: String,
    is_directory: bool,
    depth: usize,
    is_expanded: bool,
    loaded: bool,
    children: Vec<FileNode>,
}

pub struct FileSession {
    question: Question,
    provider: String,
    root: FileNode,
    selected: usize,
    checked: HashSet<String>,
    flash: Option<String>,
    initial_loading: bool,
}

impl FileSession {
    pub fn new(question: Question, provider: String, working_directory: String) -> Self {
        let checked = match &question {
            Question::FileSelect { default_value, .. } => default_value.iter().cloned().collect(),
            _ => HashSet::new(),
        };
        Self {
            question,
            provider,
            root: FileNode {
                name: working_directory.clone(),
                value: working_directory,
                is_directory: true,
                depth: 0,
                is_expanded: false,
                loaded: false,
                children: Vec::new(),
            },
            selected: 0,
            checked,
            flash: None,
            initial_loading: true,
        }
    }

    /// Load the root directory on first render. Called from the session loop.
    pub fn ensure_loaded(&mut self, client: &RpcClient) {
        if !self.initial_loading {
            return;
        }
        self.initial_loading = false;
        let provider = self.provider.clone();
        let allow_files = self.allow_files();
        if let Err(message) = Self::load_node(client, &provider, allow_files, &mut self.root) {
            self.flash = Some(message);
        }
    }

    fn load_node(
        client: &RpcClient,
        provider: &str,
        allow_files: bool,
        node: &mut FileNode,
    ) -> Result<(), String> {
        let entries = rpc::list_directory(client, provider, &node.value, false)
            .map_err(|error| format!("Could not load {}: {error}", node.value))?;
        let mut children: Vec<FileNode> = entries
            .into_iter()
            .filter(|e| e.is_directory || allow_files)
            .map(|e| FileNode {
                name: e.name.clone(),
                value: if node.value.ends_with('/') {
                    format!("{}{}", node.value, e.name)
                } else {
                    format!("{}/{}", node.value, e.name)
                },
                is_directory: e.is_directory,
                depth: node.depth + 1,
                is_expanded: false,
                loaded: false,
                children: Vec::new(),
            })
            .collect();
        children.sort_by_key(|c| !c.is_directory);
        node.children = children;
        node.loaded = true;
        Ok(())
    }

    fn allow_files(&self) -> bool {
        match &self.question {
            Question::FileSelect { allow_files, .. } => *allow_files,
            _ => true,
        }
    }
    fn allow_directories(&self) -> bool {
        match &self.question {
            Question::FileSelect {
                allow_directories, ..
            } => *allow_directories,
            _ => false,
        }
    }
    fn max_selections(&self) -> Option<usize> {
        match &self.question {
            Question::FileSelect {
                maximum_selections, ..
            } => *maximum_selections,
            _ => None,
        }
    }
    fn min_selections(&self) -> Option<usize> {
        match &self.question {
            Question::FileSelect {
                minimum_selections, ..
            } => *minimum_selections,
            _ => None,
        }
    }
    fn multiple(&self) -> bool {
        self.max_selections() != Some(1)
    }
    fn is_selectable(&self, node: &FileNode) -> bool {
        (node.is_directory && self.allow_directories())
            || (!node.is_directory && self.allow_files())
    }

    pub fn render(&self, width: usize, theme: &Theme) -> Vec<(String, Tone)> {
        let Question::FileSelect {
            label, description, ..
        } = &self.question
        else {
            return Vec::new();
        };
        let text_indent = &theme.layout.text_indent;
        let mut lines = vec![(label.clone(), Tone::Ask)];
        if let Some(desc) = description {
            for l in wrap_plain_text(desc, width.saturating_sub(3)) {
                lines.push((format!("{text_indent}{l}"), Tone::Muted));
            }
        }
        if self.initial_loading {
            lines.push(("Loading directory...".to_string(), Tone::Ask));
            return lines;
        }
        let flat = self.flatten(&self.root);
        if flat.is_empty() {
            lines.push(("Current directory is empty.".to_string(), Tone::Muted));
        } else {
            let multiple = self.multiple();
            for (i, (depth, node)) in flat.iter().enumerate() {
                let is_selected = i == self.selected;
                let is_checked = self.checked.contains(&node.value);
                let pointer = if is_selected { "›" } else { " " };
                let indent = "  ".repeat(*depth);
                let branch = if node.is_directory {
                    if node.is_expanded {
                        "▾"
                    } else {
                        "▸"
                    }
                } else {
                    " "
                };
                let toggle = if multiple {
                    if self.is_selectable(node) {
                        if is_checked {
                            "◉ "
                        } else {
                            "◯ "
                        }
                    } else {
                        "  "
                    }
                } else {
                    ""
                };
                let avail = width.saturating_sub(indent.chars().count() + 8).max(10);
                let text = format!(
                    " {pointer} {indent}{branch} {toggle}{}",
                    fit_line(&node.name, avail)
                );
                let tone = if is_selected {
                    Tone::Reasoning
                } else if is_checked {
                    Tone::Chat
                } else {
                    Tone::Muted
                };
                lines.push((text, tone));
            }
        }
        if let Some(flash) = &self.flash {
            lines.push((flash.clone(), Tone::Error));
        }
        lines
    }

    fn flatten<'a>(&self, node: &'a FileNode) -> Vec<(usize, &'a FileNode)> {
        let mut out = Vec::new();
        fn walk<'a>(node: &'a FileNode, out: &mut Vec<(usize, &'a FileNode)>) {
            for child in &node.children {
                out.push((child.depth, child));
                if child.is_directory && child.is_expanded {
                    walk(child, out);
                }
            }
        }
        walk(node, &mut out);
        out
    }

    pub fn handle_key(&mut self, key: KeyEvent, client: &RpcClient) -> Option<QuestionAction> {
        if self.initial_loading {
            return None;
        }
        match key.code {
            KeyCode::Esc | KeyCode::Char('q') => Some(QuestionAction::Cancel),
            KeyCode::Up => {
                self.selected = self.selected.saturating_sub(1);
                self.flash = None;
                None
            }
            KeyCode::Down => {
                let n = self.flatten(&self.root).len();
                if n > 0 {
                    self.selected = (self.selected + 1).min(n - 1);
                }
                self.flash = None;
                None
            }
            KeyCode::PageUp => {
                self.selected = self.selected.saturating_sub(8);
                self.flash = None;
                None
            }
            KeyCode::Right | KeyCode::Char(' ') => {
                self.flash = None;
                enum Act {
                    Expand(String),
                    ToggleSel(String),
                    Collapse(String),
                    None,
                }
                let act = {
                    let flat = self.flatten(&self.root);
                    match flat.get(self.selected) {
                        Some((_, node)) if node.is_directory && !node.is_expanded => {
                            Act::Expand(node.value.clone())
                        }
                        Some((_, node))
                            if self.multiple()
                                && self.is_selectable_by(node.value.clone(), node.is_directory) =>
                        {
                            Act::ToggleSel(node.value.clone())
                        }
                        Some((_, node)) if node.is_directory && node.is_expanded => {
                            Act::Collapse(node.value.clone())
                        }
                        _ => Act::None,
                    }
                };
                match act {
                    Act::Expand(v) => self.toggle_expand(client, &v),
                    Act::ToggleSel(v) => self.toggle_selection(v),
                    Act::Collapse(v) => self.set_expanded(&v, false),
                    Act::None => {}
                }
                None
            }
            KeyCode::Left => {
                let target = {
                    let flat = self.flatten(&self.root);
                    flat.get(self.selected).and_then(|(_, node)| {
                        if node.is_directory && node.is_expanded {
                            Some(node.value.clone())
                        } else {
                            None
                        }
                    })
                };
                if let Some(value) = target {
                    self.set_expanded(&value, false);
                }
                self.flash = None;
                None
            }
            KeyCode::Enter => {
                if self.multiple() {
                    if let Some(min) = self.min_selections() {
                        if self.checked.len() < min {
                            self.flash = Some(format!(
                                "Select at least {min} item{}.",
                                if min == 1 { "" } else { "s" }
                            ));
                            return None;
                        }
                    }
                    let values: Vec<String> = self.checked.iter().cloned().collect();
                    return Some(QuestionAction::Submit(json!(values)));
                }
                let flat = self.flatten(&self.root);
                if let Some((_, node)) = flat.get(self.selected) {
                    if self.is_selectable(node) {
                        return Some(QuestionAction::Submit(json!([node.value])));
                    }
                }
                None
            }
            _ => None,
        }
    }

    fn is_selectable_by(&self, _value: String, is_dir: bool) -> bool {
        (is_dir && self.allow_directories()) || (!is_dir && self.allow_files())
    }

    fn toggle_selection(&mut self, value: String) {
        if self.checked.contains(&value) {
            self.checked.remove(&value);
        } else if self
            .max_selections()
            .is_some_and(|max| self.checked.len() >= max)
        {
            let max = self.max_selections().unwrap_or(0);
            self.flash = Some(format!(
                "Select at most {max} item{}.",
                if max == 1 { "" } else { "s" }
            ));
        } else {
            self.checked.insert(value);
        }
    }

    fn set_expanded(&mut self, value: &str, expanded: bool) {
        Self::set_expanded_node(&mut self.root, value, expanded);
    }
    fn set_expanded_node(node: &mut FileNode, value: &str, expanded: bool) {
        if node.value == value {
            node.is_expanded = expanded;
            return;
        }
        for child in &mut node.children {
            Self::set_expanded_node(child, value, expanded);
        }
    }

    fn toggle_expand(&mut self, client: &RpcClient, value: &str) {
        let provider = self.provider.clone();
        let allow_files = self.allow_files();
        if let Some(message) =
            Self::toggle_expand_node(client, &provider, allow_files, &mut self.root, value)
        {
            self.flash = Some(message);
        }
    }
    fn toggle_expand_node(
        client: &RpcClient,
        provider: &str,
        allow_files: bool,
        node: &mut FileNode,
        value: &str,
    ) -> Option<String> {
        if node.value == value && node.is_directory {
            node.is_expanded = !node.is_expanded;
            if node.is_expanded && !node.loaded {
                if let Err(message) = Self::load_node(client, provider, allow_files, node) {
                    return Some(message);
                }
            }
            return None;
        }
        for child in &mut node.children {
            if let Some(message) =
                Self::toggle_expand_node(client, provider, allow_files, child, value)
            {
                return Some(message);
            }
        }
        None
    }
}

// ---------------- Form ----------------

/// A sub-session for non-text form fields (tree-select / file-select).
enum FormSubSession {
    Tree(TreeSession),
    File(FileSession),
}

pub struct FormSession {
    sections: Vec<FormSection>,
    section_index: usize,
    field_index: usize,
    values: Vec<Vec<Value>>,
    editors: Vec<Vec<InputEditor>>,
    current_sub: Option<FormSubSession>,
    provider: String,
    working_directory: String,
    flash: Option<String>,
}

impl FormSession {
    pub fn new(question: Question, provider: String, working_directory: String) -> Self {
        let sections = match question {
            Question::Form { sections } => sections,
            _ => Vec::new(),
        };
        let editors = sections
            .iter()
            .map(|s| {
                s.fields
                    .iter()
                    .map(|(_, q)| match q {
                        Question::Text { default_value, .. } => {
                            InputEditor::from_text(default_value)
                        }
                        _ => InputEditor::new(),
                    })
                    .collect()
            })
            .collect();
        let values = sections
            .iter()
            .map(|s| vec![Value::Null; s.fields.len()])
            .collect();
        let mut session = Self {
            sections,
            section_index: 0,
            field_index: 0,
            values,
            editors,
            current_sub: None,
            provider,
            working_directory,
            flash: None,
        };
        session.refresh_sub_session();
        session
    }

    /// Insert pasted text into the current field's editor.
    pub fn insert_text(&mut self, text: &str) {
        if let Some(editor) = self
            .editors
            .get_mut(self.section_index)
            .and_then(|row| row.get_mut(self.field_index))
        {
            editor.insert(text);
        }
    }

    fn current(&self) -> Option<(&FormSection, &(String, Question), usize, usize)> {
        let section = self.sections.get(self.section_index)?;
        let field = section.fields.get(self.field_index)?;
        Some((section, field, self.section_index + 1, self.field_index + 1))
    }

    /// Create the appropriate sub-session when the current field is tree/file.
    fn refresh_sub_session(&mut self) {
        let Some((_, (_, question), _, _)) = self.current() else {
            self.current_sub = None;
            return;
        };
        match question {
            Question::TreeSelect { .. } => {
                self.current_sub = Some(FormSubSession::Tree(TreeSession::new(question.clone())));
            }
            Question::FileSelect { .. } => {
                self.current_sub = Some(FormSubSession::File(FileSession::new(
                    question.clone(),
                    self.provider.clone(),
                    self.working_directory.clone(),
                )));
            }
            _ => {
                self.current_sub = None;
            }
        }
    }

    pub fn render(&self, width: usize, rows: usize, theme: &Theme) -> Vec<(String, Tone)> {
        let mut lines = Vec::new();
        let Some((section, (key, question), s_no, f_no)) = self.current() else {
            return lines;
        };
        let text_indent = &theme.layout.text_indent;
        lines.push((
            candy::form_step_indicator(s_no, self.sections.len(), f_no, section.fields.len()),
            Tone::Ask,
        ));
        if let Some(desc) = &section.description {
            for l in wrap_plain_text(desc, width.saturating_sub(3)) {
                lines.push((format!("{text_indent}{l}"), Tone::Muted));
            }
        }
        lines.push((format!("{} · {}", section.name, key), Tone::Info));

        // Delegate to sub-session for tree/file fields.
        if let Some(sub) = &self.current_sub {
            match sub {
                FormSubSession::Tree(s) => lines.extend(s.render(width, rows, theme)),
                FormSubSession::File(s) => lines.extend(s.render(width, theme)),
            }
            return lines;
        }

        // Text field.
        if let Question::Text { label, .. } = question {
            lines.push((format!(" {label}"), Tone::Chat));
        }
        let editor = &self.editors[self.section_index][self.field_index];
        let view = render_editor(editor, width.saturating_sub(3).max(10), 4, false);
        for (i, line) in view.lines.iter().enumerate() {
            let prefix = if i == 0 { " → " } else { "   " };
            lines.push((format!("{prefix}{line}"), Tone::Chat));
        }
        if let Some(flash) = &self.flash {
            lines.push((flash.clone(), Tone::Error));
        }
        lines.push((
            "Enter next  Alt+Enter newline  Esc cancel".to_string(),
            Tone::Muted,
        ));
        lines
    }

    pub fn cursor(&self, width: usize) -> Option<(usize, usize)> {
        if self.current_sub.is_some() {
            return None;
        }
        let editor = &self.editors[self.section_index].get(self.field_index)?;
        let view = render_editor(editor, width.saturating_sub(3).max(10), 4, false);
        let row = 4;
        let col = 3 + view.cursor_column;
        Some((row + view.cursor_row, col))
    }

    pub fn handle_key(
        &mut self,
        key: KeyEvent,
        client: &RpcClient,
        kb: &Keybinds,
    ) -> Option<QuestionAction> {
        // Delegate to sub-session for tree/file fields.
        if let Some(sub) = &mut self.current_sub {
            let action = match sub {
                FormSubSession::Tree(s) => s.handle_key(key),
                FormSubSession::File(s) => {
                    s.ensure_loaded(client);
                    s.handle_key(key, client)
                }
            };
            return match action {
                Some(QuestionAction::Submit(val)) => {
                    self.values[self.section_index][self.field_index] = val;
                    self.advance()
                }
                Some(QuestionAction::Cancel) => Some(QuestionAction::Cancel),
                None => None,
            }
        }

        // Text field.
        match key.code {
            KeyCode::Esc => Some(QuestionAction::Cancel),
            KeyCode::Enter => {
                let editor = &mut self.editors[self.section_index][self.field_index];
                let val = editor.text().trim_end().to_string();
                self.values[self.section_index][self.field_index] = json!(val);
                self.advance()
            }
            _ => {
                let editor = &mut self.editors[self.section_index][self.field_index];
                apply_editor_keypress(editor, key, kb);
                self.flash = None;
                None
            }
        }
    }

    fn advance(&mut self) -> Option<QuestionAction> {
        let section = match self.sections.get(self.section_index) {
            Some(s) => s,
            None => return Some(QuestionAction::Cancel),
        };
        if self.field_index + 1 < section.fields.len() {
            self.field_index += 1;
            self.refresh_sub_session();
            return None;
        }
        self.field_index = 0;
        if self.section_index + 1 < self.sections.len() {
            self.section_index += 1;
            self.refresh_sub_session();
            return None;
        }
        let mut result = serde_json::Map::new();
        for (s_i, section) in self.sections.iter().enumerate() {
            let mut sec = serde_json::Map::new();
            for (f_i, (key, _)) in section.fields.iter().enumerate() {
                sec.insert(key.clone(), self.values[s_i][f_i].clone());
            }
            result.insert(section.name.clone(), Value::Object(sec));
        }
        Some(QuestionAction::Submit(Value::Object(result)))
    }
}

// ---------------- Confirmation (yes/no treeSelect) ----------------

#[derive(Clone, Copy, PartialEq, Eq)]
enum ConfirmChoice {
    Yes,
    No,
}

/// Whether a tree-select question is a binary approval prompt (`askForApproval`).
pub fn is_confirmation_question(question: &Question) -> bool {
    let Question::TreeSelect {
        tree,
        minimum_selections,
        maximum_selections,
        ..
    } = question
    else {
        return false;
    };
    if minimum_selections.unwrap_or(1) != 1 || maximum_selections.unwrap_or(1) != 1 {
        return false;
    }
    let options = confirmation_options(tree);
    options.len() == 2
}

fn confirmation_options(tree: &[TreeLeaf]) -> Vec<(String, String)> {
    tree.iter()
        .filter_map(|leaf| match leaf {
            TreeLeaf::Value { name, value } => Some((name.clone(), value.clone())),
            TreeLeaf::Branch { children, .. } => children.iter().find_map(|child| match child {
                TreeLeaf::Value { name, value } => Some((name.clone(), value.clone())),
                TreeLeaf::Branch { .. } => None,
            }),
        })
        .collect()
}

pub struct ConfirmSession {
    question: Question,
    options: Vec<(String, String)>,
    selected: ConfirmChoice,
}

impl ConfirmSession {
    pub fn new(question: Question) -> Self {
        let options = match &question {
            Question::TreeSelect { tree, .. } => confirmation_options(tree),
            _ => Vec::new(),
        };
        Self {
            question,
            options,
            selected: ConfirmChoice::Yes,
        }
    }

    pub fn render(&self, width: usize, theme: &Theme) -> Vec<(String, Tone)> {
        let Question::TreeSelect {
            label, description, ..
        } = &self.question
        else {
            return Vec::new();
        };
        let text_indent = &theme.layout.text_indent;
        let mut lines = vec![(label.clone(), Tone::Ask)];
        if let Some(desc) = description {
            for l in wrap_plain_text(desc, width.saturating_sub(text_indent.len())) {
                lines.push((format!("{text_indent}{l}"), Tone::Muted));
            }
        }
        let (yes_label, no_label) = match (
            &self.options[0].0,
            self.options.get(1).map(|o| o.0.as_str()),
        ) {
            (yes, Some(no)) => (yes.as_str(), no),
            _ => ("Yes", "No"),
        };
        let yes_marker = if self.selected == ConfirmChoice::Yes {
            "›"
        } else {
            " "
        };
        let no_marker = if self.selected == ConfirmChoice::No {
            "›"
        } else {
            " "
        };
        lines.push((
            format!("{yes_marker} {yes_label}"),
            if self.selected == ConfirmChoice::Yes {
                Tone::Success
            } else {
                Tone::Muted
            },
        ));
        lines.push((
            format!("{no_marker} {no_label}"),
            if self.selected == ConfirmChoice::No {
                Tone::Error
            } else {
                Tone::Muted
            },
        ));
        lines.push((
            "Enter confirm  Left/Right or Up/Down toggle  Esc cancel".to_string(),
            Tone::Muted,
        ));
        let _ = theme.confirmation;
        lines
    }

    pub fn handle_key(&mut self, key: KeyEvent) -> Option<QuestionAction> {
        match (key.modifiers, key.code) {
            (_, KeyCode::Esc) => Some(QuestionAction::Cancel),
            (_, KeyCode::Left) | (_, KeyCode::Up) => {
                self.selected = ConfirmChoice::Yes;
                None
            }
            (_, KeyCode::Right) | (_, KeyCode::Down) => {
                self.selected = ConfirmChoice::No;
                None
            }
            (_, KeyCode::Char('y') | KeyCode::Char('Y')) => {
                self.selected = ConfirmChoice::Yes;
                self.submit()
            }
            (_, KeyCode::Char('n') | KeyCode::Char('N')) => {
                self.selected = ConfirmChoice::No;
                self.submit()
            }
            (_, KeyCode::Enter) => self.submit(),
            _ => None,
        }
    }

    fn submit(&self) -> Option<QuestionAction> {
        let index = match self.selected {
            ConfirmChoice::Yes => 0,
            ConfirmChoice::No => 1,
        };
        let value = self
            .options
            .get(index)
            .map(|(_, value)| value.clone())
            .unwrap_or_else(|| {
                if self.selected == ConfirmChoice::Yes {
                    "Approved".to_string()
                } else {
                    "Not approved".to_string()
                }
            });
        Some(QuestionAction::Submit(json!([value])))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_question(
        allow_files: bool,
        allow_directories: bool,
        maximum_selections: Option<usize>,
        default_value: Vec<String>,
    ) -> Question {
        Question::FileSelect {
            label: "Pick files".to_string(),
            description: None,
            allow_files,
            allow_directories,
            minimum_selections: None,
            maximum_selections,
            default_value,
        }
    }

    #[test]
    fn file_session_applies_default_values() {
        let session = FileSession::new(
            file_question(true, false, None, vec!["/repo/README.md".to_string()]),
            "posix".to_string(),
            "/repo".to_string(),
        );

        assert!(session.checked.contains("/repo/README.md"));
    }

    #[test]
    fn file_session_enforces_maximum_selection_count() {
        let mut session = FileSession::new(
            file_question(true, false, Some(1), Vec::new()),
            "posix".to_string(),
            "/repo".to_string(),
        );

        session.toggle_selection("/repo/a.rs".to_string());
        session.toggle_selection("/repo/b.rs".to_string());

        assert!(session.checked.contains("/repo/a.rs"));
        assert!(!session.checked.contains("/repo/b.rs"));
        assert!(session.flash.is_some());
    }

    #[test]
    fn file_session_respects_file_and_directory_allow_flags() {
        let files_only = FileSession::new(
            file_question(true, false, None, Vec::new()),
            "posix".to_string(),
            "/repo".to_string(),
        );
        let dirs_only = FileSession::new(
            file_question(false, true, None, Vec::new()),
            "posix".to_string(),
            "/repo".to_string(),
        );
        let file = FileNode {
            name: "main.rs".to_string(),
            value: "/repo/main.rs".to_string(),
            is_directory: false,
            depth: 1,
            is_expanded: false,
            loaded: false,
            children: Vec::new(),
        };
        let dir = FileNode {
            name: "src".to_string(),
            value: "/repo/src".to_string(),
            is_directory: true,
            depth: 1,
            is_expanded: false,
            loaded: false,
            children: Vec::new(),
        };

        assert!(files_only.is_selectable(&file));
        assert!(!files_only.is_selectable(&dir));
        assert!(!dirs_only.is_selectable(&file));
        assert!(dirs_only.is_selectable(&dir));
    }
}
