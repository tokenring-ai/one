//! `@`-mention workspace file search, ported from `pkg/cli/raw/FileSearch.ts`.
//!
//! All text indexing is char-based to match the TypeScript implementation. The
//! `Intl.Collator(numeric, base)` tie-breaker is approximated by a
//! numeric-aware chunk comparison.

use std::cmp::Ordering;

/// A detected `@query` token in the editor buffer.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileSearchToken {
    pub start: usize,
    pub end: usize,
    pub query: String,
}

/// The live file-search picker state.
#[derive(Clone, Debug)]
pub struct FileSearchState {
    pub token: FileSearchToken,
    pub matches: Vec<String>,
    pub selected_index: usize,
    pub loading: bool,
    pub error: Option<String>,
    pub indexed_count: usize,
}

impl FileSearchState {
    /// Signature used to keep a dismissed picker closed until the token changes
    /// (port of `getFileSearchTokenSignature`).
    pub fn signature(&self) -> String {
        format!(
            "{}:{}:{}",
            self.token.start, self.token.end, self.token.query
        )
    }
}

const PATH_SEPARATORS: &[char] = &['/', '-', '_', '.'];

// Scoring constants (port of FileSearch.ts).
const SCORE_EXACT_BASE_NAME_MATCH: i64 = 120_000;
const SCORE_STARTS_WITH_BASE_NAME: i64 = 60_000;
const SCORE_BASE_NAME_CONTAINS: i64 = 40_000;
const SCORE_PATH_CONTAINS: i64 = 20_000;
const SCORE_CHAR_MATCH: i64 = 1_000;
const SCORE_CONSECUTIVE_MATCH_BONUS: i64 = 350;
const SCORE_PATH_SEPARATOR_BONUS: i64 = 650;
const SCORE_BASE_NAME_END_BONUS: i64 = 500;
const SCORE_PATH_LENGTH_PENALTY: i64 = 8;
const SCORE_DEPTH_PENALTY: i64 = 120;

fn get_base_name(path: &str) -> &str {
    match path.rfind('/') {
        Some(i) => &path[i + 1..],
        None => path,
    }
}

fn get_path_depth(path: &str) -> usize {
    path.matches('/').count()
}

/// Locate the `@query` token under the cursor, if any (port of
/// `findActiveFileSearchToken`). `cursor` is a char index.
pub fn find_active_file_search_token(text: &str, cursor: usize) -> Option<FileSearchToken> {
    let chars: Vec<char> = text.chars().collect();
    let bounded = cursor.min(chars.len());

    let mut start = bounded;
    let mut end = bounded;
    while start > 0 && !chars[start - 1].is_whitespace() {
        start -= 1;
    }
    while end < chars.len() && !chars[end].is_whitespace() {
        end += 1;
    }

    let token: String = chars[start..end].iter().collect();
    if !token.starts_with('@') {
        return None;
    }
    if token[1..].contains('@') {
        return None;
    }

    Some(FileSearchToken {
        start,
        end,
        query: token[1..].to_string(),
    })
}

/// Score a single path against a query (port of `scoreFileSearchMatch`).
/// Returns `i64::MIN` when the path cannot fuzzy-match the query.
pub fn score_file_search_match(file_path: &str, query: &str) -> i64 {
    let normalized_query = query.trim().to_lowercase();
    let normalized_path = file_path.to_lowercase();
    let base_name = get_base_name(&normalized_path);

    if normalized_query.is_empty() {
        return 1_000_000
            - (get_path_depth(file_path) as i64) * 1000
            - normalized_path.len() as i64;
    }

    let mut score: i64 = 0;

    if base_name == normalized_query {
        score += SCORE_EXACT_BASE_NAME_MATCH;
    }
    if base_name.starts_with(&normalized_query) {
        score += SCORE_STARTS_WITH_BASE_NAME - base_name.len() as i64;
    }
    if let Some(base_name_index) = base_name.find(&normalized_query) {
        score += SCORE_BASE_NAME_CONTAINS - base_name_index as i64 * 200;
    }
    if let Some(path_index) = normalized_path.find(&normalized_query) {
        score += SCORE_PATH_CONTAINS - path_index as i64 * 50;
    }

    let mut last_match_index: i64 = -1;
    let mut consecutive_matches: i64 = 0;

    for ch in normalized_query.chars() {
        let search_from = (last_match_index + 1) as usize;
        let next_match_index = match normalized_path[search_from..].find(ch) {
            Some(i) => search_from + i,
            None => return i64::MIN,
        };

        score += SCORE_CHAR_MATCH;

        if next_match_index as i64 == last_match_index + 1 {
            consecutive_matches += 1;
            score += consecutive_matches * SCORE_CONSECUTIVE_MATCH_BONUS;
        } else {
            consecutive_matches = 0;
        }

        let previous_char = if next_match_index == 0 {
            '/'
        } else {
            normalized_path.as_bytes()[next_match_index - 1] as char
        };
        if PATH_SEPARATORS.contains(&previous_char) {
            score += SCORE_PATH_SEPARATOR_BONUS;
        }

        if next_match_index >= normalized_path.len().saturating_sub(base_name.len()) {
            score += SCORE_BASE_NAME_END_BONUS;
        }

        last_match_index = next_match_index as i64;
    }

    score -= normalized_path.len() as i64 * SCORE_PATH_LENGTH_PENALTY;
    score -= get_path_depth(file_path) as i64 * SCORE_DEPTH_PENALTY;

    score
}

/// Numeric-aware string comparison, approximating
/// `new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })`.
fn numeric_compare(a: &str, b: &str) -> Ordering {
    let a = a.to_lowercase();
    let b = b.to_lowercase();
    let mut ia = a.chars().peekable();
    let mut ib = b.chars().peekable();

    loop {
        match (ia.peek(), ib.peek()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(&ca), Some(&cb)) => {
                let a_digit = ca.is_ascii_digit();
                let b_digit = cb.is_ascii_digit();
                if a_digit && b_digit {
                    // Consume digit runs and compare numerically (strip leading zeros).
                    let mut na = String::new();
                    while let Some(&c) = ia.peek() {
                        if c.is_ascii_digit() {
                            na.push(c);
                            ia.next();
                        } else {
                            break;
                        }
                    }
                    let mut nb = String::new();
                    while let Some(&c) = ib.peek() {
                        if c.is_ascii_digit() {
                            nb.push(c);
                            ib.next();
                        } else {
                            break;
                        }
                    }
                    let va = na.trim_start_matches('0');
                    let vb = nb.trim_start_matches('0');
                    let ord = va.len().cmp(&vb.len()).then_with(|| va.cmp(vb));
                    if ord != Ordering::Equal {
                        return ord;
                    }
                } else {
                    if ca != cb {
                        return ca.cmp(&cb);
                    }
                    ia.next();
                    ib.next();
                }
            }
        }
    }
}

/// Tie-breaker for browsing order (port of `compareFilePathsForBrowsing`).
pub fn compare_file_paths_for_browsing(left: &str, right: &str) -> Ordering {
    let depth = get_path_depth(left).cmp(&get_path_depth(right));
    if depth != Ordering::Equal {
        return depth;
    }
    let base = numeric_compare(get_base_name(left), get_base_name(right));
    if base != Ordering::Equal {
        return base;
    }
    let length = left.len().cmp(&right.len());
    if length != Ordering::Equal {
        return length;
    }
    numeric_compare(left, right)
}

/// Return the best `limit` matches for a query (port of `getFileSearchMatches`).
#[allow(dead_code)] // Exercised by unit tests in this module.
pub fn get_file_search_matches(file_paths: &[String], query: &str, limit: usize) -> Vec<String> {
    let max_results = limit;
    if max_results == 0 {
        return Vec::new();
    }
    let normalized_query = query.trim();

    let mut candidates: Vec<(&String, i64)> = file_paths
        .iter()
        .map(|path| (path, score_file_search_match(path, normalized_query)))
        .filter(|(_, score)| *score != i64::MIN)
        .collect();
    candidates.sort_by(|(la, sa), (lb, sb)| {
        sb.cmp(sa)
            .then_with(|| compare_file_paths_for_browsing(la, lb))
    });
    candidates
        .into_iter()
        .take(max_results)
        .map(|(p, _)| p.clone())
        .collect()
}

/// Replace a file-search token with a chosen path (port of
/// `replaceFileSearchToken`).
pub fn replace_file_search_token(
    text: &str,
    token: &FileSearchToken,
    replacement: &str,
) -> (String, usize) {
    let chars: Vec<char> = text.chars().collect();
    let prefix: String = chars[..token.start].iter().collect();
    let suffix: String = chars[token.end..].iter().collect();
    let insertion = if suffix.is_empty() {
        format!("{replacement} ")
    } else {
        replacement.to_string()
    };
    let new_text = format!("{prefix}{insertion}{suffix}");
    let cursor = prefix.chars().count() + insertion.chars().count();
    (new_text, cursor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_at_token_under_cursor() {
        let token = find_active_file_search_token("hi @src/ma", 9).unwrap();
        assert_eq!(token.start, 3);
        assert_eq!(token.end, 10);
        assert_eq!(token.query, "src/ma");
    }

    #[test]
    fn ignores_token_without_at_or_with_second_at() {
        assert!(find_active_file_search_token("hello", 3).is_none());
        assert!(find_active_file_search_token("@a@b", 3).is_none());
    }

    #[test]
    fn exact_base_name_scores_highest() {
        let paths = vec![
            "src/main.rs".to_string(),
            "main.rs".to_string(),
            "domain/main.rs".to_string(),
        ];
        let matches = get_file_search_matches(&paths, "main.rs", 3);
        assert_eq!(matches[0], "main.rs");
    }

    #[test]
    fn empty_query_ranks_shallow_short_first() {
        let paths = vec!["a/b/c/deep.txt".to_string(), "x.txt".to_string()];
        let matches = get_file_search_matches(&paths, "", 2);
        assert_eq!(matches[0], "x.txt");
    }

    #[test]
    fn replace_token_appends_trailing_space_at_eos() {
        let token = find_active_file_search_token("@foo", 4).unwrap();
        let (text, cursor) = replace_file_search_token("@foo", &token, "bar.ts");
        assert_eq!(text, "bar.ts ");
        assert_eq!(cursor, "bar.ts ".chars().count());
    }
}
