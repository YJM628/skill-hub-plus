# Skills Hub Analytics — 实施总览

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 为 Skills Hub 构建一套完整的 Skill 调用统计机制，包含 SDK 上报、后端存储/查询、前端可视化看板与告警系统。

**Architecture:** 分为 4 个独立模块：Rust 后端（SQLite schema + HTTP Ingest + Tauri Commands）、TypeScript SDK（事件采集与上报）、React 前端看板（图表 + 告警 + 高级分析）、集成联调。前三个模块互相无依赖，可并行实施。

**Tech Stack:** Tauri 2.x, Rust (rusqlite, tiny_http), React 19, TypeScript, recharts, Tailwind CSS 4

---

## 模块依赖关系图

```
                    ┌──────────────────────────┐
                    │  00-overview (本文件)      │
                    │  总览 + 依赖图 + 并行指南  │
                    └────────────┬─────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ 01-backend   │      │ 02-sdk       │      │ 03-frontend  │
  │ Schema +     │      │ TypeScript   │      │ React 看板   │
  │ Ingest +     │      │ SDK 包       │      │ + 图表 + 告警│
  │ Commands     │      │              │      │              │
  │ ⚡ 可并行    │      │ ⚡ 可并行    │      │ ⚡ 可并行    │
  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 04-integration      │
                    │ 集成联调            │
                    │ ⛔ 依赖 01+02+03   │
                    └─────────────────────┘
```

## 并行实施指南

### 可并行的模块（开启 3 个独立会话）

| 会话 | 计划文件 | 说明 |
|------|---------|------|
| Session A | `docs/plans/2026-02-15-analytics-01-backend-schema-ingest.md` | Rust 后端：SQLite 表、HTTP Ingest Server、Tauri Commands |
| Session B | `docs/plans/2026-02-15-analytics-02-sdk.md` | TypeScript SDK：事件采集、缓冲队列、HTTP 上报、离线 fallback |
| Session C | `docs/plans/2026-02-15-analytics-03-frontend-dashboard.md` | React 前端：类型定义、图表组件、看板页面、告警面板 |

### 串行模块（等待上述 3 个全部完成）

| 会话 | 计划文件 | 前置条件 |
|------|---------|---------|
| Session D | `docs/plans/2026-02-15-analytics-04-integration.md` | 01 + 02 + 03 全部完成 |

### 每个会话的启动方式

在新会话中输入：

```
请阅读 docs/plans/2026-02-15-analytics-0X-xxx.md 并使用 superpowers-executing-plans 逐步实施。
```

## 共享约定（所有模块必须遵守）

### 事件数据模型（SDK ↔ Backend 共享契约）

```typescript
interface SkillEvent {
  event_type: "skill_invoke" | "skill_feedback" | "skill_error"
  skill_id: string
  timestamp: string          // ISO 8601
  user_id: string
  session_id: string
  input_hash: string         // SHA-256(input).slice(0, 16)
  success: boolean
  duration_ms: number
  error: string | null
  feedback_score: number | null  // 👍=1, 👎=-1, null=未评价
  cost: {
    token_input: number
    token_output: number
    api_cost_usd: number
  } | null
  caller: {
    agent_id: string
    workflow_id: string | null
    tool_key: string
  } | null
  metadata: Record<string, unknown>
}
```

### HTTP Ingest 端口

- **地址:** `127.0.0.1:19823`
- **路径:** `POST /v1/events`
- **请求体:** `{ "events": SkillEvent[] }`
- **响应:** `200 OK` / `429 Rate Limited`

### 文件命名规范

- Rust 模块: `src-tauri/src/core/analytics_*.rs`
- Tauri Commands: 在 `src-tauri/src/commands/mod.rs` 中追加
- 前端组件: `src/components/analytics/*.tsx`
- 前端类型: `src/components/analytics/types.ts`
- SDK 目录: `sdk/analytics/`

### 验收标准总览

| 模块 | 最终验收标准 |
|------|------------|
| 01-Backend | `cargo test` 通过；Ingest Server 可接收 POST 请求并写入 SQLite；所有 Tauri Commands 可被前端 invoke |
| 02-SDK | SDK 可独立构建；`tracker.wrap()` 可包装函数并自动上报；离线缓冲可暂存事件 |
| 03-Frontend | `npm run build` 通过；看板页面可渲染 mock 数据；图表组件独立可用 |
| 04-Integration | SDK 上报 → Ingest 接收 → SQLite 存储 → 前端看板展示，全链路跑通 |
