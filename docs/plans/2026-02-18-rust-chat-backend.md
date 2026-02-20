# Rust Chat Backend (Tauri Native) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** Replace the Next.js `/api/chat` backend with a native Rust HTTP server inside Tauri, so the ChatPanel can communicate with Anthropic API without any external Node.js process.

**Architecture:** A `tiny_http` server (same pattern as the existing `analytics_ingest.rs`) listens on `127.0.0.1:19824` and exposes `POST /api/chat`. It receives `{session_id, content, model}`, calls the Anthropic Messages API via `reqwest` with streaming enabled, and returns SSE-formatted chunks. The frontend `useChatStreaming.ts` hook already uses `fetch()` + `ReadableStream` to consume SSE — it only needs its `apiEndpoint` pointed to the Rust server. A Vite dev proxy forwards `/api/chat` to the Rust server during development.

**Tech Stack:** Rust (`reqwest` streaming, `tiny_http`, `serde_json`), existing Tauri app infrastructure, Vite proxy config.

**Key Design Decisions:**
- This implementation covers **direct Anthropic API streaming** (equivalent to `ai-client.ts`), NOT the full Claude Code SDK (`claude-client.ts`) which requires Node.js. The Claude Code SDK features (MCP servers, tool_use loops, permission system) are out of scope for this task.
- The Rust server reads API key from environment variables (`ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`) or from `~/.claude/settings.json` as fallback.
- Session management is in-memory (HashMap), matching the original `session-store.ts` pattern.
- The server runs on a background thread, started during Tauri `setup()`, same as `analytics_ingest`.

---

### Task 1: Create the Rust Chat Server Module

**Files:**
- Create: `src-tauri/src/core/chat_server.rs`
- Modify: `src-tauri/src/core/mod.rs`
- Modify: `src-tauri/Cargo.toml` (no new deps needed — `reqwest`, `serde_json`, `tiny_http`, `uuid`, `dirs` already present)

**Step 1: Add module declaration to `mod.rs`**

In `src-tauri/src/core/mod.rs`, add:

```rust
pub mod chat_server;
```

**Step 2: Create `chat_server.rs` with the following structure**

```rust
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex};
use std::thread;

const CHAT_SERVER_ADDR: &str = "127.0.0.1:19824";

// ── Request / Response types ──

#[derive(Debug, Deserialize)]
struct ChatRequest {
    session_id: String,
    content: String,
    model: Option<String>,
}

#[derive(Debug, Serialize)]
struct SseEvent {
    #[serde(rename = "type")]
    event_type: String,
    data: String,
}

// ── Session store (in-memory) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

struct SessionStore {
    sessions: Mutex<HashMap<String, Vec<ChatMessage>>>,
}

impl SessionStore {
    fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn add_message(&self, session_id: &str, role: &str, content: &str) {
        let mut sessions = self.sessions.lock().unwrap();
        let messages = sessions.entry(session_id.to_string()).or_default();
        messages.push(ChatMessage {
            role: role.to_string(),
            content: content.to_string(),
        });
    }

    fn get_messages(&self, session_id: &str) -> Vec<ChatMessage> {
        let sessions = self.sessions.lock().unwrap();
        sessions.get(session_id).cloned().unwrap_or_default()
    }
}

// ── API key resolution ──

fn resolve_api_key() -> Option<(String, Option<String>)> {
    // 1. Environment variables
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        let base_url = std::env::var("ANTHROPIC_BASE_URL").ok();
        return Some((key, base_url));
    }
    if let Ok(key) = std::env::var("ANTHROPIC_AUTH_TOKEN") {
        let base_url = std::env::var("ANTHROPIC_BASE_URL").ok();
        return Some((key, base_url));
    }

    // 2. ~/.claude/settings.json fallback
    if let Some(home) = dirs::home_dir() {
        let settings_path = home.join(".claude").join("settings.json");
        if let Ok(content) = std::fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) {
                // Try root level
                let api_key = settings.get("api_key")
                    .or_else(|| settings.get("auth_token"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                // Try env object
                let api_key = api_key.or_else(|| {
                    settings.get("env").and_then(|env| {
                        env.get("ANTHROPIC_API_KEY")
                            .or_else(|| env.get("ANTHROPIC_AUTH_TOKEN"))
                            .and_then(|v| v.as_str())
                            .map(String::from)
                    })
                });

                if let Some(key) = api_key {
                    let base_url = settings.get("base_url")
                        .and_then(|v| v.as_str())
                        .map(String::from)
                        .or_else(|| {
                            settings.get("env")
                                .and_then(|env| env.get("ANTHROPIC_BASE_URL"))
                                .and_then(|v| v.as_str())
                                .map(String::from)
                        });
                    return Some((key, base_url));
                }
            }
        }
    }

    None
}

// ── SSE formatting ──

fn format_sse(event_type: &str, data: &str) -> String {
    let event = SseEvent {
        event_type: event_type.to_string(),
        data: data.to_string(),
    };
    format!("data: {}\n\n", serde_json::to_string(&event).unwrap())
}

// ── Streaming Anthropic API call ──

fn stream_anthropic_response(
    api_key: &str,
    base_url: Option<&str>,
    model: &str,
    messages: &[ChatMessage],
) -> Result<reqwest::blocking::Response> {
    let url = format!(
        "{}/v1/messages",
        base_url.unwrap_or("https://api.anthropic.com")
    );

    // Build the messages array (filter out system messages for the body)
    let system_prompt: Option<String> = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());

    let api_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "stream": true,
        "messages": api_messages,
    });

    if let Some(system) = system_prompt {
        body["system"] = serde_json::Value::String(system);
    }

    let client = reqwest::blocking::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .body(body.to_string())
        .send()?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().unwrap_or_default();
        anyhow::bail!("Anthropic API error ({}): {}", status, error_body);
    }

    Ok(response)
}

// ── Parse Anthropic SSE events and re-emit in our format ──

fn process_anthropic_stream(
    response: reqwest::blocking::Response,
    writer: &mut dyn std::io::Write,
) -> Result<()> {
    let reader = std::io::BufReader::new(response);
    let mut buffer = String::new();

    use std::io::BufRead;
    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                log::warn!("[chat] Stream read error: {}", e);
                break;
            }
        };

        // Anthropic SSE format: "event: <type>\ndata: <json>\n\n"
        if line.starts_with("data: ") {
            let data = &line[6..];

            if data == "[DONE]" {
                break;
            }

            match serde_json::from_str::<serde_json::Value>(data) {
                Ok(event) => {
                    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    match event_type {
                        "content_block_delta" => {
                            if let Some(delta) = event.get("delta") {
                                if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                    let sse = format_sse("text", text);
                                    let _ = writer.write_all(sse.as_bytes());
                                    let _ = writer.flush();
                                }
                            }
                        }
                        "message_delta" => {
                            // Contains stop_reason and usage
                            if let Some(usage) = event.get("usage") {
                                let usage_str = serde_json::to_string(usage).unwrap_or_default();
                                let sse = format_sse("usage", &usage_str);
                                let _ = writer.write_all(sse.as_bytes());
                                let _ = writer.flush();
                            }
                        }
                        "message_start" => {
                            // Extract model info for status
                            if let Some(message) = event.get("message") {
                                let model = message.get("model")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("unknown");
                                let status = serde_json::json!({
                                    "session_id": "rust-native",
                                    "model": model,
                                });
                                let sse = format_sse("status", &status.to_string());
                                let _ = writer.write_all(sse.as_bytes());
                                let _ = writer.flush();
                            }
                        }
                        "message_stop" => {
                            // Final usage stats
                        }
                        "error" => {
                            let error_msg = event.get("error")
                                .and_then(|e| e.get("message"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown API error");
                            let sse = format_sse("error", error_msg);
                            let _ = writer.write_all(sse.as_bytes());
                            let _ = writer.flush();
                        }
                        _ => {
                            // Ignore other event types (ping, content_block_start, etc.)
                        }
                    }
                }
                Err(_) => {
                    // Skip malformed JSON
                }
            }
        }
    }

    // Send done event
    let done_sse = format_sse("done", "");
    let _ = writer.write_all(done_sse.as_bytes());
    let _ = writer.flush();

    Ok(())
}

// ── Handle a single chat request ──

fn handle_chat_request(
    request: &mut tiny_http::Request,
    session_store: &SessionStore,
) {
    // Read body
    let mut body = String::new();
    if let Err(err) = request.as_reader().read_to_string(&mut body) {
        log::warn!("[chat] Failed to read request body: {}", err);
        let response = tiny_http::Response::from_string(
            r#"{"error": "Failed to read request body"}"#,
        )
        .with_status_code(400)
        .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
        let _ = request.respond(response);
        return;
    }

    // Parse request
    let chat_req: ChatRequest = match serde_json::from_str(&body) {
        Ok(req) => req,
        Err(err) => {
            let error_json = format!(r#"{{"error": "Invalid JSON: {}"}}"#, err);
            let response = tiny_http::Response::from_string(error_json)
                .with_status_code(400)
                .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
            let _ = request.respond(response);
            return;
        }
    };

    // Validate required fields
    if chat_req.session_id.is_empty() || chat_req.content.is_empty() {
        let response = tiny_http::Response::from_string(
            r#"{"error": "Missing session_id or content"}"#,
        )
        .with_status_code(400)
        .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
        let _ = request.respond(response);
        return;
    }

    // Resolve API key
    let (api_key, base_url) = match resolve_api_key() {
        Some(pair) => pair,
        None => {
            let error_msg = "Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable or configure ~/.claude/settings.json";
            let error_json = format!(r#"{{"error": "{}"}}"#, error_msg);
            let response = tiny_http::Response::from_string(error_json)
                .with_status_code(500)
                .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
            let _ = request.respond(response);
            return;
        }
    };

    // Add user message to session
    session_store.add_message(&chat_req.session_id, "user", &chat_req.content);
    let messages = session_store.get_messages(&chat_req.session_id);

    let model = chat_req.model.unwrap_or_else(|| "claude-sonnet-4-20250514".to_string());

    // Call Anthropic API with streaming
    match stream_anthropic_response(&api_key, base_url.as_deref(), &model, &messages) {
        Ok(api_response) => {
            // Create a streaming response using tiny_http's streaming capability
            // We use a pipe: write SSE data to one end, tiny_http reads from the other
            let (reader, mut writer) = os_pipe::pipe().unwrap();

            let session_store_clone_id = chat_req.session_id.clone();
            let session_store_ref = session_store as *const SessionStore;

            // Spawn a thread to process the Anthropic stream and write SSE events
            thread::spawn(move || {
                let mut accumulated_text = String::new();

                // We need to intercept text events to accumulate the full response
                let api_reader = std::io::BufReader::new(api_response);
                use std::io::BufRead;

                for line_result in api_reader.lines() {
                    let line = match line_result {
                        Ok(l) => l,
                        Err(_) => break,
                    };

                    if line.starts_with("data: ") {
                        let data = &line[6..];
                        if data == "[DONE]" {
                            break;
                        }

                        if let Ok(event) = serde_json::from_str::<serde_json::Value>(data) {
                            let event_type = event.get("type")
                                .and_then(|t| t.as_str())
                                .unwrap_or("");

                            match event_type {
                                "content_block_delta" => {
                                    if let Some(text) = event.get("delta")
                                        .and_then(|d| d.get("text"))
                                        .and_then(|t| t.as_str())
                                    {
                                        accumulated_text.push_str(text);
                                        let sse = format_sse("text", text);
                                        let _ = writer.write_all(sse.as_bytes());
                                        let _ = writer.flush();
                                    }
                                }
                                "message_start" => {
                                    if let Some(message) = event.get("message") {
                                        let model_name = message.get("model")
                                            .and_then(|m| m.as_str())
                                            .unwrap_or("unknown");
                                        let status = serde_json::json!({
                                            "session_id": "rust-native",
                                            "model": model_name,
                                        });
                                        let sse = format_sse("status", &status.to_string());
                                        let _ = writer.write_all(sse.as_bytes());
                                        let _ = writer.flush();
                                    }
                                }
                                "message_delta" => {
                                    if let Some(usage) = event.get("usage") {
                                        let usage_str = serde_json::to_string(usage).unwrap_or_default();
                                        let sse = format_sse("usage", &usage_str);
                                        let _ = writer.write_all(sse.as_bytes());
                                        let _ = writer.flush();
                                    }
                                }
                                "error" => {
                                    let error_msg = event.get("error")
                                        .and_then(|e| e.get("message"))
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("Unknown API error");
                                    let sse = format_sse("error", error_msg);
                                    let _ = writer.write_all(sse.as_bytes());
                                    let _ = writer.flush();
                                }
                                _ => {}
                            }
                        }
                    }
                }

                // Send done event
                let done_sse = format_sse("done", "");
                let _ = writer.write_all(done_sse.as_bytes());
                let _ = writer.flush();
                drop(writer);

                // Save assistant response to session
                if !accumulated_text.is_empty() {
                    // SAFETY: session_store lives for the entire app lifetime
                    unsafe {
                        (*session_store_ref).add_message(
                            &session_store_clone_id,
                            "assistant",
                            &accumulated_text,
                        );
                    }
                }
            });

            // Respond with SSE stream
            let response = tiny_http::Response::new(
                tiny_http::StatusCode(200),
                vec![
                    "Content-Type: text/event-stream".parse::<tiny_http::Header>().unwrap(),
                    "Cache-Control: no-cache".parse::<tiny_http::Header>().unwrap(),
                    "Connection: keep-alive".parse::<tiny_http::Header>().unwrap(),
                    "Access-Control-Allow-Origin: *".parse::<tiny_http::Header>().unwrap(),
                ],
                reader,
                None,
                None,
            );
            let _ = request.respond(response);
        }
        Err(err) => {
            let error_json = format!(r#"{{"error": "{}"}}"#, err);
            let sse_error = format_sse("error", &err.to_string());
            let sse_done = format_sse("done", "");
            let full_response = format!("{}{}", sse_error, sse_done);

            let response = tiny_http::Response::from_string(full_response)
                .with_status_code(200)
                .with_header("Content-Type: text/event-stream".parse::<tiny_http::Header>().unwrap())
                .with_header("Cache-Control: no-cache".parse::<tiny_http::Header>().unwrap());
            let _ = request.respond(response);
        }
    }
}

// ── Public: start the chat server ──

pub fn start_chat_server() -> Result<()> {
    let server = tiny_http::Server::http(CHAT_SERVER_ADDR)
        .map_err(|e| anyhow::anyhow!("Failed to start chat server: {}", e))?;

    log::info!("[chat] Chat server listening on {}", CHAT_SERVER_ADDR);

    let session_store = Arc::new(SessionStore::new());

    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let path = request.url().to_string();
            let method = request.method().to_string();

            // Handle CORS preflight
            if method == "OPTIONS" {
                let response = tiny_http::Response::from_string("")
                    .with_status_code(204)
                    .with_header("Access-Control-Allow-Origin: *".parse::<tiny_http::Header>().unwrap())
                    .with_header("Access-Control-Allow-Methods: POST, OPTIONS".parse::<tiny_http::Header>().unwrap())
                    .with_header("Access-Control-Allow-Headers: Content-Type".parse::<tiny_http::Header>().unwrap());
                let _ = request.respond(response);
                continue;
            }

            // Only accept POST /api/chat
            if method != "POST" || path != "/api/chat" {
                let response = tiny_http::Response::from_string("Not Found")
                    .with_status_code(404);
                let _ = request.respond(response);
                continue;
            }

            let store = Arc::clone(&session_store);
            // Handle each request in a separate thread for concurrent streaming
            thread::spawn(move || {
                handle_chat_request(&mut request, &store);
            });
        }
    });

    Ok(())
}
```

**Step 3: Verify the module compiles**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Expected: Compilation errors related to `os_pipe` (not yet added)

**Step 4: Add `os_pipe` dependency**

In `src-tauri/Cargo.toml`, add under `[dependencies]`:

```toml
os_pipe = "1"
```

**Step 5: Run cargo check again**

Run: `cd src-tauri && cargo check 2>&1 | head -30`
Expected: PASS (or warnings only)

**Step 6: Commit**

```bash
git add src-tauri/src/core/chat_server.rs src-tauri/src/core/mod.rs src-tauri/Cargo.toml
git commit -m "feat: add Rust chat server module with Anthropic API streaming"
```

---

### Task 2: Wire Chat Server into Tauri Startup

**Files:**
- Modify: `src-tauri/src/lib.rs:38-48` (add chat server startup after analytics server)

**Step 1: Add chat server startup in `lib.rs`**

After the analytics ingest server spawn block (around line 48), add:

```rust
// Start chat server in background
std::thread::spawn(move || {
    if let Err(err) = crate::core::chat_server::start_chat_server() {
        log::error!("[chat] Failed to start chat server: {}", err);
    }
});
```

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | head -20`
Expected: PASS

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: start chat server on Tauri app launch"
```

---

### Task 3: Configure Vite Dev Proxy

**Files:**
- Modify: `vite.config.ts`

**Step 1: Add proxy configuration**

In `vite.config.ts`, inside the `defineConfig` return object, add a `server.proxy` entry:

```typescript
server: {
  proxy: {
    '/api/chat': {
      target: 'http://127.0.0.1:19824',
      changeOrigin: true,
    },
  },
},
```

This ensures that during `npm run dev` or `npm run tauri:dev`, the frontend's `fetch('/api/chat', ...)` calls are proxied to the Rust server.

**Step 2: Verify the config is valid**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: PASS

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add Vite dev proxy for /api/chat to Rust chat server"
```

---

### Task 4: Update Frontend `apiEndpoint` Configuration

**Files:**
- Modify: `src/pages/SkillDetail.tsx` (update `optimizeChatConfig.apiEndpoint`)

**Step 1: Update the apiEndpoint**

In `SkillDetail.tsx`, the `optimizeChatConfig` should use `/api/chat` as the endpoint. Since Vite proxy handles the routing in dev, and in production the Tauri app will need the full URL, update:

```typescript
const optimizeChatConfig = useMemo<ChatPanelConfig>(() => ({
  apiEndpoint: 'http://127.0.0.1:19824/api/chat',
  title: t('optimizationChat'),
  description: t('optimizationWelcomeMessage'),
  placeholder: t('optimizationPromptPlaceholder'),
  suggestions: [
    { value: 'optimize-skill', label: 'Optimize Skill', description: t('optimizationWelcomeMessage') },
  ],
}), [t]);
```

Note: In dev mode, Vite proxy will also work with the relative `/api/chat` path. But using the absolute URL ensures it works in both dev and production (Tauri webview). Choose based on preference — the absolute URL is safer for Tauri.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: PASS

**Step 3: Commit**

```bash
git add src/pages/SkillDetail.tsx
git commit -m "feat: point ChatPanel apiEndpoint to Rust chat server"
```

---

### Task 5: Integration Test — End-to-End Verification

**Files:**
- No file changes — manual testing

**Step 1: Start the Tauri dev server**

Run: `npm run tauri:dev`

**Step 2: Verify chat server is running**

Run (in another terminal): `curl -s http://127.0.0.1:19824/api/chat -X POST -H "Content-Type: application/json" -d '{"session_id":"test-1","content":"Hello","model":"claude-sonnet-4-20250514"}' 2>&1 | head -20`

Expected: SSE stream output with `data: {"type":"status",...}` and `data: {"type":"text",...}` events, or an error about missing API key.

**Step 3: Test in the UI**

1. Navigate to a skill detail page
2. Switch to "Optimize" view mode
3. Type a message in the chat panel
4. Verify streaming response appears

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: integration fixes for Rust chat backend"
```

---

### Task 6: Handle Session Store Thread Safety (Refactor)

**Files:**
- Modify: `src-tauri/src/core/chat_server.rs`

The initial implementation uses raw pointer casting for session store access from the streaming thread. This task refactors it to use `Arc<SessionStore>` properly.

**Step 1: Refactor `handle_chat_request` to accept `Arc<SessionStore>`**

Change the function signature and remove the unsafe block by passing `Arc<SessionStore>` into the streaming thread via `Arc::clone()`.

**Step 2: Verify compilation**

Run: `cd src-tauri && cargo check 2>&1 | head -20`
Expected: PASS

**Step 3: Commit**

```bash
git add src-tauri/src/core/chat_server.rs
git commit -m "refactor: use Arc<SessionStore> for thread-safe session access"
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `src-tauri/src/core/chat_server.rs` | New file: Rust HTTP server with Anthropic API streaming |
| `src-tauri/src/core/mod.rs` | Add `pub mod chat_server;` |
| `src-tauri/Cargo.toml` | Add `os_pipe = "1"` dependency |
| `src-tauri/src/lib.rs` | Start chat server in Tauri `setup()` |
| `vite.config.ts` | Add dev proxy `/api/chat` → `127.0.0.1:19824` |
| `src/pages/SkillDetail.tsx` | Update `apiEndpoint` to point to Rust server |

## Out of Scope (Future Work)

- **Claude Code SDK features**: MCP servers, tool_use loops, permission system, file attachments — these require the Node.js `@anthropic-ai/claude-agent-sdk` and cannot be replicated in Rust
- **Multi-model support**: OpenAI/other providers (currently only Anthropic)
- **Persistent session storage**: Sessions are in-memory and lost on restart
