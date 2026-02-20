# Frontend: React Analytics Dashboard (Part 1)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 在 Skills Hub 前端构建完整的 Analytics 看板页面，包含统计卡片、趋势图表、Top 排行、告警面板、成本分析、用户留存和依赖关系图。

**Architecture:** 新建 `src/components/analytics/` 目录，包含独立的看板组件。使用 recharts 绑制图表，通过 Tauri invoke 调用后端查询接口。在现有 SkillCard 中增加 Analytics 入口按钮。

**Tech Stack:** React 19, TypeScript, recharts (新增依赖), Tailwind CSS 4, Tauri invoke API

**并行说明:** 本模块与 01-backend、02-sdk 无依赖，可独立实施。前端组件使用 mock 数据开发，集成阶段再接入真实后端。

**注意:** 本文件包含 Task 1-6，Part 2 包含 Task 7-12 和验收清单。

---

## Task 1: 安装 recharts 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 recharts**

Run: `npm install recharts`

**Step 2: 验证安装**

Run: `grep recharts package.json`
Expected: `"recharts": "^2.x.x"` 出现在 dependencies 中

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for analytics charts"
```

**🔍 检测点:** `npm ls recharts` 无错误
**✅ 验收标准:** recharts 出现在 `package.json` 的 dependencies 中

---

## Task 2: 定义 Analytics 类型 — types.ts

**Files:**
- Create: `src/components/analytics/types.ts`

**Step 1: 创建类型定义文件**

```typescript
export interface AnalyticsOverview {
  total_calls: number
  success_rate: number
  p95_latency_ms: number | null
  active_users: number
  total_calls_delta_pct: number | null
  success_rate_delta: number | null
  p95_latency_delta_ms: number | null
  active_users_delta: number | null
}

export interface DailyStats {
  skill_id: string
  date: string
  total_calls: number
  success_count: number
  fail_count: number
  p50_ms: number | null
  p95_ms: number | null
  p99_ms: number | null
  avg_ms: number | null
  unique_users: number
  total_cost_usd: number
  thumbs_up: number
  thumbs_down: number
}

export interface TopSkillEntry {
  skill_id: string
  call_count: number
  success_rate: number
  avg_latency_ms: number | null
}

export interface AnalyticsAlert {
  id: string
  skill_id: string
  alert_type: string
  severity: string
  message: string
  detected_at: number
  resolved_at: number | null
  acknowledged: boolean
}

export interface CallerDependency {
  caller_agent: string
  caller_tool: string
  skill_id: string
  call_count: number
}

export interface UserRetentionPair {
  skill_a: string
  skill_b: string
  users_both: number
  users_a_only: number
  retention_rate: number
}

export interface CostRoiEntry {
  skill_id: string
  call_count: number
  total_cost_usd: number
  success_rate: number
  thumbs_up_rate: number
  roi_label: 'High' | 'Medium' | 'Low'
}

export type TimeRange = 7 | 14 | 30 | 90
```

**Step 2: Commit**

```bash
git add src/components/analytics/types.ts
git commit -m "feat(analytics-ui): define TypeScript types for analytics dashboard"
```

**🔍 检测点:** 文件创建成功
**✅ 验收标准:** 所有类型与后端 Rust struct 的 Serialize 输出一一对应

---

## Task 3: 创建 OverviewCards 组件

**Files:**
- Create: `src/components/analytics/OverviewCards.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import { TrendingUp, TrendingDown, Activity, Users, Clock, CheckCircle } from 'lucide-react'
import type { AnalyticsOverview } from './types'

interface OverviewCardsProps {
  data: AnalyticsOverview | null
  loading: boolean
}

interface StatCardProps {
  title: string
  value: string
  delta: string | null
  deltaPositive: boolean | null
  icon: React.ReactNode
  color: string
}

const StatCard = ({ title, value, delta, deltaPositive, icon, color }: StatCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    {delta !== null && (
      <div className={`flex items-center gap-1 mt-2 text-sm ${
        deltaPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}>
        {deltaPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{delta}</span>
      </div>
    )}
  </div>
)

const OverviewCards = ({ data, loading }: OverviewCardsProps) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toString()
  }

  const formatDelta = (value: number | null, suffix: string): string | null => {
    if (value === null) return null
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}${suffix}`
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Calls"
        value={formatNumber(data.total_calls)}
        delta={formatDelta(data.total_calls_delta_pct, '%')}
        deltaPositive={data.total_calls_delta_pct !== null ? data.total_calls_delta_pct >= 0 : null}
        icon={<Activity size={18} className="text-blue-600" />}
        color="bg-blue-50 dark:bg-blue-900/30"
      />
      <StatCard
        title="Success Rate"
        value={`${(data.success_rate * 100).toFixed(1)}%`}
        delta={formatDelta(data.success_rate_delta !== null ? data.success_rate_delta * 100 : null, '%')}
        deltaPositive={data.success_rate_delta !== null ? data.success_rate_delta >= 0 : null}
        icon={<CheckCircle size={18} className="text-green-600" />}
        color="bg-green-50 dark:bg-green-900/30"
      />
      <StatCard
        title="P95 Latency"
        value={data.p95_latency_ms !== null ? `${data.p95_latency_ms}ms` : 'N/A'}
        delta={formatDelta(data.p95_latency_delta_ms, 'ms')}
        deltaPositive={data.p95_latency_delta_ms !== null ? data.p95_latency_delta_ms <= 0 : null}
        icon={<Clock size={18} className="text-orange-600" />}
        color="bg-orange-50 dark:bg-orange-900/30"
      />
      <StatCard
        title="Active Users"
        value={formatNumber(data.active_users)}
        delta={data.active_users_delta !== null ? `${data.active_users_delta >= 0 ? '+' : ''}${data.active_users_delta}` : null}
        deltaPositive={data.active_users_delta !== null ? data.active_users_delta >= 0 : null}
        icon={<Users size={18} className="text-purple-600" />}
        color="bg-purple-50 dark:bg-purple-900/30"
      />
    </div>
  )
}

export default memo(OverviewCards)
```

**Step 2: Commit**

```bash
git add src/components/analytics/OverviewCards.tsx
git commit -m "feat(analytics-ui): add OverviewCards component with stat cards"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 4 个统计卡片：Total Calls / Success Rate / P95 Latency / Active Users
- 每个卡片显示数值 + 环比变化（带箭头颜色）
- 加载态显示骨架屏动画
- 支持深色模式

---

## Task 4: 创建 DailyTrendChart 组件

**Files:**
- Create: `src/components/analytics/DailyTrendChart.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyStats } from './types'

interface DailyTrendChartProps {
  data: DailyStats[]
  loading: boolean
}

const DailyTrendChart = ({ data, loading }: DailyTrendChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.map((day) => ({
    date: day.date.slice(5), // MM-DD
    calls: day.total_calls,
    success: day.success_count,
    fail: day.fail_count,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        📈 Daily Call Volume
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
          />
          <Area
            type="monotone"
            dataKey="calls"
            stroke="#3B82F6"
            fill="url(#colorCalls)"
            strokeWidth={2}
            name="Total Calls"
          />
          <Area
            type="monotone"
            dataKey="fail"
            stroke="#EF4444"
            fill="url(#colorFail)"
            strokeWidth={1.5}
            name="Failures"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(DailyTrendChart)
```

**Step 2: Commit**

```bash
git add src/components/analytics/DailyTrendChart.tsx
git commit -m "feat(analytics-ui): add DailyTrendChart with area chart"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 渲染 Area Chart，X 轴为日期，Y 轴为调用量
- 蓝色区域表示总调用量，红色区域表示失败数
- 渐变填充效果
- 深色模式 Tooltip 样式

---

## Task 5: 创建 TopSkillsRanking 组件

**Files:**
- Create: `src/components/analytics/TopSkillsRanking.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import type { TopSkillEntry } from './types'

interface TopSkillsRankingProps {
  data: TopSkillEntry[]
  loading: boolean
}

const TopSkillsRanking = ({ data, loading }: TopSkillsRankingProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-8 bg-gray-100 dark:bg-gray-700 rounded mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  const maxCalls = data.length > 0 ? data[0].call_count : 1

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        🏆 Top 10 Skills
      </h3>
      <div className="space-y-3">
        {data.map((skill, index) => {
          const barWidth = (skill.call_count / maxCalls) * 100
          const successColor = skill.success_rate >= 0.95
            ? 'text-green-600 dark:text-green-400'
            : skill.success_rate >= 0.8
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'

          return (
            <div key={skill.skill_id} className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-400 w-5 text-right">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {skill.skill_id}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">{skill.call_count} calls</span>
                    <span className={successColor}>
                      {(skill.success_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
        {data.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
        )}
      </div>
    </div>
  )
}

export default memo(TopSkillsRanking)
```

**Step 2: Commit**

```bash
git add src/components/analytics/TopSkillsRanking.tsx
git commit -m "feat(analytics-ui): add TopSkillsRanking component"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 排名列表显示序号、Skill ID、调用次数、成功率
- 进度条宽度按调用量比例
- 成功率颜色分级（绿/黄/红）
- 空数据显示 "No data yet"

---

## Task 6: 创建 AlertsPanel 组件

**Files:**
- Create: `src/components/analytics/AlertsPanel.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import { AlertTriangle, AlertCircle, Info, Check } from 'lucide-react'
import type { AnalyticsAlert } from './types'

interface AlertsPanelProps {
  alerts: AnalyticsAlert[]
  loading: boolean
  onAcknowledge: (alertId: string) => void
}

const severityConfig = {
  critical: {
    icon: <AlertCircle size={16} />,
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    label: '🔴 Critical',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    label: '🟡 Warning',
  },
  info: {
    icon: <Info size={16} />,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    label: '🔵 Info',
  },
} as const

const AlertsPanel = ({ alerts, loading, onAcknowledge }: AlertsPanelProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const activeAlerts = alerts.filter((a) => !a.acknowledged)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          ⚠️ Active Alerts
        </h3>
        {activeAlerts.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
            {activeAlerts.length}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {activeAlerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 py-3">
            <Check size={16} />
            <span>All clear — no active alerts</span>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig]
              ?? severityConfig.info
            const detectedDate = new Date(alert.detected_at * 1000)
            const timeAgo = getTimeAgo(detectedDate)

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
              >
                <div className={config.text}>{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${config.badge}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo}</span>
                  </div>
                  <p className={`text-sm ${config.text}`}>{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-1">Skill: {alert.skill_id}</p>
                </div>
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Acknowledge"
                >
                  Dismiss
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default memo(AlertsPanel)
```

**Step 2: Commit**

```bash
git add src/components/analytics/AlertsPanel.tsx
git commit -m "feat(analytics-ui): add AlertsPanel with severity-based styling"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 按严重级别（Critical/Warning/Info）显示不同颜色和图标
- 无告警时显示 "All clear" 绿色提示
- 每条告警显示时间、消息、Skill ID
- Dismiss 按钮可确认告警

---

**Part 1 完成。请继续查看 Part 2 文件获取 Task 7-12 和验收清单。**
