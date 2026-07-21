//! Live status metrics received from the chat usage stream.

use serde_json::{json, Value};

use crate::rpc::{JsonStream, JsonStreamItem, RpcClient};

/// The latest status metrics for the status line.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Metrics {
    pub model: Option<String>,
    pub max_context_length: Option<u64>,
    pub tools: usize,
    pub tokens: u64,
    pub cost: f64,
    pub context_percent_left: Option<u8>,
    pub rpc_latency_ms: Option<u64>,
}

/// Handle to the live metrics stream and its most recently applied snapshot.
pub struct MetricsHandle {
    stream: JsonStream,
    latest: Option<Metrics>,
}

impl MetricsHandle {
    pub fn spawn(client: RpcClient, agent_id: String) -> Self {
        let stream =
            client.spawn_json_stream("/rpc/chat.streamChatUsage", json!({ "agentId": agent_id }));
        Self {
            stream,
            latest: None,
        }
    }

    /// Drain pending stream items. Returns true only when visible metrics changed.
    pub fn refresh(&mut self) -> bool {
        let mut changed = false;
        while let Ok(item) = self.stream.try_recv() {
            match item {
                JsonStreamItem::Data { value, latency_ms } => {
                    changed |= apply_snapshot(&mut self.latest, &value, latency_ms);
                }
                JsonStreamItem::Error(error) => {
                    // Metrics are best-effort. Reading the error prevents the stream
                    // diagnostic from becoming dead data while leaving the UI usable.
                    drop(error);
                }
                JsonStreamItem::Ended => {}
            }
        }
        changed
    }

    pub fn get(&self) -> Option<Metrics> {
        self.latest.clone()
    }
}

fn apply_snapshot(latest: &mut Option<Metrics>, value: &Value, latency_ms: Option<u64>) -> bool {
    let Some(mut metrics) = parse_metrics(value) else {
        return false;
    };
    metrics.rpc_latency_ms = latency_ms.or_else(|| {
        latest
            .as_ref()
            .and_then(|previous| previous.rpc_latency_ms)
    });
    if latest.as_ref() == Some(&metrics) {
        return false;
    }
    *latest = Some(metrics);
    true
}

/// Parse a `/rpc/chat.streamChatUsage` success result into status-line metrics.
///
/// Response shape (success):
/// ```json
/// {
///   "status": "success",
///   "model": "openai:gpt-5" | null,
///   "cost": { "input", "cachedInput", "output", "reasoning", "total" },
///   "contextLength": 1234,
///   "maxContextLength": 200000 | null,
///   "lastStepUsage": { ... },
///   "totalUsage": { ... },
///   "toolCount": 12
/// }
/// ```
fn parse_metrics(value: &Value) -> Option<Metrics> {
    if value.get("status").and_then(Value::as_str) != Some("success") {
        return None;
    }

    let context_length = value
        .get("contextLength")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let max_context_length = value
        .get("maxContextLength")
        .and_then(Value::as_u64);

    Some(Metrics {
        model: value
            .get("model")
            .and_then(|m| m.as_str())
            .map(String::from),
        max_context_length,
        tools: value
            .get("toolCount")
            .and_then(Value::as_u64)
            .unwrap_or(0) as usize,
        tokens: context_length,
        cost: value
            .get("cost")
            .and_then(|c| c.get("total"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        context_percent_left: context_percent_left(context_length, max_context_length),
        rpc_latency_ms: None,
    })
}

fn context_percent_left(context_length: u64, max_context_length: Option<u64>) -> Option<u8> {
    let max = max_context_length.filter(|&m| m > 0)?;
    let used_percent = ((context_length as u128 * 100) / max as u128).min(100) as u8;
    Some(100u8.saturating_sub(used_percent))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_success() -> Value {
        json!({
            "status": "success",
            "model": "openai:gpt-5",
            "cost": {
                "input": 0.10,
                "cachedInput": 0.02,
                "output": 0.30,
                "reasoning": 0.0,
                "total": 0.42,
            },
            "contextLength": 26_000,
            "maxContextLength": 200_000,
            "lastStepUsage": {
                "inputTokens": 20_000,
                "outputTokens": 6_000,
                "totalTokens": 26_000,
            },
            "totalUsage": {
                "inputTokens": 40_000,
                "outputTokens": 10_000,
                "totalTokens": 50_000,
            },
            "toolCount": 12,
        })
    }

    #[test]
    fn parses_successful_metrics_snapshot() {
        let metrics = parse_metrics(&sample_success()).unwrap();

        assert_eq!(metrics.model.as_deref(), Some("openai:gpt-5"));
        assert_eq!(metrics.max_context_length, Some(200_000));
        assert_eq!(metrics.tools, 12);
        assert_eq!(metrics.tokens, 26_000);
        assert_eq!(metrics.cost, 0.42);
        // 26000/200000 = 13% used → 87% left
        assert_eq!(metrics.context_percent_left, Some(87));
    }

    #[test]
    fn accepts_null_model_and_max_context() {
        let mut value = sample_success();
        value["model"] = json!(null);
        value["maxContextLength"] = json!(null);

        let metrics = parse_metrics(&value).unwrap();
        assert_eq!(metrics.model, None);
        assert_eq!(metrics.max_context_length, None);
        assert_eq!(metrics.context_percent_left, None);
    }

    #[test]
    fn ignores_agent_not_found() {
        assert!(parse_metrics(&json!({ "status": "agentNotFound" })).is_none());
    }

    #[test]
    fn only_marks_changed_for_a_new_snapshot() {
        let mut latest = None;
        let first = sample_success();
        assert!(apply_snapshot(&mut latest, &first, Some(10)));
        assert!(!apply_snapshot(&mut latest, &first, None));

        let mut updated = first;
        updated["contextLength"] = json!(30_000);
        assert!(apply_snapshot(&mut latest, &updated, None));
        assert_eq!(latest.as_ref().unwrap().tokens, 30_000);
        // 30000/200000 = 15% used → 85% left
        assert_eq!(latest.as_ref().unwrap().context_percent_left, Some(85));
    }

    #[test]
    fn context_percent_clamps_when_over_max() {
        assert_eq!(context_percent_left(250_000, Some(200_000)), Some(0));
        assert_eq!(context_percent_left(0, Some(200_000)), Some(100));
        assert_eq!(context_percent_left(100, None), None);
        assert_eq!(context_percent_left(100, Some(0)), None);
    }
}
