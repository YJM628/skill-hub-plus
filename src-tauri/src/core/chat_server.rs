use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

// Import Claude CLI module
use crate::core::claude_cli::find_claude_cli;

const CHAT_SERVER_ADDR: &str = "127.0.0.1:19824";

// ── Request / Response types ──

#[derive(Debug, Deserialize)]
struct ChatRequest {
    session_id: String,
    content: String,
    model: Option<String>,
    system_context: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GetMessagesRequest {
    session_id: String,
}

#[derive(Debug, Serialize)]
struct GetMessagesResponse {
    messages: Vec<ChatMessage>,
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

// ── Streaming using Claude CLI ──

/// Stream response using Claude CLI
#[allow(dead_code)]
fn stream_claude_cli(
    cli_path: &PathBuf,
    model: &str,
    messages: &[ChatMessage],
    writer: &mut impl Write,
) -> Result<String> {
    let mut accumulated_text = String::new();

    // Build prompt from messages
    let prompt: String = messages
        .iter()
        .map(|m| format!("{}: {}", m.role, m.content))
        .collect::<Vec<_>>()
        .join("\n\n");

    // Start Claude CLI process with streaming output
    let mut child = Command::new(cli_path)
        .arg("chat")
        .arg("--model")
        .arg(model)
        .arg("--format")
        .arg("json")
        .arg("--stream")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to start Claude CLI: {}", e))?;

    // Send prompt to stdin
    if let Some(mut stdin) = child.stdin.take() {
        writeln!(stdin, "{}", prompt)
            .map_err(|e| anyhow::anyhow!("Failed to write to Claude CLI stdin: {}", e))?;
    }

    // Read stdout line by line
    if let Some(stdout) = child.stdout.take() {
        let reader = std::io::BufReader::new(stdout);
        
        for line_result in reader.lines() {
            let line = match line_result {
                Ok(l) => l,
                Err(e) => {
                    log::warn!("[chat] Failed to read Claude CLI output: {}", e);
                    break;
                }
            };

            // Parse JSON output from Claude CLI
            if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
                    match event_type {
                        "text" => {
                            if let Some(text) = event.get("text").and_then(|t| t.as_str()) {
                                accumulated_text.push_str(text);
                                let sse = format_sse("text", text);
                                let _ = writer.write_all(sse.as_bytes());
                                let _ = writer.flush();
                            }
                        }
                        "status" => {
                            let status_data = event.get("data").unwrap_or(&event);
                            let sse = format_sse("status", &status_data.to_string());
                            let _ = writer.write_all(sse.as_bytes());
                            let _ = writer.flush();
                        }
                        "tool_use" => {
                            let sse = format_sse("tool_use", &event.to_string());
                            let _ = writer.write_all(sse.as_bytes());
                            let _ = writer.flush();
                        }
                        "tool_result" => {
                            let sse = format_sse("tool_result", &event.to_string());
                            let _ = writer.write_all(sse.as_bytes());
                            let _ = writer.flush();
                        }
                        "error" => {
                            let error_msg = event.get("error")
                                .and_then(|e| e.as_str())
                                .unwrap_or("Unknown error");
                            let sse = format_sse("error", error_msg);
                            let _ = writer.write_all(sse.as_bytes());
                            let _ = writer.flush();
                        }
                        "done" => {
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Wait for process to complete
    let status = child.wait()
        .map_err(|e| anyhow::anyhow!("Failed to wait for Claude CLI: {}", e))?;

    if !status.success() {
        // Read stderr for error message
        if let Some(mut stderr) = child.stderr.take() {
            let mut error_output = String::new();
            let _ = stderr.read_to_string(&mut error_output);
            log::warn!("[chat] Claude CLI exited with error: {}", error_output);
        }
        anyhow::bail!("Claude CLI exited with non-zero status: {:?}", status.code());
    }

    Ok(accumulated_text)
}

// ── Streaming Claude CLI response ──

fn stream_claude_response_via_cli(
    claude_path: &std::path::Path,
    prompt: &str,
    model: Option<&str>,
    working_dir: Option<&std::path::Path>,
    session_store: &Arc<SessionStore>,
    session_id: &str,
    system_context: Option<&str>,
) -> Result<os_pipe::PipeReader> {
    // Create a pipe for SSE streaming
    let (reader, mut writer) = os_pipe::pipe()?;

    let session_store_clone = Arc::clone(session_store);
    let session_id_clone = session_id.to_string();
    let claude_path_clone = claude_path.to_path_buf();
    let model_clone = model.map(|m| m.to_string());
    let working_dir_clone = working_dir.map(|d| d.to_path_buf());

    // Build the full prompt by prepending system_context if provided
    let full_prompt = match system_context {
        Some(ctx) if !ctx.is_empty() => format!("[System Context]\n{}\n\n[User Message]\n{}", ctx, prompt),
        _ => prompt.to_string(),
    };

    // Spawn a thread to handle Claude CLI and write SSE events
    thread::spawn(move || {
        let mut accumulated_text = String::new();

        // Build Claude CLI command
        let mut cmd = std::process::Command::new(&claude_path_clone);
        
        // Set working directory if provided
        if let Some(dir) = &working_dir_clone {
            cmd.current_dir(dir);
        }

        // Build arguments - using the Node.js SDK query approach
        // We'll invoke claude with a simple query mode
        cmd.arg("ask")
            .arg("--json")
            .arg(&full_prompt);

        if let Some(m) = &model_clone {
            cmd.arg("--model").arg(m);
        }

        // Set environment variables
        if let Some(home) = dirs::home_dir() {
            cmd.env("HOME", &home);
            cmd.env("USERPROFILE", &home);
        }

        log::info!("[chat] Starting Claude CLI: {:?}", cmd);

        match cmd.stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
        {
            Ok(mut child) => {
                // Read stdout line by line
                if let Some(stdout) = child.stdout.take() {
                    use std::io::BufRead;
                    let reader = std::io::BufReader::new(stdout);
                    
                    for line_result in reader.lines() {
                        match line_result {
                            Ok(line) => {
                                // Try to parse as JSON (Claude CLI output format)
                                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
                                    let event_type = event.get("type")
                                        .and_then(|t| t.as_str())
                                        .unwrap_or("");
                                    
                                    match event_type {
                                        "text" => {
                                            if let Some(text) = event.get("text").and_then(|t| t.as_str()) {
                                                accumulated_text.push_str(text);
                                                let sse = format_sse("text", text);
                                                let _ = writer.write_all(sse.as_bytes());
                                                let _ = writer.flush();
                                            }
                                        }
                                        "status" => {
                                            let data = event.get("data").unwrap_or(&event);
                                            let sse = format_sse("status", &data.to_string());
                                            let _ = writer.write_all(sse.as_bytes());
                                            let _ = writer.flush();
                                        }
                                        "error" => {
                                            let error_msg = event.get("error")
                                                .and_then(|e| e.as_str())
                                                .unwrap_or("Unknown error");
                                            let sse = format_sse("error", error_msg);
                                            let _ = writer.write_all(sse.as_bytes());
                                            let _ = writer.flush();
                                        }
                                        "done" => {
                                            break;
                                        }
                                        _ => {}
                                    }
                                } else {
                                    // If not JSON, treat as plain text output
                                    if !line.trim().is_empty() {
                                        accumulated_text.push_str(&line);
                                        accumulated_text.push('\n');
                                        let sse = format_sse("text", &line);
                                        let _ = writer.write_all(sse.as_bytes());
                                        let _ = writer.flush();
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!("[chat] Failed to read line from Claude CLI: {}", e);
                                break;
                            }
                        }
                    }
                }

                // Wait for process to complete
                let status = child.wait();
                match status {
                    Ok(s) if s.success() => {
                        log::info!("[chat] Claude CLI completed successfully");
                    }
                    Ok(s) => {
                        log::warn!("[chat] Claude CLI exited with status: {:?}", s.code());
                    }
                    Err(e) => {
                        log::error!("[chat] Failed to wait for Claude CLI: {}", e);
                    }
                }

                // Send done event
                let done_sse = format_sse("done", "");
                let _ = writer.write_all(done_sse.as_bytes());
                let _ = writer.flush();
                drop(writer);

                // Save assistant response to session
                if !accumulated_text.is_empty() {
                    session_store_clone.add_message(
                        &session_id_clone,
                        "assistant",
                        &accumulated_text.trim(),
                    );
                }
            }
            Err(e) => {
                log::error!("[chat] Failed to spawn Claude CLI: {}", e);
                let error_sse = format_sse("error", &format!("Failed to spawn Claude CLI: {}", e));
                let done_sse = format_sse("done", "");
                let _ = writer.write_all(error_sse.as_bytes());
                let _ = writer.write_all(done_sse.as_bytes());
                let _ = writer.flush();
                drop(writer);
            }
        }
    });

    Ok(reader)
}

// ── Streaming Anthropic API call ──

fn stream_anthropic_response(
    api_key: &str,
    base_url: Option<&str>,
    model: &str,
    messages: &[ChatMessage],
    system_context: Option<&str>,
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

    // Merge system_context with any existing system prompt from messages
    let merged_system = match (system_prompt, system_context) {
        (Some(existing), Some(ctx)) if !ctx.is_empty() => Some(format!("{}\n\n{}", ctx, existing)),
        (Some(existing), _) => Some(existing),
        (None, Some(ctx)) if !ctx.is_empty() => Some(ctx.to_string()),
        _ => None,
    };

    if let Some(system) = merged_system {
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

// ── Handle GET /api/chat/messages request ──

fn handle_get_messages_request(
    mut request: tiny_http::Request,
    session_store: Arc<SessionStore>,
) {
    // Parse query parameters
    let url = request.url().to_string();
    let query_params: std::collections::HashMap<String, String> = url
        .split('?')
        .nth(1)
        .map(|q| {
            q.split('&')
                .filter_map(|pair| {
                    let mut parts = pair.splitn(2, '=');
                    Some((parts.next()?.to_string(), parts.next()?.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();

    let session_id = match query_params.get("session_id") {
        Some(id) if !id.is_empty() => id.clone(),
        _ => {
            let response = tiny_http::Response::from_string(
                r#"{"error": "Missing session_id parameter"}"#,
            )
            .with_status_code(400)
            .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
            let _ = request.respond(response);
            return;
        }
    };

    // Get messages from session store
    let messages = session_store.get_messages(&session_id);

    // Convert messages to response format
    let response_body = match serde_json::to_string(&GetMessagesResponse { messages }) {
        Ok(json) => json,
        Err(err) => {
            log::warn!("[chat] Failed to serialize messages: {}", err);
            let error_response = tiny_http::Response::from_string(
                r#"{"error": "Failed to serialize messages"}"#,
            )
            .with_status_code(500)
            .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap());
            let _ = request.respond(error_response);
            return;
        }
    };

    let response = tiny_http::Response::from_string(response_body)
        .with_status_code(200)
        .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap())
        .with_header("Access-Control-Allow-Origin: *".parse::<tiny_http::Header>().unwrap());
    let _ = request.respond(response);
}

// ── Handle a single chat request ──

fn handle_chat_request(
    mut request: tiny_http::Request,
    session_store: Arc<SessionStore>,
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

    // Try to use Claude CLI first, fall back to direct API
    let claude_cli_path: Option<std::path::PathBuf> = find_claude_cli();
    
    if let Some(ref claude_path) = claude_cli_path {
        let path_display: std::path::Display<'_> = claude_path.display();
        log::info!("[chat] Using Claude CLI at: {:?}", path_display);
        
        // Use Claude CLI
        match stream_claude_response_via_cli(&claude_path, &chat_req.content, Some(&model), None, &session_store, &chat_req.session_id, chat_req.system_context.as_deref()) {
            Ok(reader) => {
                // Respond with SSE stream from Claude CLI
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
                return;
            }
            Err(e) => {
                log::warn!("[chat] Claude CLI failed, falling back to direct API: {}", e);
                // Fall through to direct API
            }
        }
    }

    // Call Anthropic API with streaming (fallback)
    match stream_anthropic_response(&api_key, base_url.as_deref(), &model, &messages, chat_req.system_context.as_deref()) {
        Ok(api_response) => {
            // Create a streaming response using tiny_http's streaming capability
            // We use a pipe: write SSE data to one end, tiny_http reads from the other
            let (reader, mut writer) = os_pipe::pipe().unwrap();

            let session_store_clone = Arc::clone(&session_store);
            let session_id_clone = chat_req.session_id.clone();

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
                    session_store_clone.add_message(
                        &session_id_clone,
                        "assistant",
                        &accumulated_text,
                    );
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
        for request in server.incoming_requests() {
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

            // Handle GET /api/chat/messages for retrieving history
            if method == "GET" {
                if path == "/api/chat/messages" {
                    let store = Arc::clone(&session_store);
                    thread::spawn(move || {
                        handle_get_messages_request(request, store);
                    });
                } else {
                    let response = tiny_http::Response::from_string("Not Found")
                        .with_status_code(404);
                    let _ = request.respond(response);
                }
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
                handle_chat_request(request, store);
            });
        }
    });

    Ok(())
}
