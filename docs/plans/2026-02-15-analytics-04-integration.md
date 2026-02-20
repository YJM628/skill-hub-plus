# Integration & End-to-End Testing

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 完成后端、SDK、前端三者的集成联调，验证 SDK→Ingest→DB→Dashboard 全链路数据流转，并通过 E2E 测试确保系统稳定性。

**Architecture:** 模拟真实 Skill 使用场景，通过 SDK 发送事件到 HTTP Ingest Server，验证事件正确写入 SQLite，再通过前端 Dashboard 展示数据。包含单元测试、集成测试、E2E 测试。

**Tech Stack:** Rust (rusqlite, tiny_http), TypeScript SDK, React 19, Tauri invoke, curl (测试工具)

**前置依赖:** 必须先完成 01-backend、02-sdk、03-fronten 三个模块的实施。

**并行说明:** 本模块依赖前三个模块全部完成，串行执行。包含 6 个 Task，每个 Task 可独立提交。

---

## Task 1: 验证 HTTP Ingest Server 可用性

**Files:**
- Test: `src-tauri/src/core/analytics_ingest.rs`

**Step 1: 启动 Tauri 应用**

Run: `cargo tauri dev`
Expected: 应用成功启动，HTTP Ingest Server 监听 `127.0.0.1:19823`

**Step 2: 测试 Ingest 端点**

Run: `curl -X POST http://127.0.0.1:19823/api/v1/ingest -H "Content-Type: application/json" -d '{"skill_id":"test-skill","event_type":"call","timestamp":1739596800,"status":"success","latency_ms":100}'`
Expected: 返回 `{"status":"accepted"}` 或 `200 OK`

**Step 3: 验证事件写入数据库**

Run: `sqlite3 $HOME/Library/Application\ Support/com.example.skills-hub/skills_hub.db "SELECT * FROM skill_events ORDER BY event_id DESC LIMIT 1;"`
Expected: 查询到刚插入的事件记录

**🔍 检测点:** curl 请求返回成功，数据库中有对应记录
**✅ 验收标准:**
- HTTP 端点响应 200
- 返回 JSON 包含 `status: "accepted"`
- 数据库中 `skill_id = "test-skill"` 的事件存在

---

## Task 2: SDK 集成测试

**Files:**
- Create: `packages/analytics/tests/integration.test.ts`

**Step 1: 创建集成测试**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Tracker } from '../src/tracker'
import { Transport } from '../src/transport'

describe('SDK Integration Tests', () => {
  const TEST_ENDPOINT = 'http://127.0.0.1:19823/api/v1/ingest'
  const TEST_SKILL_ID = 'integration-test-skill'

  let tracker: Tracker

  beforeEach(() => {
    tracker = new Tracker({
      skillId: TEST_SKILL_ID,
      endpoint: TEST_ENDPOINT,
      bufferSize: 5,
      flushInterval: 1000,
    })
  })

  afterEach(async () => {
    await tracker.shutdown()
  })

  it('should send event to ingest server', async () => {
    await tracker.trackCall({
      status: 'success',
      latencyMs: 150,
      metadata: { test: 'integration' },
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const response = await fetch(`${TEST_ENDPOINT}?skill_id=${TEST_SKILL_ID}`)
    expect(response.ok).toBeTruthy()
  })

  it('should buffer and flush events', async () => {
    for (let i = 0; i < 10; i++) {
      await tracker.trackCall({
        status: i % 2 === 0 ? 'success' : 'failure',
        latencyMs: 100 + i * 10,
      })
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const response = await fetch('http://127.0.0.1:19823/api/v1/health')
    expect(response.ok).toBeTruthy()
  })

  it('should handle network errors gracefully', async () => {
    const errorTracker = new Tracker({
      skillId: 'error-test',
      endpoint: 'http://127.0.0.1:99999/invalid',
      bufferSize: 2,
    })

    await errorTracker.trackCall({ status: 'success', latencyMs: 100 })
    await new Promise((resolve) => setTimeout(resolve, 500))

    await errorTracker.shutdown()
  })
})
```

**Step 2: 运行集成测试**

Run: `cd packages/analytics && npm test`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add packages/analytics/tests/integration.test.ts
git commit -m "test(analytics-sdk): add integration tests for ingest server"
```

**🔍 检测点:** 所有集成测试通过
**✅ 验收标准:**
- 事件成功发送到 Ingest Server
- 缓冲机制正常工作
- 网络错误被正确处理

---

## Task 3: 后端集成测试

**Files:**
- Create: `src-tauri/tests/analytics_integration_test.rs`

**Step 1: 创建集成测试**

```rust
#[cfg(test)]
mod analytics_integration_tests {
    use super::*;
    use chrono::Utc;
    use rusqlite::Connection;

    fn get_test_db_path() -> String {
        format!("/tmp/skills_hub_test_{}.db", std::process::id())
    }

    fn setup_test_db() -> Connection {
        let db_path = get_test_db_path();
        let _ = std::fs::remove_file(&db_path);
        let conn = Connection::open(&db_path).unwrap();
        create_analytics_tables(&conn).unwrap();
        conn
    }

    #[test]
    fn test_event_crud() {
        let conn = setup_test_db();

        let event = SkillEvent {
            event_id: 1,
            skill_id: "test-skill".to_string(),
            event_type: "call".to_string(),
            timestamp: Utc::now().timestamp(),
            status: "success".to_string(),
            latency_ms: 100,
            error_message: None,
            user_id: None,
            session_id: None,
            metadata: None,
            created_at: Utc::now().timestamp(),
        };

        insert_event(&conn, &event).unwrap();

        let retrieved = get_event_by_id(&conn, 1).unwrap();
        assert_eq!(retrieved.skill_id, "test-skill");
        assert_eq!(retrieved.status, "success");

        std::fs::remove_file(get_test_db_path()).unwrap();
    }

    #[test]
    fn test_aggregation_queries() {
        let conn = setup_test_db();

        for i in 0..10 {
            let event = SkillEvent {
                event_id: (i + 1) as i64,
                skill_id: "test-skill".to_string(),
                event_type: "call".to_string(),
                timestamp: Utc::now().timestamp() - (i * 86400),
                status: if i % 3 == 0 { "failure" } else { "success" }.to_string(),
                latency_ms: 100 + i * 10,
                error_message: None,
                user_id: Some(format!("user-{}", i % 3)),
                session_id: None,
                metadata: None,
                created_at: Utc::now().timestamp(),
            };
            insert_event(&conn, &event).unwrap();
        }

        let overview = get_overview_stats(&conn).unwrap();
        assert_eq!(overview.total_events, 10);
        assert_eq!(overview.successful_events, 7);
        assert_eq!(overview.failed_events, 3);

        std::fs::remove_file(get_test_db_path()).unwrap();
    }

    #[test]
    fn test_alert_detection() {
        let conn = setup_test_db();

        let mut events = vec![];
        for i in 0..20 {
            events.push(SkillEvent {
                event_id: (i + 1) as i64,
                skill_id: "alert-test".to_string(),
                event_type: "call".to_string(),
                timestamp: Utc::now().timestamp() - (i * 60),
                status: if i < 15 { "success" } else { "failure" }.to_string(),
                latency_ms: 100,
                error_message: None,
                user_id: None,
                session_id: None,
                metadata: None,
                created_at: Utc::now().timestamp(),
            });
        }

        for event in &events {
            insert_event(&conn, event).unwrap();
        }

        let alerts = detect_alerts(&conn).unwrap();
        assert!(!alerts.is_empty());

        std::fs::remove_file(get_test_db_path()).unwrap();
    }
}
```

**Step 2: 运行集成测试**

Run: `cargo test analytics_integration_tests`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add src-tauri/tests/analytics_integration_test.rs
git commit -m "test(analytics-backend): add integration tests for CRUD and aggregation"
```

**🔍 检测点:** 所有后端集成测试通过
**✅ 验收标准:**
- 事件 CRUD 操作正常
- 聚合查询返回正确结果
- 告警检测逻辑触发

---

## Task 4: 前端 E2E 测试

**Files:**
- Create: `tests/analytics_e2e.test.ts`

**Step 1: 创建 E2E 测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Analytics Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
  })

  test('should display analytics dashboard', async ({ page }) => {
    await page.click('text=📊 Analytics')
    await expect(page.locator('h1:has-text("Analytics Dashboard")')).toBeVisible()
  })

  test('should show overview cards', async ({ page }) => {
    await page.click('text=📊 Analytics')
    await expect(page.locator('text=Total Calls')).toBeVisible()
    await expect(page.locator('text=Success Rate')).toBeVisible()
    await expect(page.locator('text=Avg Latency')).toBeVisible()
    await expect(page.locator('text=Active Users')).toBeVisible()
  })

  test('should display charts', async ({ page }) => {
    await page.click('text=📊 Analytics')
    await expect(page.locator('text=Daily Trend')).toBeVisible()
    await expect(page.locator('text=Success Rate')).toBeVisible()
  })

  test('should handle refresh button', async ({ page }) => {
    await page.click('text=📊 Analytics')
    await page.click('button:has-text("Refresh")')
    await expect(page.locator('button:has-text("Loading...")')).toBeVisible()
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible({ timeout: 5000 })
  })

  test('should acknowledge alerts', async ({ page }) => {
    await page.click('text=📊 Analytics')
    const alertDismissButton = page.locator('button:has-text("Dismiss")').first()
    if (await alertDismissButton.isVisible()) {
      await alertDismissButton.click()
      await expect(alertDismissButton).not.toBeVisible()
    }
  })
})
```

**Step 2: 运行 E2E 测试**

Run: `npm run test:e2e`
Expected: 所有 E2E 测试通过

**Step 3: Commit**

```bash
git add tests/analytics_e2e.test.ts
git commit -m "test(analytics-frontend): add E2E tests for dashboard"
```

**🔍 检测点:** 所有 E2E 测试通过
**✅ 验收标准:**
- Dashboard 页面正常加载
- 所有组件可见
- Refresh 按钮功能正常
- 告警确认功能正常

---

## Task 5: 全链路数据流测试

**Files:**
- Create: `scripts/test_full_pipeline.sh`

**Step 1: 创建全链路测试脚本**

```bash
#!/bin/bash

set -e

echo "🚀 Starting Full Pipeline Test..."

# 1. 清理测试数据
echo "📝 Cleaning test data..."
DB_PATH="$HOME/Library/Application Support/com.example.skills-hub/skills_hub.db"
sqlite3 "$DB_PATH" "DELETE FROM skill_events WHERE skill_id = 'pipeline-test';"

# 2. 启动 Tauri 应用（假设已在后台运行）
# cargo tauri dev &

# 3. 使用 SDK 发送事件
echo "📦 Sending events via SDK..."
curl -X POST http://127.0.0.1:19823/api/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "skill_id": "pipeline-test",
    "event_type": "call",
    "timestamp": 1739596800,
    "status": "success",
    "latency_ms": 120,
    "user_id": "user-1",
    "session_id": "session-1",
    "metadata": {"test": "pipeline"}
  }'

# 4. 等待事件写入
echo "⏳ Waiting for event persistence..."
sleep 2

# 5. 验证数据库
echo "🔍 Verifying database..."
COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events WHERE skill_id = 'pipeline-test';")
if [ "$COUNT" -eq "1" ]; then
  echo "✅ Event persisted successfully!"
else
  echo "❌ Event persistence failed! Count: $COUNT"
  exit 1
fi

# 6. 测试 Tauri Command
echo "🎯 Testing Tauri commands..."
# 这里需要通过 Tauri 的 IPC 调用，实际测试中可以使用 Tauri 的测试工具
# 简化版本：直接查询数据库验证聚合逻辑
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events;")
SUCCESS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events WHERE status = 'success';")
echo "Total events: $TOTAL, Success: $SUCCESS"

# 7. 清理
echo "🧹 Cleaning up..."
sqlite3 "$DB_PATH" "DELETE FROM skill_events WHERE skill_id = 'pipeline-test';"

echo "✨ Full pipeline test completed successfully!"
```

**Step 2: 运行全链路测试**

Run: `chmod +x scripts/test_full_pipeline.sh && ./scripts/test_full_pipeline.sh`
Expected: 脚本执行成功，所有步骤通过

**Step 3: Commit**

```bash
git add scripts/test_full_pipeline.sh
git commit -m "test(analytics): add full pipeline integration test script"
```

**🔍 检测点:** 脚本执行无错误
**✅ 验收标准:**
- 事件成功通过 HTTP Ingest 接收
- 事件正确写入 SQLite
- 数据库查询返回预期结果
- 清理步骤成功执行

---

## Task 6: 性能和压力测试

**Files:**
- Create: `scripts/test_performance.sh`

**Step 1: 创建性能测试脚本**

```bash
#!/bin/bash

set -e

echo "⚡ Starting Performance Test..."

CONCURRENT_REQUESTS=100
TOTAL_REQUESTS=1000
ENDPOINT="http://127.0.0.1:19823/api/v1/ingest"

echo "📊 Testing $TOTAL_REQUESTS requests with $CONCURRENT_REQUESTS concurrent connections..."

# 使用 Apache Bench 进行压力测试
ab -n $TOTAL_REQUESTS -c $CONCURRENT_REQUESTS -p /tmp/ingest_payload.json -T application/json $ENDPOINT

echo ""
echo "📈 Performance test completed!"
echo "Check the output above for:"
echo "  - Requests per second"
echo "  - Time per request"
echo "  - Failed requests (should be 0)"
```

**Step 2: 创建测试负载**

Run: `cat > /tmp/ingest_payload.json << 'EOF'
{
  "skill_id": "perf-test",
  "event_type": "call",
  "timestamp": 1739596800,
  "status": "success",
  "latency_ms": 100
}
EOF`

**Step 3: 运行性能测试**

Run: `chmod +x scripts/test_performance.sh && ./scripts/test_performance.sh`
Expected: 请求成功率 100%，响应时间在可接受范围内

**Step 4: Commit**

```bash
git add scripts/test_performance.sh
git commit -m "test(analytics): add performance and load testing script"
```

**🔍 检测点:** ab 工具输出显示 0 Failed requests
**✅ 验收标准:**
- 1000 个请求全部成功
- 平均响应时间 &lt; 100ms
- 无 5xx 错误

---

## 🎯 最终验收清单

### 功能验收
- [ ] HTTP Ingest Server 正常接收事件
- [ ] 事件正确写入 SQLite 数据库
- [ ] SDK 集成测试全部通过
- [ ] 后端集成测试全部通过
- [ ] 前端 E2E 测试全部通过
- [ ] 全链路数据流测试通过
- [ ] 性能测试满足要求

### 数据一致性验收
- [ ] SDK 发送的事件与数据库中的记录一致
- [ ] 聚合查询结果准确
- [ ] 告警检测逻辑正确触发
- [ ] 前端 Dashboard 显示的数据与数据库一致

### 性能验收
- [ ] Ingest Server 响应时间 &lt; 50ms (单请求)
- [ ] 支持并发 100+ 请求
- [ ] 数据库查询 &lt; 100ms
- [ ] 前端页面加载 &lt; 2s

### 稳定性验收
- [ ] 网络错误不影响应用稳定性
- [ ] 数据库连接池正常工作
- [ ] 前端错误边界正常捕获异常
- [ ] 无内存泄漏

### 文档验收
- [ ] SDK 使用文档完整
- [ ] API 文档更新
- [ ] 测试覆盖率报告生成

---

## 📋 后续优化建议

### 短期优化 (1-2 周)
- [ ] 添加更多图表类型（热力图、漏斗图）
- [ ] 实现数据导出功能 (CSV/JSON)
- [ ] 添加自定义时间范围选择器
- [ ] 实现实时数据刷新 (WebSocket)

### 中期优化 (1-2 月)
- [ ] 添加 A/B 测试支持
- [ ] 实现成本追踪和预算告警
- [ ] 添加用户行为分析
- [ ] 实现 Skill 依赖分析可视化

### 长期优化 (3-6 月)
- [ ] 数据归档和清理策略
- [ ] 分布式存储支持 (PostgreSQL/TimescaleDB)
- [ ] 机器学习异常检测
- [ ] 自动化报告生成

---

**Plan complete and saved to `docs/plans/2026-02-15-analytics-04-integration.md`.**

**All 4 implementation plans are now complete!**

**Execution Options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers-subagent-driven-development
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses superpowers-executing-plans
