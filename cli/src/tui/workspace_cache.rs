//! Ephemeral `@` search result cache (nice-to-have #18).
//!
//! Results are keyed by query and retained across picker dismissals
//! so repeated `@` queries stay fast. Call [`SearchCache::clear`] for a full reset.

use std::collections::HashMap;

/// Cached search results for an active `@` query.
#[derive(Clone, Debug)]
pub struct SearchCacheEntry {
    pub matches: Vec<String>,
    pub total_matches: usize,
}

/// Per-session ephemeral cache (not global).
#[derive(Clone, Debug, Default)]
pub struct SearchCache {
    entries: HashMap<String, SearchCacheEntry>,
}

impl SearchCache {
    pub fn key(query: &str) -> String {
        query.trim().to_string()
    }

    pub fn get(&self, query: &str) -> Option<&SearchCacheEntry> {
        self.entries.get(&Self::key(query))
    }

    pub fn store(
        &mut self,
        query: &str,
        matches: Vec<String>,
        total_matches: usize,
    ) {
        self.entries.insert(
            Self::key(query),
            SearchCacheEntry {
                matches,
                total_matches,
            },
        );
    }

    /// Drop all cached queries (picker dismissed).
    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_key_is_the_trimmed_query() {
        assert_eq!(SearchCache::key(" src "), "src");
    }

    #[test]
    fn clear_removes_entries() {
        let mut cache = SearchCache::default();
        cache.store("a", vec!["x".into()], 1);
        cache.clear();
        assert!(cache.get("a").is_none());
    }
}
