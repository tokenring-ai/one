//! Ephemeral `@` search result cache (nice-to-have #18).
//!
//! Results are keyed by `(provider, query)` and retained across picker dismissals
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
    pub fn key(provider: &str, query: &str) -> String {
        format!("{provider}:{}", query.trim())
    }

    pub fn get(&self, provider: &str, query: &str) -> Option<&SearchCacheEntry> {
        self.entries.get(&Self::key(provider, query))
    }

    pub fn store(
        &mut self,
        provider: &str,
        query: &str,
        matches: Vec<String>,
        total_matches: usize,
    ) {
        self.entries.insert(
            Self::key(provider, query),
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
    fn cache_key_includes_provider_and_query() {
        assert_eq!(SearchCache::key("posix", "src"), "posix:src");
    }

    #[test]
    fn clear_removes_entries() {
        let mut cache = SearchCache::default();
        cache.store("posix", "a", vec!["x".into()], 1);
        cache.clear();
        assert!(cache.get("posix", "a").is_none());
    }
}
