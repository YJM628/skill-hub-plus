use anyhow::{Context, Result};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Detect Claude CLI executable path
/// Searches in common installation locations and PATH
pub fn find_claude_cli() -> Option<PathBuf> {
    // Common installation paths
    let common_paths = vec![
        // npm global
        dirs::home_dir()?.join(".npm-global").join("bin").join("claude"),
        dirs::home_dir()?.join(".local").join("bin").join("claude"),
        // Claude-specific
        dirs::home_dir()?.join(".claude").join("bin").join("claude"),
        // System paths
        PathBuf::from("/usr/local/bin/claude"),
        PathBuf::from("/opt/homebrew/bin/claude"),
        PathBuf::from("/usr/bin/claude"),
    ];

    // Check common paths first
    for path in &common_paths {
        if path.exists() && is_executable(path) {
            log::info!("[claude-cli] Found Claude CLI at: {:?}", path);
            return Some(path.clone());
        }
    }

    // Fall back to PATH
    if let Ok(output) = Command::new("which").arg("claude").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let path = PathBuf::from(&path_str);
            if is_executable(&path) {
                log::info!("[claude-cli] Found Claude CLI in PATH: {:?}", path);
                return Some(path);
            }
        }
    }

    log::info!("[claude-cli] Claude CLI not found, will use direct API");
    None
}

/// Check if a file is executable
fn is_executable(path: &Path) -> bool {
    path.exists() && (path.metadata().map(|m| !m.is_dir()).unwrap_or(false))
}

/// Verify Claude CLI is working by running --version
#[allow(dead_code)]
pub fn verify_claude_cli(path: &Path) -> bool {
    match Command::new(path)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout);
                log::info!("[claude-cli] Claude CLI version: {}", version.trim());
                true
            } else {
                log::warn!("[claude-cli] Claude CLI --version failed: {}", output.status);
                false
            }
        }
        Err(e) => {
            log::warn!("[claude-cli] Failed to run Claude CLI: {}", e);
            false
        }
    }
}

/// Stream response from Claude CLI
/// Returns stdout for streaming output
#[allow(dead_code)]
pub fn stream_claude_response(
    claude_path: &Path,
    prompt: &str,
    model: Option<&str>,
    working_dir: Option<&Path>,
) -> Result<std::process::ChildStdout> {
    let mut cmd = Command::new(claude_path);

    // Set working directory if provided
    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Build arguments
    cmd.arg("ask")
        .arg("--json") // Request JSON output for easier parsing
        .arg(prompt);

    // Add model if specified
    if let Some(m) = model {
        cmd.arg("--model").arg(m);
    }

    // Set environment variables for Claude CLI to use user config
    // This allows it to read ~/.claude/settings.json
    if let Some(home) = dirs::home_dir() {
        cmd.env("HOME", &home);
        cmd.env("USERPROFILE", &home);
    }

    log::info!("[claude-cli] Starting Claude CLI with command: {:?}", cmd);

    let child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn Claude CLI process")?;

    child.stdout.ok_or_else(|| anyhow::anyhow!("Failed to capture Claude CLI stdout"))
}

/// Parse Claude CLI JSON output and convert to SSE format
#[allow(dead_code)]
pub fn parse_claude_output(line: &str) -> Option<ClaudeSSEEvent> {
    // Claude CLI output format: {"type": "...", "data": "..."}
    if let Ok(value) = serde_json::from_str::<Value>(line) {
        let event_type = value.get("type")?.as_str()?;
        let data = value.get("data")?.as_str().unwrap_or("").to_string();

        Some(ClaudeSSEEvent {
            event_type: event_type.to_string(),
            data,
        })
    } else {
        None
    }
}

/// SSE event from Claude CLI
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ClaudeSSEEvent {
    pub event_type: String,
    pub data: String,
}

impl ClaudeSSEEvent {
    /// Format as SSE line
    #[allow(dead_code)]
    pub fn to_sse(&self) -> String {
        let event = serde_json::json!({
            "type": self.event_type,
            "data": self.data
        });
        format!("data: {}\n\n", event)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_claude_cli() {
        let path = find_claude_cli();
        println!("Claude CLI path: {:?}", path);
    }

    #[test]
    fn test_parse_claude_output() {
        let line = r#"{"type":"text","data":"Hello"}"#;
        let event = parse_claude_output(line);
        assert!(event.is_some());
        assert_eq!(event.unwrap().event_type, "text");
    }
}