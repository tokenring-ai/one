//! Slash-command autocomplete, ported from `CommandCompletions.ts` and the
//! completion state machine in `RawChatUI` (`syncChatCommandCompletionState`,
//! `insertSelectedCommandCompletion`, …).
//!
//! Matching uses fuzzy/substring scoring (nice-to-have #9), reusing the file
//! search scorer on command names.

/// A matched command (name + description) for the completion picker.
#[derive(Clone, Debug, PartialEq)]
pub struct CommandMatch {
    pub name: String,
    pub description: String,
}

/// A computed completion context for the current editor state.
#[derive(Clone, Debug)]
pub struct CompletionContext {
    pub query: String,
    pub matches: Vec<CommandMatch>,
    pub replacement_start: usize,
    pub replacement_end: usize,
}

/// The live completion picker state.
#[derive(Clone, Debug)]
pub struct CompletionState {
    pub source_query: String,
    pub matches: Vec<CommandMatch>,
    pub selected_index: usize,
    pub replacement_start: usize,
    pub replacement_end: usize,
}

impl CompletionState {
    /// A signature used to keep a dismissed picker closed until the query
    /// changes (port of `getCommandCompletionSignature`).
    pub fn signature(&self) -> String {
        format!(
            "{}:{}:{}:{}",
            self.replacement_start,
            self.replacement_end,
            self.source_query,
            self.matches
                .iter()
                .map(|m| m.name.as_str())
                .collect::<Vec<_>>()
                .join(","),
        )
    }
}

/// Compute a completion context from editor text + cursor (char index) and the
/// available commands. Returns `None` when completions don't apply.
pub fn get_command_completion_context(
    text: &str,
    cursor: usize,
    commands: &[CommandMatch],
) -> Option<CompletionContext> {
    let chars: Vec<char> = text.chars().collect();
    let cursor = cursor.min(chars.len());

    // Active only on the first line, when it starts with '/'.
    let line_start = chars[..cursor]
        .iter()
        .rposition(|&c| c == '\n')
        .map(|i| i + 1)
        .unwrap_or(0);
    if line_start != 0 {
        return None;
    }
    if chars.first() != Some(&'/') {
        return None;
    }

    let query: String = chars[1..cursor].iter().collect();
    let matches = fuzzy_command_matches(commands, &query);
    if matches.is_empty() {
        return None;
    }

    Some(CompletionContext {
        query,
        matches,
        replacement_start: line_start,
        replacement_end: cursor,
    })
}

/// Longest shared prefix among command names (port of `getLongestCommonPrefix`).
pub fn longest_common_prefix(values: &[&str]) -> String {
    if values.is_empty() {
        return String::new();
    }
    let first: Vec<char> = values[0].chars().collect();
    let mut prefix_len = first.len();
    for value in values.iter().skip(1) {
        let chars: Vec<char> = value.chars().collect();
        let mut shared = 0;
        while shared < prefix_len && shared < chars.len() && first[shared] == chars[shared] {
            shared += 1;
        }
        prefix_len = shared;
        if prefix_len == 0 {
            break;
        }
    }
    first[..prefix_len].iter().collect()
}

/// Fuzzy/substring command matches scored like `@` file search (nice-to-have #9).
pub fn fuzzy_command_matches(commands: &[CommandMatch], query: &str) -> Vec<CommandMatch> {
    use crate::tui::filesearch;
    let normalized = query.trim();
    if normalized.is_empty() {
        return commands.to_vec();
    }
    let mut scored: Vec<(i64, &CommandMatch)> = commands
        .iter()
        .map(|cmd| {
            (
                filesearch::score_file_search_match(&cmd.name, normalized),
                cmd,
            )
        })
        .filter(|(score, _)| *score != i64::MIN)
        .collect();
    scored.sort_by(|(sa, a), (sb, b)| sb.cmp(sa).then_with(|| a.name.cmp(&b.name)));
    scored.into_iter().map(|(_, cmd)| cmd.clone()).collect()
}

/// Recompute the completion state from the editor, honouring a dismissed
/// signature (port of `syncChatCommandCompletionState`).
pub fn sync_completion(
    current: &Option<CompletionState>,
    dismissed_signature: &mut Option<String>,
    text: &str,
    cursor: usize,
    commands: &[CommandMatch],
) -> Option<CompletionState> {
    let context = get_command_completion_context(text, cursor, commands)?;

    let signature = format!(
        "{}:{}:{}:{}",
        context.replacement_start,
        context.replacement_end,
        context.query,
        context
            .matches
            .iter()
            .map(|m| m.name.as_str())
            .collect::<Vec<_>>()
            .join(","),
    );

    // Clear the dismissed signature once the query changes.
    if dismissed_signature
        .as_ref()
        .is_some_and(|d| d != &signature)
    {
        *dismissed_signature = None;
    }
    if dismissed_signature.as_ref() == Some(&signature) {
        return None;
    }

    let previous_selection = current
        .as_ref()
        .and_then(|c| c.matches.get(c.selected_index).cloned());

    let mut selected_index = 0;
    if !context.matches.is_empty() {
        if let Some(prev) = &previous_selection {
            if let Some(idx) = context.matches.iter().position(|m| m.name == prev.name) {
                selected_index = idx;
            } else if current
                .as_ref()
                .is_some_and(|c| c.source_query == context.query)
            {
                selected_index = current
                    .as_ref()
                    .map(|c| c.selected_index)
                    .unwrap_or(0)
                    .min(context.matches.len() - 1);
            }
        } else if current
            .as_ref()
            .is_some_and(|c| c.source_query == context.query)
        {
            selected_index = current
                .as_ref()
                .map(|c| c.selected_index)
                .unwrap_or(0)
                .min(context.matches.len() - 1);
        }
    }

    Some(CompletionState {
        replacement_start: context.replacement_start,
        replacement_end: context.replacement_end,
        source_query: context.query,
        matches: context.matches,
        selected_index,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cmds() -> Vec<CommandMatch> {
        vec![
            CommandMatch {
                name: "model".to_string(),
                description: "Show model".to_string(),
            },
            CommandMatch {
                name: "model select".to_string(),
                description: "Select model".to_string(),
            },
            CommandMatch {
                name: "tools".to_string(),
                description: "Show tools".to_string(),
            },
            CommandMatch {
                name: "tools select".to_string(),
                description: "Select tools".to_string(),
            },
        ]
    }

    #[test]
    fn fuzzy_matches_substring_select() {
        let matches = fuzzy_command_matches(&cmds(), "select");
        assert!(matches.iter().any(|m| m.name == "model select"));
        assert!(matches.iter().any(|m| m.name == "tools select"));
    }

    #[test]
    fn matches_prefix_on_first_line() {
        let ctx = get_command_completion_context("/mod", 4, &cmds()).unwrap();
        assert_eq!(ctx.query, "mod");
        assert_eq!(ctx.matches.len(), 2);
        assert_eq!(ctx.matches[0].name, "model");
        assert_eq!(ctx.matches[1].name, "model select");
        assert_eq!(ctx.replacement_start, 0);
        assert_eq!(ctx.replacement_end, 4);
    }

    #[test]
    fn inactive_on_non_first_line() {
        let text = "hello\n/m";
        assert!(get_command_completion_context(text, 8, &cmds()).is_none());
    }

    #[test]
    fn inactive_without_slash() {
        assert!(get_command_completion_context("hello", 5, &cmds()).is_none());
    }

    #[test]
    fn longest_common_prefix_extends_shared_stem() {
        assert_eq!(
            longest_common_prefix(&["model set", "model select"]),
            "model se"
        );
        assert_eq!(longest_common_prefix(&["model"]), "model");
        assert_eq!(longest_common_prefix(&[]), "");
    }

    #[test]
    fn dismissed_signature_suppresses_same_query() {
        let mut dismissed = None;
        let commands = cmds();
        let s1 = sync_completion(&None, &mut dismissed, "/mo", 3, &commands).unwrap();
        dismissed = Some(s1.signature());
        let s2 = sync_completion(&None, &mut dismissed, "/mo", 3, &commands);
        assert!(s2.is_none(), "same query should stay dismissed");
        let s3 = sync_completion(&None, &mut dismissed, "/mod", 4, &commands);
        assert!(s3.is_some());
    }
}
