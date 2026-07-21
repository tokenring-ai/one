//! Multi-line text editor with emacs-style key bindings, ported from
//! `pkg/cli/raw/InputEditor.ts` plus the shared `renderEditor` /
//! `applyEditorKeypress` helpers from `InlineQuestions.ts`.
//!
//! The buffer is modelled as a `Vec<char>` with a char-index cursor, matching
//! the TypeScript implementation's semantics exactly.

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::tui::keybinds::Keybinds;
use crate::tui::text::visible_len;

/// Max undo snapshots retained per editor.
const MAX_UNDO: usize = 64;

#[derive(Clone)]
struct EditorSnapshot {
    chars: Vec<char>,
    cursor: usize,
}

/// A multi-line text buffer editor.
#[derive(Clone)]
pub struct InputEditor {
    chars: Vec<char>,
    cursor: usize,
    preferred_column: Option<usize>,
    undo_stack: Vec<EditorSnapshot>,
    redo_stack: Vec<EditorSnapshot>,
}

impl Default for InputEditor {
    fn default() -> Self {
        Self::new()
    }
}

impl InputEditor {
    pub fn new() -> Self {
        Self {
            chars: Vec::new(),
            cursor: 0,
            preferred_column: None,
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    pub fn from_text(initial: &str) -> Self {
        let mut editor = Self::new();
        editor.set_text(initial);
        editor
    }

    pub fn text(&self) -> String {
        self.chars.iter().collect()
    }

    pub fn cursor(&self) -> usize {
        self.cursor
    }

    pub fn is_empty(&self) -> bool {
        self.chars.is_empty()
    }

    fn snapshot(&self) -> EditorSnapshot {
        EditorSnapshot {
            chars: self.chars.clone(),
            cursor: self.cursor,
        }
    }

    fn restore(&mut self, snap: EditorSnapshot) {
        self.chars = snap.chars;
        self.cursor = snap.cursor.min(self.chars.len());
        self.preferred_column = None;
    }

    /// Push the current buffer onto the undo stack before a mutating edit.
    fn push_undo(&mut self) {
        self.undo_stack.push(self.snapshot());
        if self.undo_stack.len() > MAX_UNDO {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
    }

    pub fn undo(&mut self) -> bool {
        let Some(prev) = self.undo_stack.pop() else {
            return false;
        };
        self.redo_stack.push(self.snapshot());
        self.restore(prev);
        true
    }

    pub fn redo(&mut self) -> bool {
        let Some(next) = self.redo_stack.pop() else {
            return false;
        };
        self.undo_stack.push(self.snapshot());
        if self.undo_stack.len() > MAX_UNDO {
            self.undo_stack.remove(0);
        }
        self.restore(next);
        true
    }

    pub fn set_text(&mut self, value: &str) {
        self.set_text_with_cursor(value, value.chars().count())
    }

    pub fn set_text_with_cursor(&mut self, value: &str, cursor: usize) {
        // Programmatic set (history browse, paste helpers) replaces undo history.
        self.chars = value.chars().collect();
        let len = self.chars.len();
        self.cursor = cursor.clamp(0, len);
        self.preferred_column = None;
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    pub fn clear(&mut self) {
        if self.chars.is_empty() {
            return;
        }
        self.push_undo();
        self.chars.clear();
        self.cursor = 0;
        self.preferred_column = None;
    }

    pub fn insert(&mut self, text: &str) {
        if text.is_empty() {
            return;
        }
        self.push_undo();
        let inserted: Vec<char> = text.chars().collect();
        let tail: Vec<char> = self.chars.split_off(self.cursor);
        self.chars.extend(inserted);
        self.cursor = self.chars.len();
        self.chars.extend(tail);
        self.preferred_column = None;
    }

    pub fn insert_newline(&mut self) {
        self.insert("\n");
    }

    pub fn backspace(&mut self) {
        if self.cursor == 0 {
            return;
        }
        self.push_undo();
        self.chars.remove(self.cursor - 1);
        self.cursor -= 1;
        self.preferred_column = None;
    }

    pub fn delete_forward(&mut self) {
        if self.cursor >= self.chars.len() {
            return;
        }
        self.push_undo();
        self.chars.remove(self.cursor);
        self.preferred_column = None;
    }

    pub fn delete_word_backward(&mut self) {
        if self.cursor == 0 {
            return;
        }
        self.push_undo();
        let mut start = self.cursor;
        while start > 0 && self.chars[start - 1].is_whitespace() {
            start -= 1;
        }
        while start > 0 && !self.chars[start - 1].is_whitespace() {
            start -= 1;
        }
        self.drain_range(start, self.cursor);
        self.cursor = start;
        self.preferred_column = None;
    }

    pub fn delete_word_forward(&mut self) {
        let len = self.chars.len();
        if self.cursor >= len {
            return;
        }
        self.push_undo();
        let mut end = self.cursor;
        while end < len && self.chars[end].is_whitespace() {
            end += 1;
        }
        while end < len && !self.chars[end].is_whitespace() {
            end += 1;
        }
        self.drain_range(self.cursor, end);
        self.preferred_column = None;
    }

    /// Clear the contents of the current line (preserving the line break).
    pub fn delete_line(&mut self) {
        let location = self.cursor_location();
        if location.line_start == location.line_end {
            return;
        }
        self.push_undo();
        let location = self.cursor_location();
        self.drain_range(location.line_start, location.line_end);
        self.cursor = location.line_start;
        self.preferred_column = None;
    }

    pub fn delete_to_start_of_line(&mut self) {
        let location = self.cursor_location();
        if location.line_start == self.cursor {
            return;
        }
        self.push_undo();
        let location = self.cursor_location();
        self.drain_range(location.line_start, self.cursor);
        self.cursor = location.line_start;
        self.preferred_column = None;
    }

    pub fn delete_to_end_of_line(&mut self) {
        let location = self.cursor_location();
        if location.line_end == self.cursor {
            return;
        }
        self.push_undo();
        let location = self.cursor_location();
        self.drain_range(self.cursor, location.line_end);
        self.preferred_column = None;
    }

    pub fn move_left(&mut self) {
        if self.cursor > 0 {
            self.cursor -= 1;
            self.preferred_column = None;
        }
    }

    pub fn move_right(&mut self) {
        if self.cursor < self.chars.len() {
            self.cursor += 1;
            self.preferred_column = None;
        }
    }

    pub fn move_word_left(&mut self) {
        if self.cursor == 0 {
            return;
        }
        let mut next = self.cursor;
        while next > 0 && self.chars[next - 1].is_whitespace() {
            next -= 1;
        }
        while next > 0 && !self.chars[next - 1].is_whitespace() {
            next -= 1;
        }
        self.cursor = next;
        self.preferred_column = None;
    }

    pub fn move_word_right(&mut self) {
        let len = self.chars.len();
        if self.cursor >= len {
            return;
        }
        let mut next = self.cursor;
        while next < len && self.chars[next].is_whitespace() {
            next += 1;
        }
        while next < len && !self.chars[next].is_whitespace() {
            next += 1;
        }
        self.cursor = next;
        self.preferred_column = None;
    }

    pub fn move_home(&mut self) {
        self.cursor = self.cursor_location().line_start;
        self.preferred_column = None;
    }

    pub fn move_end(&mut self) {
        self.cursor = self.cursor_location().line_end;
        self.preferred_column = None;
    }

    /// Jump to the end of the whole buffer (all lines), unlike [`Self::move_end`]
    /// which only jumps to the end of the current line. Used for "select all"
    /// (there is no selection model, so this is the closest equivalent).
    pub fn move_to_end(&mut self) {
        self.cursor = self.chars.len();
        self.preferred_column = None;
    }

    pub fn move_up(&mut self) {
        let lines = self.line_ranges();
        let location = self.cursor_location();
        if location.line_index == 0 {
            return;
        }
        let preferred = self.preferred_column.unwrap_or(location.column);
        let target = &lines[location.line_index - 1];
        self.cursor = (target.start + preferred).clamp(target.start, target.end);
        self.preferred_column = Some(preferred);
    }

    pub fn move_down(&mut self) {
        let lines = self.line_ranges();
        let location = self.cursor_location();
        if location.line_index >= lines.len() - 1 {
            return;
        }
        let preferred = self.preferred_column.unwrap_or(location.column);
        let target = &lines[location.line_index + 1];
        self.cursor = (target.start + preferred).clamp(target.start, target.end);
        self.preferred_column = Some(preferred);
    }

    /// `{ line_index, column, line_start, line_end }` (port of `getCursorLocation`).
    pub fn cursor_location(&self) -> CursorLocation {
        let lines = self.line_ranges();
        let mut line_index = lines.len() - 1;
        for (i, line) in lines.iter().enumerate() {
            if self.cursor <= line.end || i == lines.len() - 1 {
                line_index = i;
                break;
            }
        }
        let line = &lines[line_index];
        CursorLocation {
            line_index,
            column: self.cursor - line.start,
            line_start: line.start,
            line_end: line.end,
        }
    }

    pub fn line_count(&self) -> usize {
        self.line_ranges().len()
    }

    fn line_ranges(&self) -> Vec<LineRange> {
        let mut ranges = Vec::new();
        let mut start = 0;
        for (i, ch) in self.chars.iter().enumerate() {
            if *ch == '\n' {
                ranges.push(LineRange { start, end: i });
                start = i + 1;
            }
        }
        ranges.push(LineRange {
            start,
            end: self.chars.len(),
        });
        ranges
    }

    fn drain_range(&mut self, start: usize, end: usize) {
        if start >= end {
            return;
        }
        self.chars.drain(start..end);
    }
}

#[derive(Clone, Copy, Debug)]
struct LineRange {
    start: usize,
    end: usize,
}

#[derive(Clone, Copy, Debug)]
pub struct CursorLocation {
    pub line_index: usize,
    pub column: usize,
    pub line_start: usize,
    pub line_end: usize,
}

/// The rendered view of an editor for display (port of `renderEditor`).
pub struct EditorView {
    pub lines: Vec<String>,
    pub cursor_row: usize,
    pub cursor_column: usize,
    pub is_empty: bool,
}

/// Render an editor into visible (wrapped, windowed) lines with cursor position.
pub fn render_editor(
    editor: &InputEditor,
    width: usize,
    max_content_lines: usize,
    masked: bool,
) -> EditorView {
    let width = width.max(4);
    let text = editor.text();
    let cursor = editor.cursor();
    let is_empty = text.is_empty();
    let source: String = if masked {
        "*".repeat(text.chars().count())
    } else {
        text
    };

    let mut lines: Vec<String> = vec![String::new()];
    let mut row = 0usize;
    let mut cursor_row = 0usize;
    let mut cursor_column = 0usize;

    for (index, ch) in source.chars().enumerate() {
        if index == cursor {
            cursor_row = row;
            cursor_column = visible_len(&lines[row]);
        }

        if ch == '\n' {
            row += 1;
            lines.push(String::new());
            continue;
        }

        lines[row].push(ch);
        if visible_len(&lines[row]) >= width {
            row += 1;
            lines.push(String::new());
        }
    }

    if cursor == source.chars().count() {
        cursor_row = row;
        cursor_column = visible_len(&lines[row]);
    }

    let visible_count = lines.len().clamp(1, max_content_lines.max(1));
    let window_start = (cursor_row + 1)
        .saturating_sub(visible_count)
        .min(lines.len().saturating_sub(visible_count));
    let visible_lines: Vec<String> = lines
        .iter()
        .skip(window_start)
        .take(visible_count)
        .cloned()
        .collect();

    EditorView {
        lines: visible_lines,
        cursor_row: cursor_row - window_start,
        cursor_column,
        is_empty,
    }
}

/// Apply a crossterm key event to an editor. Returns `true` if handled (port
/// of `applyEditorKeypress`). Vertical navigation returns `false` when at the
/// first/last line so the caller can fall back to history navigation.
///
/// All editing bindings are resolved against the [`Keybinds`] struct, so they
/// follow the configured keybind set.
pub fn apply_editor_keypress(editor: &mut InputEditor, key: KeyEvent, kb: &Keybinds) -> bool {
    if kb.input_undo.matches(key) {
        return editor.undo();
    }
    if kb.input_redo.matches(key) {
        return editor.redo();
    }
    if kb.input_clear.matches(key) {
        if editor.is_empty() {
            return false;
        }
        editor.clear();
        return true;
    }
    if kb.input_select_all.matches(key) {
        // No selection model: jump to buffer end so Super+A is not a dead key.
        editor.move_to_end();
        return true;
    }
    if kb.input_line_home.matches(key) {
        editor.move_home();
        return true;
    }
    if kb.input_line_end.matches(key) {
        editor.move_end();
        return true;
    }
    if kb.input_delete_to_line_start.matches(key) {
        editor.delete_to_start_of_line();
        return true;
    }
    if kb.input_delete_to_line_end.matches(key) {
        editor.delete_to_end_of_line();
        return true;
    }
    if kb.input_delete_line.matches(key) {
        editor.delete_line();
        return true;
    }
    if kb.input_delete_word_backward.matches(key) {
        editor.delete_word_backward();
        return true;
    }
    if kb.input_delete_word_forward.matches(key) {
        editor.delete_word_forward();
        return true;
    }
    if kb.input_delete.matches(key) {
        editor.delete_forward();
        return true;
    }
    if kb.input_backspace.matches(key) {
        editor.backspace();
        return true;
    }
    if kb.input_word_backward.matches(key) {
        editor.move_word_left();
        return true;
    }
    if kb.input_word_forward.matches(key) {
        editor.move_word_right();
        return true;
    }
    if kb.input_move_left.matches(key) {
        editor.move_left();
        return true;
    }
    if kb.input_move_right.matches(key) {
        editor.move_right();
        return true;
    }
    if kb.input_move_up.matches(key) {
        let line_index = editor.cursor_location().line_index;
        if line_index > 0 {
            editor.move_up();
            return true;
        }
        return false;
    }
    if kb.input_move_down.matches(key) {
        let line_index = editor.cursor_location().line_index;
        if line_index < editor.line_count() - 1 {
            editor.move_down();
            return true;
        }
        return false;
    }
    match key.code {
        KeyCode::Home => {
            editor.move_home();
            true
        }
        KeyCode::End => {
            editor.move_end();
            true
        }
        KeyCode::Char(c) => {
            let ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
            let alt = key.modifiers.contains(KeyModifiers::ALT);
            if ctrl || alt {
                return false;
            }
            let normalized = if c == '\r' { '\n' } else { c };
            editor.insert(&normalized.to_string());
            true
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_and_backspace() {
        let mut e = InputEditor::new();
        e.insert("hello");
        assert_eq!(e.text(), "hello");
        assert_eq!(e.cursor(), 5);
        e.backspace();
        assert_eq!(e.text(), "hell");
    }

    #[test]
    fn undo_redo_round_trip() {
        let mut e = InputEditor::new();
        e.insert("ab");
        e.insert("c");
        assert_eq!(e.text(), "abc");
        assert!(e.undo());
        assert_eq!(e.text(), "ab");
        assert!(e.undo());
        assert_eq!(e.text(), "");
        assert!(e.redo());
        assert_eq!(e.text(), "ab");
    }

    #[test]
    fn multiline_navigation() {
        let mut e = InputEditor::from_text("abc\ndef");
        e.set_text_with_cursor("abc\ndef", 7); // end
        e.move_up();
        let loc = e.cursor_location();
        assert_eq!(loc.line_index, 0);
        e.move_end();
        assert_eq!(e.cursor(), 3); // before newline
    }

    #[test]
    fn delete_word_backward_skips_whitespace() {
        let mut e = InputEditor::from_text("foo bar");
        // cursor at end
        e.delete_word_backward();
        assert_eq!(e.text(), "foo ");
    }

    #[test]
    fn render_wraps_and_tracks_cursor() {
        let mut e = InputEditor::from_text("abcdef");
        e.set_text_with_cursor("abcdef", 3);
        // Width 4 (the effective minimum) wraps greedily; cursor at index 3
        // lands on the first wrapped line at column 3.
        let view = render_editor(&e, 4, 8, false);
        assert_eq!(view.lines, vec!["abcd".to_string(), "ef".to_string()]);
        assert_eq!(view.cursor_row, 0);
        assert_eq!(view.cursor_column, 3);
    }

    #[test]
    fn masked_replaces_chars() {
        let e = InputEditor::from_text("secret");
        let view = render_editor(&e, 80, 8, true);
        assert_eq!(view.lines[0], "******");
    }
}
