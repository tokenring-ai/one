//! Background status-metric polling. Periodically fetches model / enabled
//! tools / token usage / cost for the status line, mirroring the per-render
//! reads the in-process TS CLI does against `ChatService`.
//!
//! Because these are remote RPC calls rather than in-memory reads, we poll on
//! a background thread and cache the latest snapshot.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::Result;
use serde_json::Value;

use crate::rpc::{get_chat_messages, get_enabled_tools, get_model, RpcClient};

/// Polling interval for status metrics.
const POLL_INTERVAL: Duration = Duration::from_secs(4);

/// The latest status metrics for the status line.
#[derive(Clone, Debug, Default)]
#[allow(dead_code)] // Snapshot fields are populated for future status-line detail.
pub struct Metrics {
    pub model: Option<String>,
    pub max_context_length: Option<u64>,
    pub tools: usize,
    pub tokens: u64,
    pub cost: f64,
    pub context_percent_left: Option<u8>,
    pub rpc_latency_ms: Option<u64>,
}

/// Handle to a running metrics poller. Dropping it stops the background thread.
pub struct MetricsHandle {
    latest: Arc<Mutex<Option<Metrics>>>,
    shutdown: Arc<AtomicBool>,
}

impl MetricsHandle {
    /// Spawn a poller for `agent_id`.
    pub fn spawn(client: RpcClient, agent_id: String) -> Self {
        let latest = Arc::new(Mutex::new(None));
        let shutdown = Arc::new(AtomicBool::new(false));
        let latest_cloned = latest.clone();
        let shutdown_cloned = shutdown.clone();
        thread::Builder::new()
            .name("tr-metrics".into())
            .spawn(move || {
                run_loop(client, agent_id, latest_cloned, shutdown_cloned);
            })
            .ok();
        Self { latest, shutdown }
    }

    /// The most recent metrics snapshot, if available.
    pub fn get(&self) -> Option<Metrics> {
        self.latest.lock().ok().and_then(|guard| guard.clone())
    }
}

impl Drop for MetricsHandle {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }
}

fn run_loop(
    client: RpcClient,
    agent_id: String,
    latest: Arc<Mutex<Option<Metrics>>>,
    shutdown: Arc<AtomicBool>,
) {
    while !shutdown.load(Ordering::Relaxed) {
        match fetch_metrics(&client, &agent_id) {
            Ok(metrics) => {
                if let Ok(mut guard) = latest.lock() {
                    *guard = Some(metrics);
                }
            }
            Err(_) => { /* transient; retry next cycle */ }
        }

        for _ in 0..(POLL_INTERVAL.as_millis() / 200) as usize {
            if shutdown.load(Ordering::Relaxed) {
                return;
            }
            thread::sleep(Duration::from_millis(200));
        }
    }
}

fn fetch_metrics(client: &RpcClient, agent_id: &str) -> Result<Metrics> {
    let started = Instant::now();
    let model_info = get_model(client, agent_id).ok();
    let model = model_info.as_ref().and_then(|m| m.model.clone());
    let max_context_length = model_info
        .as_ref()
        .and_then(|m| m.spec.as_ref().map(|s| s.max_context_length));
    let tools = get_enabled_tools(client, agent_id)
        .map(|tools| tools.len())
        .unwrap_or(0);
    let messages = get_chat_messages(client, agent_id)?;
    let (tokens, cost, last_step_tokens) = aggregate_usage(&messages);
    let rpc_latency_ms = Some(started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64);

    let context_percent_left = match (max_context_length, last_step_tokens) {
        (Some(max_ctx), step_tokens) if max_ctx > 0 => {
            let remaining = 1.0 - (step_tokens as f64 / max_ctx as f64);
            Some((remaining.clamp(0.0, 1.0) * 100.0).round() as u8)
        }
        (Some(_), 0) => Some(100),
        _ => None,
    };

    Ok(Metrics {
        model,
        max_context_length,
        tools,
        tokens,
        cost,
        context_percent_left,
        rpc_latency_ms,
    })
}

/// Port of `getTokenUsage` (last message total usage), `getChatCost` (sum of
/// all messages' `cost.total`), and `getRemainingContextPercent` (uses
/// `lastStepUsage`) from `pkg/cli/raw/utility.ts`.
fn aggregate_usage(messages: &[Value]) -> (u64, f64, u64) {
    let mut tokens = 0u64;
    let mut cost = 0.0f64;
    let mut last_step_tokens = 0u64;

    if let Some(last) = messages.last() {
        if let Some(usage) = last.pointer("/response/totalUsage") {
            let input = usage
                .get("inputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let output = usage
                .get("outputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            tokens = input + output;
        }
        if let Some(step_usage) = last.pointer("/response/lastStepUsage") {
            let input = step_usage
                .get("inputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let output = step_usage
                .get("outputTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0);
            last_step_tokens = input + output;
        }
    }

    for message in messages {
        if let Some(total) = message
            .pointer("/response/cost/total")
            .and_then(Value::as_f64)
        {
            cost += total;
        }
    }

    (tokens, cost, last_step_tokens)
}
