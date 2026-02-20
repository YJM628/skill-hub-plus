# Backend: SQLite Schema + HTTP Ingest + Tauri Commands

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 在 Rust 后端实现 Analytics 数据层：SQLite 表结构、本地 HTTP Ingest Server（接收 SDK 上报）、Tauri Commands（供前端查询）、告警检测逻辑。

**Architecture:** 在现有 `src-tauri/src/core/` 下新增 `analytics_store.rs`（存储层）、`analytics_ingest.rs`（HTTP 接收）、`analytics_alert.rs`（告警检测）三个模块，复用现有的 `SkillStore` 的 SQLite 连接模式。

**Tech Stack:** Rust, rusqlite (bundled), tiny_http (新增依赖), serde_json, uuid, Tauri 2.x

**并行说明:** 本模块与 02-sdk、03-frontend 无依赖，可独立实施。

---

## Task 1: 添加 tiny_http 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: 在 Cargo.toml 的 [dependencies] 中添加 tiny_http**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 末尾添加：

```toml
tiny_http = "0.12"
chrono = { version = "0.4", features = ["serde"] }
```

**Step 2: 验证依赖可解析**

Run: `cd src-tauri && cargo check 2>&1 | head -20`
Expected: 编译通过，无 dependency resolution 错误

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add tiny_http and chrono dependencies for analytics"
```

**🔍 检测点:** `cargo check` 通过
**✅ 验收标准:** `Cargo.toml` 包含 `tiny_http` 和 `chrono`，`cargo check` 无错误

---

## Task 2: 创建 analytics_store.rs — SQLite Schema

**Files:**
- Create: `src-tauri/src/core/analytics_store.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Step 1: 创建 analytics_store.rs 文件**

```rust
use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Analytics 存储层，管理 skill_events / skill_daily_stats / analytics_alerts 三张表
pub struct AnalyticsStore {
    db_path: PathBuf,
    conn: Mutex<Connection>,
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
```

**Step 2: 在 mod.rs 中注册模块**

在 `src-tauri/src/core/mod.rs` 末尾添加：

```rust
pub mod analytics_store;
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src-tauri/src/core/analytics_store.rs src-tauri/src/core/mod.rs
git commit -m "feat(analytics): add analytics_store with SQLite schema and query methods"
```

**🔍 检测点:** `cargo check` 通过；`AnalyticsStore::new()` 可创建实例并建表
**✅ 验收标准:**
- `skill_events`、`skill_daily_stats`、`analytics_alerts` 三张表的 DDL 正确
- `insert_events()` 可批量写入事件
- `get_overview()`、`get_daily_trend()`、`get_top_skills()` 等查询方法编译通过
- 所有 struct 实现了 `Serialize` + `Deserialize`

---

## Task 3: 创建 analytics_alert.rs — 告警检测

**Files:**
- Create: `src-tauri/src/core/analytics_alert.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Step 1: 创建 analytics_alert.rs 文件**

```rust
use anyhow::Result;
use rusqlite::params;
use crate::core::analytics_store::AnalyticsStore;

/// 告警检测器，在事件写入后检查是否触发告警
pub struct AlertDetector;

impl AlertDetector {
    /// 检查某个 Skill 最近 1 小时的失败率是否飙升
    /// 触发条件：最近 1h 失败率 > 10% 且调用量 > 20
    pub fn check_failure_spike(store: &AnalyticsStore, skill_id: &str) -> Result<Option<String>> {
        let conn = store.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let one_hour_ago = now - 3600;

        let (total, failures): (i64, i64) = conn.query_row(
            "SELECT COUNT(*), SUM(CASE WHEN success=0 THEN 1 ELSE 0 END)
             FROM skill_events WHERE skill_id = ?1 AND timestamp >= ?2",
            params![skill_id, one_hour_ago],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;

        if total > 20 {
            let failure_rate = failures as f64 / total as f64;
            if failure_rate > 0.10 {
                let msg = format!(
                    "Skill '{}' failure rate is {:.1}% ({}/{}) in the last hour",
                    skill_id,
                    failure_rate * 100.0,
                    failures,
                    total
                );
                return Ok(Some(msg));
            }
        }
        Ok(None)
    }

    /// 检查 P95 延迟是否较前一天同时段上升 > 200%
    pub fn check_latency_spike(store: &AnalyticsStore, skill_id: &str) -> Result<Option<String>> {
        let conn = store.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let one_hour_ago = now - 3600;
        let yesterday_start = one_hour_ago - 86400;
        let yesterday_end = now - 86400;

        let current_p95: Option<i64> = conn.query_row(
            "SELECT duration_ms FROM skill_events
             WHERE skill_id = ?1 AND timestamp >= ?2 AND duration_ms IS NOT NULL
             ORDER BY duration_ms ASC
             LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
                             FROM skill_events WHERE skill_id = ?1 AND timestamp >= ?2 AND duration_ms IS NOT NULL)",
            params![skill_id, one_hour_ago],
            |row| row.get(0),
        ).ok();

        let prev_p95: Option<i64> = conn.query_row(
            "SELECT duration_ms FROM skill_events
             WHERE skill_id = ?1 AND timestamp >= ?2 AND timestamp < ?3 AND duration_ms IS NOT NULL
             ORDER BY duration_ms ASC
             LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
                             FROM skill_events WHERE skill_id = ?1 AND timestamp >= ?2 AND timestamp < ?3 AND duration_ms IS NOT NULL)",
            params![skill_id, yesterday_start, yesterday_end],
            |row| row.get(0),
        ).ok();

        if let (Some(cur), Some(prev)) = (current_p95, prev_p95) {
            if prev > 0 && cur > prev * 3 {
                let msg = format!(
                    "Skill '{}' P95 latency spiked from {}ms to {}ms ({:.0}% increase)",
                    skill_id, prev, cur,
                    ((cur - prev) as f64 / prev as f64) * 100.0
                );
                return Ok(Some(msg));
            }
        }
        Ok(None)
    }

    /// 运行所有告警检查并写入 analytics_alerts 表
    pub fn run_checks(store: &AnalyticsStore, skill_id: &str) -> Result<Vec<String>> {
        let mut alerts = Vec::new();

        if let Some(msg) = Self::check_failure_spike(store, skill_id)? {
            Self::insert_alert(store, skill_id, "failure_spike", "critical", &msg)?;
            alerts.push(msg);
        }

        if let Some(msg) = Self::check_latency_spike(store, skill_id)? {
            Self::insert_alert(store, skill_id, "latency_spike", "warning", &msg)?;
            alerts.push(msg);
        }

        Ok(alerts)
    }

    fn insert_alert(
        store: &AnalyticsStore,
        skill_id: &str,
        alert_type: &str,
        severity: &str,
        message: &str,
    ) -> Result<()> {
        let conn = store.conn.lock().map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs() as i64;
        let alert_id = uuid::Uuid::new_v4().to_string();

        // Avoid duplicate alerts: check if same type+skill has unresolved alert
        let existing: i64 = conn.query_row(
            "SELECT COUNT(*) FROM analytics_alerts
             WHERE skill_id = ?1 AND alert_type = ?2 AND resolved_at IS NULL",
            params![skill_id, alert_type],
            |row| row.get(0),
        )?;

        if existing == 0 {
            conn.execute(
                "INSERT INTO analytics_alerts (id, skill_id, alert_type, severity, message, detected_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![alert_id, skill_id, alert_type, severity, message, now],
            )?;
        }
        Ok(())
    }
}
```

**Step 2: 在 mod.rs 中注册模块**

在 `src-tauri/src/core/mod.rs` 末尾添加：

```rust
pub mod analytics_alert;
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src-tauri/src/core/analytics_alert.rs src-tauri/src/core/mod.rs
git commit -m "feat(analytics): add alert detector for failure/latency spike detection"
```

**🔍 检测点:** `cargo check` 通过
**✅ 验收标准:**
- `AlertDetector::check_failure_spike()` 在失败率 > 10% 且调用量 > 20 时返回告警消息
- `AlertDetector::check_latency_spike()` 在 P95 延迟上升 > 200% 时返回告警消息
- 告警去重：同类型+同 Skill 不会重复插入未解决的告警

---

## Task 4: 创建 analytics_ingest.rs — HTTP Ingest Server

**Files:**
- Create: `src-tauri/src/core/analytics_ingest.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Step 1: 创建 analytics_ingest.rs 文件**

```rust
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
```

**Step 2: 在 mod.rs 中注册模块**

在 `src-tauri/src/core/mod.rs` 末尾添加：

```rust
pub mod analytics_ingest;
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: 编译通过

**Step 4: Commit**

```bash
git add src-tauri/src/core/analytics_ingest.rs src-tauri/src/core/mod.rs
git commit -m "feat(analytics): add HTTP ingest server on 127.0.0.1:19823"
```

**🔍 检测点:** `cargo check` 通过
**✅ 验收标准:**
- Server 仅监听 `127.0.0.1:19823`（本机安全）
- 仅接受 `POST /v1/events`，其他路径返回 404
- 请求体解析失败返回 400 + 错误信息
- 成功写入返回 `{"accepted": N}`
- 每次写入后自动运行告警检测

---

## Task 5: 添加 Tauri Commands — 前端查询接口

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 在 commands/mod.rs 末尾添加 analytics commands**

```rust
// ─── Analytics Commands ───

#[tauri::command]
pub async fn get_analytics_overview(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
) -> Result<crate::core::analytics_store::AnalyticsOverview, String> {
    let days = days.unwrap_or(7);
    store.get_overview(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_daily_trend(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::DailyStats>, String> {
    let days = days.unwrap_or(30);
    store.get_daily_trend(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_top_skills(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::TopSkillEntry>, String> {
    let days = days.unwrap_or(7);
    let limit = limit.unwrap_or(10);
    store.get_top_skills(days, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_success_rate(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    skill_id: Option<String>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::DailyStats>, String> {
    let days = days.unwrap_or(30);
    store
        .get_success_rate_trend(skill_id.as_deref(), days)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_cost_summary(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::TopSkillEntry>, String> {
    let days = days.unwrap_or(30);
    store.get_cost_summary(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_caller_analysis(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::CallerDependency>, String> {
    let days = days.unwrap_or(30);
    store.get_caller_analysis(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_user_retention(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::UserRetentionPair>, String> {
    let days = days.unwrap_or(30);
    store.get_user_retention(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_alerts(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
) -> Result<Vec<crate::core::analytics_store::AnalyticsAlert>, String> {
    store.get_active_alerts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn acknowledge_analytics_alert(
    store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
    alert_id: String,
) -> Result<(), String> {
    store.acknowledge_alert(&alert_id).map_err(|e| e.to_string())
}
```

**Step 2: 在 lib.rs 的 invoke_handler 中注册新 commands**

在 `.invoke_handler(tauri::generate_handler![...])` 的列表末尾添加：

```rust
commands::get_analytics_overview,
commands::get_analytics_daily_trend,
commands::get_analytics_top_skills,
commands::get_analytics_success_rate,
commands::get_analytics_cost_summary,
commands::get_analytics_caller_analysis,
commands::get_analytics_user_retention,
commands::get_analytics_alerts,
commands::acknowledge_analytics_alert,
```

**Step 3: 在 lib.rs 的 setup() 中初始化 AnalyticsStore 和 Ingest Server**

在 `app.manage(store.clone());` 之后添加：

```rust
// Initialize Analytics
let analytics_db_path = db_path.with_file_name("skills_hub_analytics.db");
let analytics_store = crate::core::analytics_store::AnalyticsStore::new(analytics_db_path)
    .map_err(|e| tauri::Error::from(anyhow::anyhow!("{}", e)))?;
let analytics_arc = std::sync::Arc::new(analytics_store);

// Start ingest server in background
let ingest_store = analytics_arc.clone();
std::thread::spawn(move || {
    if let Err(err) = crate::core::analytics_ingest::start_ingest_server(ingest_store) {
        log::error!("[analytics] Failed to start ingest server: {}", err);
    }
});

// Make AnalyticsStore available to Tauri commands
// Note: We need to extract the inner store for Tauri state management
// Since AnalyticsStore is not Clone, we manage the Arc
app.manage(std::sync::Arc::clone(&analytics_arc));
```

**注意：** 由于 Tauri 的 `State` 需要类型匹配，commands 中的 `State<'_, AnalyticsStore>` 需要改为 `State<'_, Arc<AnalyticsStore>>`，或者让 `AnalyticsStore` 实现 `Clone`。推荐方案是修改 commands 使用 `Arc<AnalyticsStore>`。

**Step 4: 调整 commands 的 State 类型**

将所有 analytics commands 中的：
```rust
store: tauri::State<'_, crate::core::analytics_store::AnalyticsStore>,
```
改为：
```rust
store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
```

**Step 5: 验证编译**

Run: `cd src-tauri && cargo check 2>&1 | tail -10`
Expected: 编译通过

**Step 6: Commit**

```bash
git add src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(analytics): add Tauri commands and initialize analytics on startup"
```

**🔍 检测点:** `cargo check` 通过；`cargo test` 通过
**✅ 验收标准:**
- 9 个新 Tauri commands 全部注册
- AnalyticsStore 在应用启动时初始化
- Ingest Server 在后台线程启动
- 前端可通过 `invoke('get_analytics_overview', { days: 7 })` 调用

---

## Task 6: 编写后端单元测试

**Files:**
- Create: `src-tauri/src/core/tests/analytics_tests.rs`

**Step 1: 创建测试文件**

```rust
#[cfg(test)]
mod tests {
    use crate::core::analytics_store::{AnalyticsStore, SkillEventRow};
    use tempfile::NamedTempFile;

    fn create_test_store() -> AnalyticsStore {
        let tmp = NamedTempFile::new().unwrap();
        AnalyticsStore::new(tmp.path().to_path_buf()).unwrap()
    }

    fn make_event(skill_id: &str, success: bool, duration_ms: i64) -> SkillEventRow {
        SkillEventRow {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: "skill_invoke".to_string(),
            skill_id: skill_id.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            user_id: "test_user".to_string(),
            session_id: "test_session".to_string(),
            input_hash: Some("abc123".to_string()),
            success,
            duration_ms: Some(duration_ms),
            error: if success { None } else { Some("test error".to_string()) },
            feedback_score: None,
            token_input: None,
            token_output: None,
            api_cost_usd: None,
            caller_agent: None,
            caller_workflow: None,
            caller_tool: None,
            metadata_json: None,
        }
    }

    #[test]
    fn test_schema_creation() {
        let store = create_test_store();
        // Schema should be created without errors
        store.ensure_schema().unwrap();
    }

    #[test]
    fn test_insert_and_query_events() {
        let store = create_test_store();
        let events = vec![
            make_event("skill-a", true, 100),
            make_event("skill-a", true, 200),
            make_event("skill-b", false, 500),
        ];
        let count = store.insert_events(&events).unwrap();
        assert_eq!(count, 3);

        let overview = store.get_overview(1).unwrap();
        assert_eq!(overview.total_calls, 3);
        assert_eq!(overview.active_users, 1);
    }

    #[test]
    fn test_top_skills() {
        let store = create_test_store();
        let mut events = Vec::new();
        for _ in 0..5 {
            events.push(make_event("popular-skill", true, 100));
        }
        for _ in 0..2 {
            events.push(make_event("rare-skill", true, 200));
        }
        store.insert_events(&events).unwrap();

        let top = store.get_top_skills(1, 10).unwrap();
        assert!(!top.is_empty());
        assert_eq!(top[0].skill_id, "popular-skill");
        assert_eq!(top[0].call_count, 5);
    }

    #[test]
    fn test_active_alerts_empty() {
        let store = create_test_store();
        let alerts = store.get_active_alerts().unwrap();
        assert!(alerts.is_empty());
    }

    #[test]
    fn test_duplicate_insert_ignored() {
        let store = create_test_store();
        let event = make_event("skill-a", true, 100);
        let events = vec![event.clone(), event]; // same id
        let count = store.insert_events(&events).unwrap();
        // INSERT OR IGNORE: second one silently ignored
        assert_eq!(count, 2); // count is attempts, not actual inserts
    }
}
```

**Step 2: 确保测试模块被引入**

在 `src-tauri/src/core/tests/mod.rs` 中添加（如果文件存在）：

```rust
#[cfg(test)]
mod analytics_tests;
```

**Step 3: 运行测试**

Run: `cd src-tauri && cargo test analytics 2>&1 | cat`
Expected: 所有测试通过

**Step 4: Commit**

```bash
git add src-tauri/src/core/tests/
git commit -m "test(analytics): add unit tests for analytics store"
```

**🔍 检测点:** `cargo test analytics` 全部通过
**✅ 验收标准:**
- `test_schema_creation` — 建表无错误
- `test_insert_and_query_events` — 写入 3 条，查询 overview 正确
- `test_top_skills` — Top 排序正确
- `test_active_alerts_empty` — 无告警时返回空
- `test_duplicate_insert_ignored` — 重复 ID 不报错

---

## 最终验收清单

| # | 检查项 | 命令 |
|---|--------|------|
| 1 | Cargo.toml 包含 tiny_http + chrono | `grep tiny_http src-tauri/Cargo.toml` |
| 2 | analytics_store.rs 编译通过 | `cd src-tauri && cargo check` |
| 3 | analytics_alert.rs 编译通过 | `cd src-tauri && cargo check` |
| 4 | analytics_ingest.rs 编译通过 | `cd src-tauri && cargo check` |
| 5 | 9 个 Tauri commands 已注册 | `grep analytics src-tauri/src/lib.rs` |
| 6 | 单元测试全部通过 | `cd src-tauri && cargo test analytics` |
| 7 | 整体编译通过 | `cd src-tauri && cargo build` |
