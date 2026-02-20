use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Analytics 存储层，管理 skill_events / skill_daily_stats / analytics_alerts 三张表
pub struct AnalyticsStore {
    #[allow(dead_code)]
    db_path: PathBuf,
    pub(crate) conn: Mutex<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillEventRow {
    pub id: String,
    pub event_type: String,
    pub skill_id: String,
    pub timestamp: i64,
    pub user_id: String,
    pub session_id: String,
    pub input_hash: Option<String>,
    pub success: bool,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
    pub feedback_score: Option<i32>,
    pub token_input: Option<i64>,
    pub token_output: Option<i64>,
    pub api_cost_usd: Option<f64>,
    pub caller_agent: Option<String>,
    pub caller_workflow: Option<String>,
    pub caller_tool: Option<String>,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub skill_id: String,
    pub date: String,
    pub total_calls: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub p50_ms: Option<i64>,
    pub p95_ms: Option<i64>,
    pub p99_ms: Option<i64>,
    pub avg_ms: Option<f64>,
    pub unique_users: i64,
    pub total_cost_usd: f64,
    pub thumbs_up: i64,
    pub thumbs_down: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsAlert {
    pub id: String,
    pub skill_id: String,
    pub alert_type: String,
    pub severity: String,
    pub message: String,
    pub detected_at: i64,
    pub resolved_at: Option<i64>,
    pub acknowledged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsOverview {
    pub total_calls: i64,
    pub success_rate: f64,
    pub p95_latency_ms: Option<i64>,
    pub active_users: i64,
    pub total_calls_delta_pct: Option<f64>,
    pub success_rate_delta: Option<f64>,
    pub p95_latency_delta_ms: Option<i64>,
    pub active_users_delta: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSkillEntry {
    pub skill_id: String,
    pub call_count: i64,
    pub success_rate: f64,
    pub avg_latency_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallerDependency {
    pub caller_agent: String,
    pub caller_tool: String,
    pub skill_id: String,
    pub call_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRetentionPair {
    pub skill_a: String,
    pub skill_b: String,
    pub users_both: i64,
    pub users_a_only: i64,
    pub retention_rate: f64,
}

impl AnalyticsStore {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;
        let store = Self {
            db_path,
            conn: Mutex::new(conn),
        };
        store.ensure_schema()?;
        Ok(store)
    }

    pub fn ensure_schema(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS skill_events (
                id            TEXT PRIMARY KEY,
                event_type    TEXT NOT NULL,
                skill_id      TEXT NOT NULL,
                timestamp     INTEGER NOT NULL,
                user_id       TEXT NOT NULL,
                session_id    TEXT NOT NULL,
                input_hash    TEXT,
                success       INTEGER NOT NULL DEFAULT 1,
                duration_ms   INTEGER,
                error         TEXT,
                feedback_score INTEGER,
                token_input   INTEGER,
                token_output  INTEGER,
                api_cost_usd  REAL,
                caller_agent  TEXT,
                caller_workflow TEXT,
                caller_tool   TEXT,
                metadata_json TEXT,
                created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            );

            CREATE INDEX IF NOT EXISTS idx_events_skill_ts ON skill_events(skill_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_user ON skill_events(user_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_session ON skill_events(session_id);

            CREATE TABLE IF NOT EXISTS skill_daily_stats (
                skill_id       TEXT NOT NULL,
                date           TEXT NOT NULL,
                total_calls    INTEGER NOT NULL DEFAULT 0,
                success_count  INTEGER NOT NULL DEFAULT 0,
                fail_count     INTEGER NOT NULL DEFAULT 0,
                p50_ms         INTEGER,
                p95_ms         INTEGER,
                p99_ms         INTEGER,
                avg_ms         REAL,
                unique_users   INTEGER NOT NULL DEFAULT 0,
                total_cost_usd REAL DEFAULT 0,
                thumbs_up      INTEGER DEFAULT 0,
                thumbs_down    INTEGER DEFAULT 0,
                PRIMARY KEY (skill_id, date)
            );

            CREATE TABLE IF NOT EXISTS analytics_alerts (
                id          TEXT PRIMARY KEY,
                skill_id    TEXT NOT NULL,
                alert_type  TEXT NOT NULL,
                severity    TEXT NOT NULL,
                message     TEXT NOT NULL,
                detected_at INTEGER NOT NULL,
                resolved_at INTEGER,
                acknowledged INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_skill ON analytics_alerts(skill_id, detected_at);
            ",
        )?;
        Ok(())
    }

    /// 批量插入事件（由 Ingest Server 调用）
    pub fn insert_events(&self, events: &[SkillEventRow]) -> Result<usize> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let tx = conn.unchecked_transaction()?;
        let mut count = 0usize;
        for event in events {
            tx.execute(
                "INSERT OR IGNORE INTO skill_events
                 (id, event_type, skill_id, timestamp, user_id, session_id,
                  input_hash, success, duration_ms, error, feedback_score,
                  token_input, token_output, api_cost_usd,
                  caller_agent, caller_workflow, caller_tool, metadata_json)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
                params![
                    event.id,
                    event.event_type,
                    event.skill_id,
                    event.timestamp,
                    event.user_id,
                    event.session_id,
                    event.input_hash,
                    event.success as i32,
                    event.duration_ms,
                    event.error,
                    event.feedback_score,
                    event.token_input,
                    event.token_output,
                    event.api_cost_usd,
                    event.caller_agent,
                    event.caller_workflow,
                    event.caller_tool,
                    event.metadata_json,
                ],
            )?;
            count += 1;
        }
        tx.commit()?;
        Ok(count)
    }

    /// 查询总览数据（最近 N 天 vs 前 N 天对比）
    pub fn get_overview(&self, days: i64) -> Result<AnalyticsOverview> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let period_start = now - days * 86400;
        let prev_start = period_start - days * 86400;

        let (total_calls, success_count, active_users): (i64, i64, i64) = conn.query_row(
            "SELECT COUNT(*), SUM(CASE WHEN success=1 THEN 1 ELSE 0 END), COUNT(DISTINCT user_id)
             FROM skill_events WHERE timestamp >= ?1",
            params![period_start],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;

        let p95_latency_ms: Option<i64> = conn.query_row(
            "SELECT duration_ms FROM skill_events
             WHERE timestamp >= ?1 AND duration_ms IS NOT NULL
             ORDER BY duration_ms ASC
             LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
                             FROM skill_events WHERE timestamp >= ?1 AND duration_ms IS NOT NULL)",
            params![period_start],
            |row| row.get(0),
        ).ok();

        let success_rate = if total_calls > 0 {
            success_count as f64 / total_calls as f64
        } else {
            1.0
        };

        // Previous period for delta calculation
        let (prev_total, prev_success, prev_users): (i64, i64, i64) = conn.query_row(
            "SELECT COUNT(*), SUM(CASE WHEN success=1 THEN 1 ELSE 0 END), COUNT(DISTINCT user_id)
             FROM skill_events WHERE timestamp >= ?1 AND timestamp < ?2",
            params![prev_start, period_start],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).unwrap_or((0, 0, 0));

        let prev_success_rate = if prev_total > 0 {
            prev_success as f64 / prev_total as f64
        } else {
            1.0
        };

        let total_calls_delta_pct = if prev_total > 0 {
            Some(((total_calls - prev_total) as f64 / prev_total as f64) * 100.0)
        } else {
            None
        };

        let prev_p95: Option<i64> = conn.query_row(
            "SELECT duration_ms FROM skill_events
             WHERE timestamp >= ?1 AND timestamp < ?2 AND duration_ms IS NOT NULL
             ORDER BY duration_ms ASC
             LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
                             FROM skill_events WHERE timestamp >= ?1 AND timestamp < ?2 AND duration_ms IS NOT NULL)",
            params![prev_start, period_start],
            |row| row.get(0),
        ).ok();

        Ok(AnalyticsOverview {
            total_calls,
            success_rate,
            p95_latency_ms,
            active_users,
            total_calls_delta_pct,
            success_rate_delta: Some(success_rate - prev_success_rate),
            p95_latency_delta_ms: match (p95_latency_ms, prev_p95) {
                (Some(cur), Some(prev)) => Some(cur - prev),
                _ => None,
            },
            active_users_delta: Some(active_users - prev_users),
        })
    }

    /// 每日调用量趋势
    pub fn get_daily_trend(&self, days: i64) -> Result<Vec<DailyStats>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let mut stmt = conn.prepare(
            "SELECT date, SUM(total_calls), SUM(success_count), SUM(fail_count),
                    AVG(avg_ms), SUM(unique_users), SUM(total_cost_usd),
                    SUM(thumbs_up), SUM(thumbs_down)
             FROM skill_daily_stats
             WHERE date >= date(?1, 'unixepoch')
             GROUP BY date ORDER BY date ASC",
        )?;

        let rows = stmt.query_map(params![since], |row| {
            Ok(DailyStats {
                skill_id: "all".to_string(),
                date: row.get(0)?,
                total_calls: row.get(1)?,
                success_count: row.get(2)?,
                fail_count: row.get(3)?,
                p50_ms: None,
                p95_ms: None,
                p99_ms: None,
                avg_ms: row.get(4)?,
                unique_users: row.get(5)?,
                total_cost_usd: row.get::<_, f64>(6).unwrap_or(0.0),
                thumbs_up: row.get(7).unwrap_or(0),
                thumbs_down: row.get(8).unwrap_or(0),
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// Top N 热门 Skill
    pub fn get_top_skills(&self, days: i64, limit: i64) -> Result<Vec<TopSkillEntry>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let mut stmt = conn.prepare(
            "SELECT skill_id, COUNT(*) as cnt,
                    SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as sr,
                    AVG(duration_ms) as avg_lat
             FROM skill_events WHERE timestamp >= ?1
             GROUP BY skill_id ORDER BY cnt DESC LIMIT ?2",
        )?;

        let rows = stmt.query_map(params![since, limit], |row| {
            Ok(TopSkillEntry {
                skill_id: row.get(0)?,
                call_count: row.get(1)?,
                success_rate: row.get(2)?,
                avg_latency_ms: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 成功率趋势（按天）
    pub fn get_success_rate_trend(&self, skill_id: Option<&str>, days: i64) -> Result<Vec<DailyStats>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let query = if let Some(sid) = skill_id {
            let mut stmt = conn.prepare(
                "SELECT date, total_calls, success_count, fail_count, p50_ms, p95_ms, p99_ms,
                        avg_ms, unique_users, total_cost_usd, thumbs_up, thumbs_down
                 FROM skill_daily_stats
                 WHERE skill_id = ?1 AND date >= date(?2, 'unixepoch')
                 ORDER BY date ASC",
            )?;
            let rows = stmt.query_map(params![sid, since], |row| {
                Ok(DailyStats {
                    skill_id: sid.to_string(),
                    date: row.get(0)?,
                    total_calls: row.get(1)?,
                    success_count: row.get(2)?,
                    fail_count: row.get(3)?,
                    p50_ms: row.get(4)?,
                    p95_ms: row.get(5)?,
                    p99_ms: row.get(6)?,
                    avg_ms: row.get(7)?,
                    unique_users: row.get(8)?,
                    total_cost_usd: row.get::<_, f64>(9).unwrap_or(0.0),
                    thumbs_up: row.get(10).unwrap_or(0),
                    thumbs_down: row.get(11).unwrap_or(0),
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        } else {
            let mut stmt = conn.prepare(
                "SELECT date, SUM(total_calls), SUM(success_count), SUM(fail_count),
                        NULL, NULL, NULL, AVG(avg_ms), SUM(unique_users),
                        SUM(total_cost_usd), SUM(thumbs_up), SUM(thumbs_down)
                 FROM skill_daily_stats
                 WHERE date >= date(?1, 'unixepoch')
                 GROUP BY date ORDER BY date ASC",
            )?;
            let rows = stmt.query_map(params![since], |row| {
                Ok(DailyStats {
                    skill_id: "all".to_string(),
                    date: row.get(0)?,
                    total_calls: row.get(1)?,
                    success_count: row.get(2)?,
                    fail_count: row.get(3)?,
                    p50_ms: row.get(4)?,
                    p95_ms: row.get(5)?,
                    p99_ms: row.get(6)?,
                    avg_ms: row.get(7)?,
                    unique_users: row.get(8)?,
                    total_cost_usd: row.get::<_, f64>(9).unwrap_or(0.0),
                    thumbs_up: row.get(10).unwrap_or(0),
                    thumbs_down: row.get(11).unwrap_or(0),
                })
            })?;
            rows.collect::<Result<Vec<_>, _>>()?
        };

        Ok(query)
    }

    /// 成本汇总
    pub fn get_cost_summary(&self, days: i64) -> Result<Vec<TopSkillEntry>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let mut stmt = conn.prepare(
            "SELECT skill_id, SUM(total_calls), 
                    SUM(success_count) * 1.0 / NULLIF(SUM(total_calls), 0),
                    SUM(total_cost_usd)
             FROM skill_daily_stats WHERE date >= date(?1, 'unixepoch')
             GROUP BY skill_id ORDER BY SUM(total_cost_usd) DESC",
        )?;

        let rows = stmt.query_map(params![since], |row| {
            Ok(TopSkillEntry {
                skill_id: row.get(0)?,
                call_count: row.get(1)?,
                success_rate: row.get::<_, f64>(2).unwrap_or(1.0),
                avg_latency_ms: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 调用方依赖分析
    pub fn get_caller_analysis(&self, days: i64) -> Result<Vec<CallerDependency>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let mut stmt = conn.prepare(
            "SELECT caller_agent, caller_tool, skill_id, COUNT(*) as cnt
             FROM skill_events
             WHERE timestamp >= ?1 AND caller_agent IS NOT NULL
             GROUP BY caller_agent, caller_tool, skill_id
             ORDER BY cnt DESC",
        )?;

        let rows = stmt.query_map(params![since], |row| {
            Ok(CallerDependency {
                caller_agent: row.get(0)?,
                caller_tool: row.get(1)?,
                skill_id: row.get(2)?,
                call_count: row.get(3)?,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 用户留存分析：使用过 skill_a 的用户中，有多少也使用了 skill_b
    pub fn get_user_retention(&self, days: i64) -> Result<Vec<UserRetentionPair>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let since = now - days * 86400;

        let mut stmt = conn.prepare(
            "SELECT a.skill_id, b.skill_id,
                    COUNT(DISTINCT a.user_id) as both_users
             FROM (SELECT DISTINCT skill_id, user_id FROM skill_events WHERE timestamp >= ?1) a
             JOIN (SELECT DISTINCT skill_id, user_id FROM skill_events WHERE timestamp >= ?1) b
               ON a.user_id = b.user_id AND a.skill_id < b.skill_id
             GROUP BY a.skill_id, b.skill_id
             ORDER BY both_users DESC
             LIMIT 20",
        )?;

        let rows = stmt.query_map(params![since], |row| {
            Ok(UserRetentionPair {
                skill_a: row.get(0)?,
                skill_b: row.get(1)?,
                users_both: row.get(2)?,
                users_a_only: 0,
                retention_rate: 0.0,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            let mut pair = row?;
            // Calculate users_a_only
            let users_a: i64 = conn.query_row(
                "SELECT COUNT(DISTINCT user_id) FROM skill_events
                 WHERE skill_id = ?1 AND timestamp >= ?2",
                params![pair.skill_a, since],
                |r| r.get(0),
            ).unwrap_or(0);
            pair.users_a_only = users_a - pair.users_both;
            pair.retention_rate = if users_a > 0 {
                pair.users_both as f64 / users_a as f64
            } else {
                0.0
            };
            result.push(pair);
        }
        Ok(result)
    }

    /// 获取活跃告警
    pub fn get_active_alerts(&self) -> Result<Vec<AnalyticsAlert>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, skill_id, alert_type, severity, message, detected_at, resolved_at, acknowledged
             FROM analytics_alerts
             WHERE resolved_at IS NULL
             ORDER BY detected_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AnalyticsAlert {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                alert_type: row.get(2)?,
                severity: row.get(3)?,
                message: row.get(4)?,
                detected_at: row.get(5)?,
                resolved_at: row.get(6)?,
                acknowledged: row.get::<_, i32>(7)? != 0,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 确认告警
    pub fn acknowledge_alert(&self, alert_id: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute(
            "UPDATE analytics_alerts SET acknowledged = 1 WHERE id = ?1",
            params![alert_id],
        )?;
        Ok(())
    }

    /// 聚合每日统计（由定时任务调用）
    #[allow(dead_code)]
    pub fn aggregate_daily_stats(&self, date: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        conn.execute_batch(&format!(
            "INSERT OR REPLACE INTO skill_daily_stats
             (skill_id, date, total_calls, success_count, fail_count,
              p50_ms, p95_ms, p99_ms, avg_ms, unique_users, total_cost_usd,
              thumbs_up, thumbs_down)
             SELECT
               skill_id,
               '{date}',
               COUNT(*),
               SUM(CASE WHEN success=1 THEN 1 ELSE 0 END),
               SUM(CASE WHEN success=0 THEN 1 ELSE 0 END),
               NULL, NULL, NULL,
               AVG(duration_ms),
               COUNT(DISTINCT user_id),
               COALESCE(SUM(api_cost_usd), 0),
               SUM(CASE WHEN feedback_score = 1 THEN 1 ELSE 0 END),
               SUM(CASE WHEN feedback_score = -1 THEN 1 ELSE 0 END)
             FROM skill_events
             WHERE date(timestamp, 'unixepoch') = '{date}'
             GROUP BY skill_id"
        ))?;
        Ok(())
    }
}
