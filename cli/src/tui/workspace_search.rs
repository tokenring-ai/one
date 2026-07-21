//! Backend `@` workspace search orchestration with stale-result guards.

use std::sync::mpsc::Receiver;
use std::thread;

use crate::rpc::{self, RpcClient};
use crate::tui::filesearch::FileSearchState;
use crate::tui::workspace_cache::SearchCache;

type SearchResultMsg = Result<(Vec<String>, usize), String>;

/// In-flight and cached workspace search state for one chat session.
#[derive(Debug, Default)]
pub struct WorkspaceSearch {
    pub cache: SearchCache,
    request_id: u64,
    rx: Option<Receiver<(u64, String, SearchResultMsg)>>,
}

impl WorkspaceSearch {
    pub fn clear_picker(&mut self) {
        // Drop the in-flight receiver so stale results are ignored, but keep
        // the query cache so reopening `@` with the same query is instant.
        self.rx = None;
    }

    /// Start or refresh a backend search for `query` when not already cached.
    pub fn ensure_loading(&mut self, client: &RpcClient, provider: &str, query: &str) {
        if self.cache.get(provider, query).is_some() {
            return;
        }

        self.request_id = self.request_id.wrapping_add(1);
        let request_id = self.request_id;
        self.rx = None;

        let (tx, rx) = std::sync::mpsc::channel();
        self.rx = Some(rx);
        let client = client.clone();
        let provider = provider.to_string();
        let query = query.to_string();
        let fail_tx = tx.clone();
        let fail_query = query.clone();
        if let Err(error) = thread::Builder::new()
            .name("tr-workspace-search".into())
            .spawn(move || {
                let result = rpc::search_workspace_files(&client, &provider, &query, 48)
                    .map_err(|e| e.to_string());
                let _ = tx.send((request_id, query, result));
            })
        {
            let _ = fail_tx.send((
                request_id,
                fail_query,
                Err(format!("failed to start search thread: {error}")),
            ));
        }
    }

    /// Apply a finished search result when it matches the latest request.
    pub fn drain(&mut self, provider: &str, filesearch: &mut Option<FileSearchState>) {
        let Some(rx) = &self.rx else {
            return;
        };
        match rx.try_recv() {
            Ok((request_id, query, result)) => {
                self.rx = None;
                if request_id != self.request_id {
                    return;
                }

                let active_query = filesearch.as_ref().map(|state| state.token.query.as_str());
                if active_query != Some(query.as_str()) {
                    return;
                }

                match result {
                    Ok((files, total)) => {
                        self.cache.store(provider, &query, files.clone(), total);
                        if let Some(state) = filesearch.as_mut() {
                            state.matches = files;
                            state.indexed_count = total;
                            state.loading = false;
                            state.error = None;
                            state.selected_index = state
                                .selected_index
                                .min(state.matches.len().saturating_sub(1));
                        }
                    }
                    Err(message) => {
                        if let Some(state) = filesearch.as_mut() {
                            state.loading = false;
                            state.error = Some(message);
                        }
                    }
                }
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                // The worker exited without delivering a result (e.g. it
                // panicked or failed to spawn). Clear the in-flight handle so
                // `is_loading()` stops reporting `true` forever, and surface a
                // warning so the picker escapes the "Indexing..." state.
                self.rx = None;
                if let Some(state) = filesearch.as_mut() {
                    state.loading = false;
                    if state.error.is_none() {
                        state.error =
                            Some("Workspace search failed before completing.".to_string());
                    }
                }
            }
        }
    }

    pub fn is_loading(&self) -> bool {
        self.rx.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stale_request_id_is_ignored() {
        let mut search = WorkspaceSearch {
            request_id: 2,
            ..WorkspaceSearch::default()
        };
        let mut filesearch = Some(FileSearchState {
            token: crate::tui::filesearch::FileSearchToken {
                start: 0,
                end: 4,
                query: "src".into(),
            },
            matches: Vec::new(),
            selected_index: 0,
            loading: true,
            error: None,
            indexed_count: 0,
        });

        let (tx, rx) = std::sync::mpsc::channel();
        let _ = tx.send((1, "src".into(), Ok((vec!["a.rs".into()], 1))));
        search.rx = Some(rx);
        search.drain("posix", &mut filesearch);

        let state = filesearch.as_ref().unwrap();
        assert!(state.matches.is_empty());
        assert!(state.loading);
    }

    #[test]
    fn disconnected_channel_clears_loading_and_sets_error() {
        // Regression for the perpetual "Indexing workspace files..." state: a
        // worker that dies without delivering a result must clear the loading
        // flag and surface a warning so the picker can be dismissed.
        let mut search = WorkspaceSearch {
            request_id: 1,
            ..WorkspaceSearch::default()
        };
        let mut filesearch = Some(FileSearchState {
            token: crate::tui::filesearch::FileSearchToken {
                start: 0,
                end: 4,
                query: "src".into(),
            },
            matches: Vec::new(),
            selected_index: 0,
            loading: true,
            error: None,
            indexed_count: 0,
        });

        let (_tx, rx) = std::sync::mpsc::channel::<(u64, String, SearchResultMsg)>();
        drop(_tx);
        search.rx = Some(rx);
        search.drain("posix", &mut filesearch);

        let state = filesearch.as_ref().unwrap();
        assert!(!state.loading);
        assert!(state.error.is_some());
        assert!(!search.is_loading());
    }
}
