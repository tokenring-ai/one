//! Multiplexing-friendly WebSocket JSON-RPC client for the TokenRing backend.
//!
//! Architecture:
//!
//! * **Request/response** calls share one persistent WebSocket on a dedicated
//!   worker thread ([`RpcClient::call`]). Requests are sent sequentially on
//!   that socket; responses are matched by JSON-RPC `id`.
//! * The **event stream** owns a separate long-lived socket on its own
//!   background thread ([`RpcClient::spawn_event_stream`]) because
//!   `/rpc/agent.streamAgentEvents` is a streaming method.
//!
//! Both channels apply the same optional HTTP authorization header and
//! WebSocket-session username/password login.

use std::net::{Shutdown, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use anyhow::{anyhow, bail, Context, Result};
use serde_json::{json, Value};
use tungstenite::client::IntoClientRequest;
use tungstenite::http::header::AUTHORIZATION;
use tungstenite::http::HeaderValue;
use tungstenite::stream::MaybeTlsStream;
use tungstenite::{connect, Message, Utf8Bytes};

type WsSocket = tungstenite::WebSocket<MaybeTlsStream<std::net::TcpStream>>;

const RPC_CALL_TIMEOUT: Duration = Duration::from_secs(35);
const SOCKET_IO_TIMEOUT: Duration = Duration::from_secs(30);

/// A WebSocket JSON-RPC client.
#[derive(Clone)]
pub struct RpcClient {
    inner: Arc<RpcClientInner>,
}

#[derive(Clone, Debug)]
pub struct SessionAuth {
    pub username: String,
    pub password: String,
}

struct RpcClientInner {
    ws_url: String,
    auth_header: Option<HeaderValue>,
    session_auth: Option<SessionAuth>,
    next_id: AtomicU64,
    request_tx: Sender<WorkerRequest>,
    /// Cloned TCP handle for the active RPC socket; shut down on call timeout
    /// so a stuck `read` unblocks and the worker can process later calls.
    io_abort: Arc<Mutex<Option<TcpStream>>>,
}

enum WorkerRequest {
    Call {
        id: u64,
        method: String,
        params: Value,
        reply: Sender<Result<Value>>,
    },
    Shutdown,
}

/// Live agent event stream with cooperative cancellation.
pub struct EventStream {
    rx: Receiver<StreamItem>,
    cancel: Arc<AtomicBool>,
    io_abort: Arc<Mutex<Option<TcpStream>>>,
}

/// A raw JSON-RPC stream on its own cancellable WebSocket connection.
pub struct JsonStream {
    rx: Receiver<JsonStreamItem>,
    cancel: Arc<AtomicBool>,
    io_abort: Arc<Mutex<Option<TcpStream>>>,
}

impl JsonStream {
    pub fn try_recv(&self) -> Result<JsonStreamItem, std::sync::mpsc::TryRecvError> {
        self.rx.try_recv()
    }

    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
        abort_io(&self.io_abort);
    }
}

impl Drop for JsonStream {
    fn drop(&mut self) {
        self.cancel();
    }
}

#[derive(Clone, Debug)]
pub enum JsonStreamItem {
    Data {
        value: Value,
        /// Request-to-first-result latency; subsequent stream items omit it.
        latency_ms: Option<u64>,
    },
    Ended,
    Error(String),
}

struct StreamParts<T> {
    rx: Receiver<T>,
    cancel: Arc<AtomicBool>,
    io_abort: Arc<Mutex<Option<TcpStream>>>,
}

fn spawn_stream_worker<T, F>(
    thread_name: &str,
    error_item: fn(String) -> T,
    worker: F,
) -> StreamParts<T>
where
    T: Send + 'static,
    F: FnOnce(&Sender<T>, &AtomicBool, &Mutex<Option<TcpStream>>) -> Result<()> + Send + 'static,
{
    let (tx, rx) = mpsc::channel();
    let cancel = Arc::new(AtomicBool::new(false));
    let cancel_worker = Arc::clone(&cancel);
    let io_abort = Arc::new(Mutex::new(None));
    let io_abort_worker = Arc::clone(&io_abort);
    let tx_for_worker = tx.clone();
    if let Err(error) = thread::Builder::new()
        .name(thread_name.into())
        .spawn(move || {
            if let Err(error) = worker(&tx_for_worker, &cancel_worker, &io_abort_worker) {
                if !cancel_worker.load(Ordering::SeqCst) {
                    let _ = tx_for_worker.send(error_item(error.to_string()));
                }
            }
        })
    {
        let _ = tx.send(error_item(format!(
            "failed to start {thread_name} thread: {error}"
        )));
    }
    StreamParts {
        rx,
        cancel,
        io_abort,
    }
}

impl EventStream {
    pub fn try_recv(&self) -> Result<StreamItem, std::sync::mpsc::TryRecvError> {
        self.rx.try_recv()
    }

    /// Stop the background stream thread and close its socket.
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
        abort_io(&self.io_abort);
    }
}

impl Drop for EventStream {
    fn drop(&mut self) {
        self.cancel();
    }
}

impl RpcClient {
    /// Create a client targeting the given fully-qualified WS URL (ending in
    /// `/rpc:ws`) with an optional `Authorization` header value.
    pub fn new(
        ws_url: String,
        auth_header: Option<HeaderValue>,
        session_auth: Option<SessionAuth>,
    ) -> Result<Self> {
        let (request_tx, request_rx) = mpsc::channel();
        let io_abort = Arc::new(Mutex::new(None));
        let io_abort_worker = Arc::clone(&io_abort);
        let inner = Arc::new(RpcClientInner {
            ws_url: ws_url.clone(),
            auth_header: auth_header.clone(),
            session_auth: session_auth.clone(),
            next_id: AtomicU64::new(1),
            request_tx,
            io_abort,
        });
        thread::Builder::new()
            .name("tr-rpc-worker".into())
            .spawn(move || {
                rpc_worker_loop(ws_url, auth_header, session_auth, request_rx, io_abort_worker)
            })
            .context("start rpc worker thread")?;
        Ok(Self { inner })
    }

    /// The WS URL this client targets.
    pub fn ws_url(&self) -> &str {
        &self.inner.ws_url
    }

    /// A separate client (own worker thread) sharing the same endpoint/auth.
    /// Used so background metrics polls cannot block interactive RPCs.
    pub fn isolated(&self) -> Result<Self> {
        Self::new(
            self.inner.ws_url.clone(),
            self.inner.auth_header.clone(),
            self.inner.session_auth.clone(),
        )
    }

    /// Ask the RPC worker to exit after finishing the current call (if any).
    /// Remaining clones become unusable once the worker stops.
    pub fn shutdown(&self) {
        let _ = self.inner.request_tx.send(WorkerRequest::Shutdown);
        abort_io(&self.inner.io_abort);
    }

    /// Perform a request/response JSON-RPC call on the shared socket.
    pub fn call(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let (reply_tx, reply_rx) = mpsc::channel();
        self.inner
            .request_tx
            .send(WorkerRequest::Call {
                id,
                method: method.to_string(),
                params,
                reply: reply_tx,
            })
            .context("rpc worker channel closed")?;
        match reply_rx.recv_timeout(RPC_CALL_TIMEOUT) {
            Ok(result) => result,
            Err(RecvTimeoutError::Timeout) => {
                // Unblock the worker's stuck read so later RPCs are not queued
                // behind a dead call.
                abort_io(&self.inner.io_abort);
                bail!(
                    "rpc call timed out after {}s: {method}",
                    RPC_CALL_TIMEOUT.as_secs()
                )
            }
            Err(RecvTimeoutError::Disconnected) => {
                bail!("rpc worker dropped response")
            }
        }
    }

    /// Open the `/rpc/agent.streamAgentEvents` stream on a dedicated background
    /// thread. Each batch of events is delivered over the returned channel.
    ///
    /// Dropping or [`EventStream::cancel`] stops the worker and closes the socket.
    pub fn spawn_event_stream(&self, agent_id: &str, from_position: usize) -> EventStream {
        let client = self.clone();
        let agent_id = agent_id.to_string();
        let parts = spawn_stream_worker("tr-event-stream", StreamItem::Error, move |tx, cancel, io| {
            run_event_stream(&client, &agent_id, from_position, tx, cancel, io)
        });
        EventStream {
            rx: parts.rx,
            cancel: parts.cancel,
            io_abort: parts.io_abort,
        }
    }

    /// Open an arbitrary JSON-RPC stream on a dedicated background thread.
    pub fn spawn_json_stream(&self, method: &str, params: Value) -> JsonStream {
        let client = self.clone();
        let method = method.to_string();
        let parts = spawn_stream_worker(
            "tr-json-stream",
            JsonStreamItem::Error,
            move |tx, cancel, io| run_json_stream(&client, &method, params, tx, cancel, io),
        );
        JsonStream {
            rx: parts.rx,
            cancel: parts.cancel,
            io_abort: parts.io_abort,
        }
    }

    fn connect(&self) -> Result<WsSocket> {
        connect_socket(
            &self.inner.ws_url,
            self.inner.auth_header.as_ref(),
            self.inner.session_auth.as_ref(),
        )
    }
}

fn rpc_worker_loop(
    ws_url: String,
    auth_header: Option<HeaderValue>,
    session_auth: Option<SessionAuth>,
    request_rx: Receiver<WorkerRequest>,
    io_abort: Arc<Mutex<Option<TcpStream>>>,
) {
    let mut socket: Option<WsSocket> = None;

    while let Ok(request) = request_rx.recv() {
        let (id, method, params, reply) = match request {
            WorkerRequest::Shutdown => break,
            WorkerRequest::Call {
                id,
                method,
                params,
                reply,
            } => (id, method, params, reply),
        };

        if socket.is_none() {
            match connect_socket(&ws_url, auth_header.as_ref(), session_auth.as_ref()) {
                Ok(connected) => {
                    register_io_abort(&connected, &io_abort);
                    socket = Some(connected);
                }
                Err(error) => {
                    clear_io_abort(&io_abort);
                    let _ = reply.send(Err(anyhow::anyhow!("{error:#}")));
                    continue;
                }
            }
        } else if let Some(connected) = socket.as_ref() {
            register_io_abort(connected, &io_abort);
        }

        let result = match socket.as_mut() {
            Some(connected) => execute_call(
                connected,
                &ws_url,
                auth_header.as_ref(),
                session_auth.as_ref(),
                id,
                &method,
                params,
                &io_abort,
            ),
            None => unreachable!("socket was just initialized"),
        };
        if result.is_err() {
            clear_io_abort(&io_abort);
            socket = None;
        }
        // Caller may have timed out and dropped the reply channel. Keep the
        // worker alive so later RPCs (send, abort, metrics, search) still work.
        let _ = reply.send(result);
    }
    clear_io_abort(&io_abort);
}

fn execute_call(
    socket: &mut WsSocket,
    ws_url: &str,
    auth_header: Option<&HeaderValue>,
    session_auth: Option<&SessionAuth>,
    id: u64,
    method: &str,
    params: Value,
    io_abort: &Mutex<Option<TcpStream>>,
) -> Result<Value> {
    let payload = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    })
    .to_string();

    let send_result = socket.send(Message::Text(Utf8Bytes::from(payload)));
    if send_result.is_err() {
        *socket = connect_socket(ws_url, auth_header, session_auth)?;
        register_io_abort(socket, io_abort);
        socket
            .send(Message::Text(
                Utf8Bytes::from(
                    json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "method": method,
                        "params": params,
                    })
                    .to_string(),
                ),
            ))
            .context("resend rpc request after reconnect")?;
    }

    loop {
        let text = match read_text(socket, false) {
            Ok(text) => text,
            Err(error) => {
                return Err(error);
            }
        };

        let response: Value = serde_json::from_str(&text).context("decode rpc response")?;
        if response.get("stream").and_then(Value::as_str).is_some() {
            continue;
        }

        let response_id = response.get("id").and_then(Value::as_u64);
        if response_id != Some(id) {
            continue;
        }

        if let Some(error) = response.get("error") {
            bail!("{}", format_rpc_error(error));
        }

        return response
            .get("result")
            .cloned()
            .ok_or_else(|| anyhow!("rpc response missing result"));
    }
}

fn connect_socket(
    ws_url: &str,
    auth_header: Option<&HeaderValue>,
    session_auth: Option<&SessionAuth>,
) -> Result<WsSocket> {
    let mut request = ws_url
        .into_client_request()
        .with_context(|| format!("build request for {ws_url}"))?;
    if let Some(auth) = auth_header {
        request.headers_mut().insert(AUTHORIZATION, auth.clone());
    }
    let (mut socket, _response) = connect(request).with_context(|| format!("connect {ws_url}"))?;
    set_socket_timeouts(&mut socket)?;
    if let Some(auth) = session_auth {
        authenticate_socket(&mut socket, auth)?;
    }
    Ok(socket)
}

fn authenticate_socket(socket: &mut WsSocket, auth: &SessionAuth) -> Result<()> {
    let id = 0;
    socket
        .send(Message::Text(Utf8Bytes::from(
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "method": "auth",
                "params": {
                    "username": auth.username,
                    "password": auth.password,
                },
            })
            .to_string(),
        )))
        .context("send websocket authentication")?;

    loop {
        let text =
            read_text(socket, false).context("read websocket authentication response")?;
        let response: Value =
            serde_json::from_str(&text).context("decode websocket authentication response")?;
        if response.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if let Some(error) = response.get("error") {
            bail!(
                "websocket authentication failed: {}",
                format_rpc_error(error)
            );
        }
        let authenticated = response
            .get("result")
            .and_then(|result| result.get("authenticated"))
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !authenticated {
            bail!("websocket authentication was not accepted");
        }
        return Ok(());
    }
}

fn set_socket_timeouts(socket: &mut WsSocket) -> Result<()> {
    match socket.get_mut() {
        MaybeTlsStream::Plain(stream) => {
            stream.set_read_timeout(Some(SOCKET_IO_TIMEOUT))?;
            stream.set_write_timeout(Some(SOCKET_IO_TIMEOUT))?;
        }
        MaybeTlsStream::NativeTls(stream) => {
            stream.get_ref().set_read_timeout(Some(SOCKET_IO_TIMEOUT))?;
            stream
                .get_ref()
                .set_write_timeout(Some(SOCKET_IO_TIMEOUT))?;
        }
        _ => {}
    }
    Ok(())
}

fn register_io_abort(socket: &WsSocket, slot: &Mutex<Option<TcpStream>>) {
    let clone = match socket.get_ref() {
        MaybeTlsStream::Plain(stream) => stream.try_clone().ok(),
        MaybeTlsStream::NativeTls(stream) => stream.get_ref().try_clone().ok(),
        _ => None,
    };
    if let Ok(mut guard) = slot.lock() {
        *guard = clone;
    }
}

fn clear_io_abort(slot: &Mutex<Option<TcpStream>>) {
    if let Ok(mut guard) = slot.lock() {
        *guard = None;
    }
}

fn abort_io(slot: &Mutex<Option<TcpStream>>) {
    if let Ok(mut guard) = slot.lock() {
        if let Some(stream) = guard.take() {
            let _ = stream.shutdown(Shutdown::Both);
        }
    }
}

/// A single item pushed from the background event-stream worker.
#[derive(Clone, Debug)]
pub enum StreamItem {
    /// A successful batch of raw agent events and the new stream position.
    Events { events: Vec<Value>, position: usize },
    /// The agent no longer exists.
    AgentNotFound,
    /// The stream has ended cleanly.
    Ended,
    /// A transport/protocol error occurred.
    Error(String),
}

fn run_event_stream(
    client: &RpcClient,
    agent_id: &str,
    from_position: usize,
    tx: &Sender<StreamItem>,
    cancel: &AtomicBool,
    io_abort: &Mutex<Option<TcpStream>>,
) -> Result<()> {
    let mut socket = client.connect()?;
    register_io_abort(&socket, io_abort);
    let mut cursor = from_position;
    socket.send(Message::Text(Utf8Bytes::from(
        json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "/rpc/agent.streamAgentEvents",
            "params": {
                "agentId": agent_id,
                "fromPosition": from_position,
            },
        })
        .to_string(),
    )))?;

    loop {
        if cancel.load(Ordering::SeqCst) {
            return Ok(());
        }

        // Keepalive on idle so proxies/NAT do not drop the long-lived stream.
        let text = match read_text(&mut socket, true) {
            Ok(text) => text,
            Err(_) if cancel.load(Ordering::SeqCst) => return Ok(()),
            Err(error) => return Err(error),
        };
        if cancel.load(Ordering::SeqCst) {
            return Ok(());
        }

        let response: Value = serde_json::from_str(&text).context("decode stream response")?;

        if let Some(error) = response.get("error") {
            bail!("{}", format_rpc_error(error));
        }

        if response.get("stream").and_then(Value::as_str) == Some("end") {
            let _ = tx.send(StreamItem::Ended);
            return Ok(());
        }

        let result = match response.get("result") {
            Some(result) => result,
            None => continue,
        };

        if result.get("status").and_then(Value::as_str) == Some("agentNotFound") {
            let _ = tx.send(StreamItem::AgentNotFound);
            return Ok(());
        }

        let events = result
            .get("events")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        // Never regress the cursor when the server omits `position`.
        let position = result
            .get("position")
            .and_then(Value::as_u64)
            .map(|p| p as usize)
            .unwrap_or(cursor);
        cursor = position;

        if tx.send(StreamItem::Events { events, position }).is_err() {
            return Ok(());
        }
    }
}

fn run_json_stream(
    client: &RpcClient,
    method: &str,
    params: Value,
    tx: &Sender<JsonStreamItem>,
    cancel: &AtomicBool,
    io_abort: &Mutex<Option<TcpStream>>,
) -> Result<()> {
    let mut socket = client.connect()?;
    register_io_abort(&socket, io_abort);
    let started = Instant::now();
    let mut first_result = true;
    socket.send(Message::Text(Utf8Bytes::from(
        json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        })
        .to_string(),
    )))?;

    loop {
        if cancel.load(Ordering::SeqCst) {
            return Ok(());
        }
        let text = match read_text(&mut socket, true) {
            Ok(text) => text,
            Err(_) if cancel.load(Ordering::SeqCst) => return Ok(()),
            Err(error) => return Err(error),
        };
        let response: Value = serde_json::from_str(&text).context("decode JSON stream response")?;
        if let Some(error) = response.get("error") {
            bail!("{}", format_rpc_error(error));
        }
        if response.get("stream").and_then(Value::as_str) == Some("end") {
            let _ = tx.send(JsonStreamItem::Ended);
            return Ok(());
        }
        let Some(value) = response.get("result").cloned() else {
            continue;
        };
        let latency_ms =
            first_result.then(|| started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64);
        first_result = false;
        if tx.send(JsonStreamItem::Data { value, latency_ms }).is_err() {
            return Ok(());
        }
    }
}

/// Read the next text/binary WebSocket payload.
///
/// Always answers peer `Ping` with a flushed auto-`Pong` (tungstenite queues it).
/// When `keepalive` is true (event stream), idle read timeouts send a client
/// `Ping` and continue. When false (RPC request/response), timeouts surface as
/// errors so the worker can fail/reconnect the call.
fn read_text(socket: &mut WsSocket, keepalive: bool) -> Result<String> {
    loop {
        match socket.read() {
            Ok(Message::Text(text)) => return Ok(text.to_string()),
            Ok(Message::Binary(bytes)) => {
                return String::from_utf8(bytes.to_vec()).context("decode binary message")
            }
            Ok(Message::Close(_)) => bail!("websocket stream closed"),
            Ok(Message::Ping(_)) => {
                // tungstenite queues an automatic Pong; flush so the peer sees it.
                socket.flush().context("flush websocket pong")?;
            }
            Ok(Message::Pong(_)) => {
                // Keepalive reply from the peer — ignore payload.
            }
            Ok(Message::Frame(_)) => {}
            Err(error) if keepalive && is_io_timeout(&error) => {
                socket
                    .send(Message::Ping(Vec::new().into()))
                    .context("send websocket keepalive ping")?;
                socket.flush().context("flush websocket keepalive ping")?;
            }
            Err(error) => {
                return Err(error).context("read websocket message");
            }
        }
    }
}

/// Whether a tungstenite error is a socket read/write timeout (idle, not fatal).
fn is_io_timeout(error: &tungstenite::Error) -> bool {
    match error {
        tungstenite::Error::Io(io) => matches!(
            io.kind(),
            std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
        ),
        _ => false,
    }
}

/// Format a JSON-RPC error object, preserving structured detail (code + data)
/// instead of discarding everything but `message`. Mirrors the context the TS
/// in-process path surfaces through `formatLogMessages`.
fn format_rpc_error(error: &Value) -> String {
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("rpc call failed");

    let mut out = match error.get("code") {
        Some(Value::Number(n)) => format!("[code {n}] {message}"),
        Some(Value::String(s)) => format!("[code {s}] {message}"),
        _ => message.to_string(),
    };

    if let Some(data) = error.get("data") {
        match data {
            Value::String(s) if !s.is_empty() => out.push_str(&format!(" — {s}")),
            Value::String(_) => {}
            other => out.push_str(&format!(" — {other}")),
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rpc_error_preserves_message_only() {
        assert_eq!(format_rpc_error(&json!({ "message": "boom" })), "boom");
    }

    #[test]
    fn rpc_error_preserves_numeric_code_and_data() {
        let err = json!({ "code": -32001, "message": "agent not found", "data": "id abc" });
        assert_eq!(
            format_rpc_error(&err),
            "[code -32001] agent not found — id abc"
        );
    }

    #[test]
    fn rpc_error_preserves_string_code_and_structured_data() {
        let err =
            json!({ "code": "AUTH_FAILED", "message": "unauthorized", "data": { "retry": false } });
        assert_eq!(
            format_rpc_error(&err),
            "[code AUTH_FAILED] unauthorized — {\"retry\":false}"
        );
    }

    #[test]
    fn rpc_error_falls_back_to_default_message() {
        assert_eq!(format_rpc_error(&json!({})), "rpc call failed");
    }

    #[test]
    fn rpc_worker_retries_after_initial_connect_failure() {
        let probe = match std::net::TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("failed to bind local test listener: {error}"),
        };
        let addr = probe.local_addr().unwrap();
        drop(probe);

        let client = RpcClient::new(format!("ws://{addr}/rpc:ws"), None, None).unwrap();
        assert!(client.call("/rpc/test", json!({})).is_err());

        let listener = match std::net::TcpListener::bind(addr) {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("failed to rebind local test listener: {error}"),
        };
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut socket = tungstenite::accept(stream).unwrap();
            let request = match socket.read().unwrap() {
                Message::Text(text) => text.to_string(),
                other => panic!("unexpected websocket message: {other:?}"),
            };
            let request: Value = serde_json::from_str(&request).unwrap();
            socket
                .send(Message::Text(Utf8Bytes::from(
                    json!({
                        "jsonrpc": "2.0",
                        "id": request.get("id").cloned().unwrap_or(json!(1)),
                        "result": { "ok": true }
                    })
                    .to_string(),
                )))
                .unwrap();
        });

        let result = client.call("/rpc/test", json!({})).unwrap();
        assert_eq!(result.get("ok").and_then(Value::as_bool), Some(true));
        server.join().unwrap();
    }

    #[test]
    fn websocket_session_authenticates_before_rpc_call() {
        let listener = match std::net::TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("failed to bind local test listener: {error}"),
        };
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut socket = tungstenite::accept(stream).unwrap();
            let auth_request = read_request(&mut socket);
            assert_eq!(auth_request["method"], "auth");
            assert_eq!(auth_request["params"]["username"], "cli");
            assert_eq!(auth_request["params"]["password"], "secret");
            send_result(
                &mut socket,
                &auth_request,
                json!({
                    "authenticated": true,
                    "username": "cli"
                }),
            );

            let rpc_request = read_request(&mut socket);
            assert_eq!(rpc_request["method"], "/rpc/test");
            send_result(&mut socket, &rpc_request, json!({ "ok": true }));
        });

        let client = RpcClient::new(
            format!("ws://{addr}/rpc:ws"),
            None,
            Some(SessionAuth {
                username: "cli".into(),
                password: "secret".into(),
            }),
        )
        .unwrap();
        let result = client.call("/rpc/test", json!({})).unwrap();
        assert_eq!(result["ok"], true);
        server.join().unwrap();
    }

    #[test]
    fn json_stream_delivers_results_and_end() {
        let listener = match std::net::TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => listener,
            Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => return,
            Err(error) => panic!("failed to bind local test listener: {error}"),
        };
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut socket = tungstenite::accept(stream).unwrap();
            let request = read_request(&mut socket);
            assert_eq!(request["method"], "/rpc/chat.streamChatUsage");
            assert_eq!(request["params"]["agentId"], "agent-1");
            socket
                .send(Message::Text(Utf8Bytes::from(
                    json!({
                        "jsonrpc": "2.0",
                        "id": request["id"],
                        "stream": "data",
                        "result": { "status": "success", "contextLength": 42 }
                    })
                    .to_string(),
                )))
                .unwrap();
            socket
                .send(Message::Text(Utf8Bytes::from(
                    json!({
                        "jsonrpc": "2.0",
                        "id": request["id"],
                        "stream": "end"
                    })
                    .to_string(),
                )))
                .unwrap();
        });

        let client = RpcClient::new(format!("ws://{addr}/rpc:ws"), None, None).unwrap();
        let stream = client.spawn_json_stream(
            "/rpc/chat.streamChatUsage",
            json!({ "agentId": "agent-1" }),
        );
        match stream.rx.recv_timeout(Duration::from_secs(2)).unwrap() {
            JsonStreamItem::Data { value, latency_ms } => {
                assert_eq!(value["contextLength"], 42);
                assert!(latency_ms.is_some());
            }
            other => panic!("unexpected stream item: {other:?}"),
        }
        assert!(matches!(
            stream.rx.recv_timeout(Duration::from_secs(2)).unwrap(),
            JsonStreamItem::Ended
        ));
        server.join().unwrap();
    }

    fn read_request<S: std::io::Read + std::io::Write>(
        socket: &mut tungstenite::WebSocket<S>,
    ) -> Value {
        let message = socket.read().unwrap();
        let Message::Text(text) = message else {
            panic!("unexpected websocket message: {message:?}");
        };
        serde_json::from_str(&text).unwrap()
    }

    fn send_result<S: std::io::Read + std::io::Write>(
        socket: &mut tungstenite::WebSocket<S>,
        request: &Value,
        result: Value,
    ) {
        socket
            .send(Message::Text(Utf8Bytes::from(
                json!({
                    "jsonrpc": "2.0",
                    "id": request["id"],
                    "result": result,
                })
                .to_string(),
            )))
            .unwrap();
    }
}
