//! Last-frame UI regions for mouse hit-testing (nice-to-have #6).

use crossterm::event::{MouseEvent, MouseEventKind};
use ratatui::layout::Rect;

/// Selectable rows inside a picker panel.
#[derive(Clone, Copy, Debug)]
pub struct PickerHitRegion {
    pub area: Rect,
    pub window_start: usize,
    pub row_count: usize,
    /// Lines above the first selectable row inside `area`.
    pub header_rows: u16,
}

impl PickerHitRegion {
    pub fn row_index_at(&self, column: u16, row: u16) -> Option<usize> {
        if self.row_count == 0 || !contains(self.area, column, row) {
            return None;
        }
        let rel_y = row.saturating_sub(self.area.y);
        if rel_y < self.header_rows {
            return None;
        }
        let item_row = (rel_y - self.header_rows) as usize;
        if item_row >= self.row_count {
            return None;
        }
        Some(self.window_start + item_row)
    }
}

/// Regions recorded during the most recent `draw` pass.
#[derive(Clone, Copy, Debug, Default)]
pub struct UiHitRegions {
    pub transcript: Rect,
    pub composer: Rect,
    pub followup_composer: Option<Rect>,
    pub filesearch: Option<PickerHitRegion>,
    pub completion: Option<PickerHitRegion>,
    pub optional_picker: Option<PickerHitRegion>,
}

/// Resolved mouse action for the chat session to apply.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MouseAction {
    Scroll(i32),
    FocusComposer,
    SelectFilesearch(usize),
    SelectCompletion(usize),
    SelectOptional(usize),
}

fn contains(area: Rect, column: u16, row: u16) -> bool {
    column >= area.x
        && column < area.x.saturating_add(area.width)
        && row >= area.y
        && row < area.y.saturating_add(area.height)
}

impl UiHitRegions {
    /// Resolve a mouse event against the last recorded layout.
    pub fn mouse_action(
        &self,
        event: MouseEvent,
        help_open: bool,
        can_scroll_transcript: bool,
    ) -> Option<MouseAction> {
        if help_open {
            return None;
        }

        let column = event.column;
        let row = event.row;

        match event.kind {
            MouseEventKind::ScrollUp
                if can_scroll_transcript && contains(self.transcript, column, row) =>
            {
                Some(MouseAction::Scroll(3))
            }
            MouseEventKind::ScrollDown
                if can_scroll_transcript && contains(self.transcript, column, row) =>
            {
                Some(MouseAction::Scroll(-3))
            }
            MouseEventKind::Down(_) => {
                if let Some(region) = self.filesearch {
                    if let Some(idx) = region.row_index_at(column, row) {
                        return Some(MouseAction::SelectFilesearch(idx));
                    }
                }
                if let Some(region) = self.completion {
                    if let Some(idx) = region.row_index_at(column, row) {
                        return Some(MouseAction::SelectCompletion(idx));
                    }
                }
                if let Some(region) = self.optional_picker {
                    if let Some(idx) = region.row_index_at(column, row) {
                        return Some(MouseAction::SelectOptional(idx));
                    }
                }
                if contains(self.composer, column, row) {
                    return Some(MouseAction::FocusComposer);
                }
                if let Some(followup) = self.followup_composer {
                    if contains(followup, column, row) {
                        return Some(MouseAction::FocusComposer);
                    }
                }
                None
            }
            _ => None,
        }
    }
}
