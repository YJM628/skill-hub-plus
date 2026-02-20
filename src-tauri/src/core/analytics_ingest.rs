use anyhow::Result;
use serde::Deserialize;
use std::sync::Arc;
use std::thread;
use crate::core::analytics_store::{AnalyticsStore, SkillEventRow};
use crate::core::analytics_alert::AlertDetector;

const INGEST_ADDR: &str = "127.0.0.1:19823";

#[derive(Debug, Deserialize)]
struct IngestRequest {
    events: Vec<IngestEvent>,
}

#[derive(Debug, Deserialize)]
struct IngestEvent {
    event_type: String,
    skill_id: String,
    timestamp: String,
    user_id: String,
    session_id: String,
    input_hash: Option<String>,
    success: bool,
    duration_ms: Option<i64>,
    error: Option<String>,
    feedback_score: Option<i32>,
    cost: Option<IngestCost>,
    caller: Option<IngestCaller>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct IngestCost {
    token_input: Option<i64>,
    token_output: Option<i64>,
    api_cost_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct IngestCaller {
    agent_id: Option<String>,
    workflow_id: Option<String>,
    tool_key: Option<String>,
}

impl IngestEvent {
    fn to_row(&self) -> SkillEventRow {
        let timestamp_epoch = chrono::DateTime::parse_from_rfc3339(&self.timestamp)
            .map(|dt| dt.timestamp())
            .unwrap_or_else(|_| {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64
            });

        SkillEventRow {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: self.event_type.clone(),
            skill_id: self.skill_id.clone(),
            timestamp: timestamp_epoch,
            user_id: self.user_id.clone(),
            session_id: self.session_id.clone(),
            input_hash: self.input_hash.clone(),
            success: self.success,
            duration_ms: self.duration_ms,
            error: self.error.clone(),
            feedback_score: self.feedback_score,
            token_input: self.cost.as_ref().and_then(|c| c.token_input),
            token_output: self.cost.as_ref().and_then(|c| c.token_output),
            api_cost_usd: self.cost.as_ref().and_then(|c| c.api_cost_usd),
            caller_agent: self.caller.as_ref().and_then(|c| c.agent_id.clone()),
            caller_workflow: self.caller.as_ref().and_then(|c| c.workflow_id.clone()),
            caller_tool: self.caller.as_ref().and_then(|c| c.tool_key.clone()),
            metadata_json: self.metadata.as_ref().map(|m| m.to_string()),
        }
    }
}

/// 启动 HTTP Ingest Server（在独立线程中运行）
/// 监听 127.0.0.1:19823，仅接受本机请求
pub fn start_ingest_server(store: Arc<AnalyticsStore>) -> Result<()> {
    let server = tiny_http::Server::http(INGEST_ADDR)
        .map_err(|e| anyhow::anyhow!("Failed to start ingest server: {}", e))?;

    log::info!("[analytics] Ingest server listening on {}", INGEST_ADDR);

    thread::spawn(move || {
        for mut request in server.incoming_requests() {
            let path = request.url().to_string();
            let method = request.method().to_string();

            // Handle GET requests for analytics queries
            if method == "GET" && path.starts_with("/v1/analytics/") {
                let query_path = path.strip_prefix("/v1/analytics/").unwrap();
                let request_url = request.url().parse::<url::Url>().unwrap_or_else(|_| {
                    url::Url::parse(&format!("http://{}{}", INGEST_ADDR, path)).unwrap()
                });
                
                let response_body = match query_path {
                    "overview" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(7);
                        match store.get_overview(days) {
                            Ok(overview) => serde_json::to_string(&overview),
                            Err(_) => serde_json::to_string(&serde_json::json!({"error": "Failed to fetch overview"})),
                        }
                    }
                    "top_skills" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(7);
                        let limit = request_url.query_pairs()
                            .find(|(k, _)| k == "limit")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(10);
                        serde_json::to_string(&store.get_top_skills(days, limit).unwrap_or_default())
                    }
                    "daily_trend" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(30);
                        serde_json::to_string(&store.get_daily_trend(days).unwrap_or_default())
                    }
                    "success_rate" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(30);
                        let skill_id = request_url.query_pairs()
                            .find(|(k, _)| k == "skill_id")
                            .map(|(_, v)| v.to_string());
                        serde_json::to_string(&store.get_success_rate_trend(skill_id.as_deref(), days).unwrap_or_default())
                    }
                    "cost_summary" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(30);
                        serde_json::to_string(&store.get_cost_summary(days).unwrap_or_default())
                    }
                    "caller_analysis" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(30);
                        serde_json::to_string(&store.get_caller_analysis(days).unwrap_or_default())
                    }
                    "user_retention" => {
                        let days = request_url.query_pairs()
                            .find(|(k, _)| k == "days")
                            .and_then(|(_, v)| v.parse::<i64>().ok())
                            .unwrap_or(30);
                        serde_json::to_string(&store.get_user_retention(days).unwrap_or_default())
                    }
                    "alerts" => {
                        serde_json::to_string(&store.get_active_alerts().unwrap_or_default())
                    }
                    _ => {
                        let response = tiny_http::Response::from_string("Not Found")
                            .with_status_code(404);
                        let _ = request.respond(response);
                        continue;
                    }
                };

                let response = tiny_http::Response::from_string(response_body.unwrap())
                    .with_status_code(200)
                    .with_header(
                        "Content-Type: application/json"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                let _ = request.respond(response);
                continue;
            }

            // Only accept POST /v1/events
            if method != "POST" || path != "/v1/events" {
                let response = tiny_http::Response::from_string("Not Found")
                    .with_status_code(404);
                let _ = request.respond(response);
                continue;
            }

            // Read body
            let mut body = String::new();
            if let Err(err) = request.as_reader().read_to_string(&mut body) {
                log::warn!("[analytics] Failed to read request body: {}", err);
                let response = tiny_http::Response::from_string("Bad Request")
                    .with_status_code(400);
                let _ = request.respond(response);
                continue;
            }

            // Parse JSON
            let ingest_req: IngestRequest = match serde_json::from_str(&body) {
                Ok(req) => req,
                Err(err) => {
                    log::warn!("[analytics] Invalid JSON: {}", err);
                    let response = tiny_http::Response::from_string(
                        format!("{{\"error\": \"Invalid JSON: {}\"}}", err),
                    )
                    .with_status_code(400)
                    .with_header(
                        "Content-Type: application/json"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = request.respond(response);
                    continue;
                }
            };

            // Convert and insert
            let rows: Vec<SkillEventRow> = ingest_req
                .events
                .iter()
                .map(|e| e.to_row())
                .collect();

            let skill_ids: Vec<String> = rows.iter().map(|r| r.skill_id.clone()).collect();

            match store.insert_events(&rows) {
                Ok(count) => {
                    log::info!("[analytics] Ingested {} events", count);

                    // Run alert checks for affected skills
                    let unique_skills: std::collections::HashSet<_> = skill_ids.into_iter().collect();
                    for sid in &unique_skills {
                        if let Err(err) = AlertDetector::run_checks(&store, sid) {
                            log::warn!("[analytics] Alert check failed for {}: {}", sid, err);
                        }
                    }

                    let response_body = format!("{{\"accepted\": {}}}", count);
                    let response = tiny_http::Response::from_string(response_body)
                        .with_status_code(200)
                        .with_header(
                            "Content-Type: application/json"
                                .parse::<tiny_http::Header>()
                                .unwrap(),
                        );
                    let _ = request.respond(response);
                }
                Err(err) => {
                    log::error!("[analytics] Failed to insert events: {}", err);
                    let response = tiny_http::Response::from_string(
                        format!("{{\"error\": \"Internal error: {}\"}}", err),
                    )
                    .with_status_code(500)
                    .with_header(
                        "Content-Type: application/json"
                            .parse::<tiny_http::Header>()
                            .unwrap(),
                    );
                    let _ = request.respond(response);
                }
            }
        }
    });

    Ok(())
}