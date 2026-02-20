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
            |row: &rusqlite::Row| Ok((row.get(0)?, row.get(1)?)),
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
            |row: &rusqlite::Row| row.get(0),
        ).ok();

        let prev_p95: Option<i64> = conn.query_row(
            "SELECT duration_ms FROM skill_events
             WHERE skill_id = ?1 AND timestamp >= ?2 AND timestamp < ?3 AND duration_ms IS NOT NULL
             ORDER BY duration_ms ASC
             LIMIT 1 OFFSET (SELECT CAST(COUNT(*) * 0.95 AS INTEGER)
                             FROM skill_events WHERE skill_id = ?1 AND timestamp >= ?2 AND timestamp < ?3 AND duration_ms IS NOT NULL)",
            params![skill_id, yesterday_start, yesterday_end],
            |row: &rusqlite::Row| row.get(0),
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
            |row: &rusqlite::Row| row.get(0),
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
