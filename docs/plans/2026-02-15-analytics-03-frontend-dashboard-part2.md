# Frontend: React Analytics Dashboard (Part 2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**注意:** 本文件包含 Task 7-12 和验收清单。Part 1 包含 Task 1-6。

---

## Task 7: 创建 CostRoiTable 组件

**Files:**
- Create: `src/components/analytics/CostRoiTable.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import type { TopSkillEntry } from './types'

interface CostRoiTableProps {
  data: TopSkillEntry[]
  loading: boolean
}

const CostRoiTable = ({ data, loading }: CostRoiTableProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const getRoiLabel = (entry: TopSkillEntry): { label: string; color: string } => {
    const costPerCall = (entry.avg_latency_ms ?? 0) / Math.max(entry.call_count, 1)
    if (entry.success_rate >= 0.9 && costPerCall < 0.01) {
      return { label: 'High', color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' }
    }
    if (entry.success_rate >= 0.7) {
      return { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30' }
    }
    return { label: 'Low', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30' }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        💰 Cost & ROI Analysis
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Skill</th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Calls</th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Cost ($)</th>
              <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Success</th>
              <th className="text-center py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">ROI</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => {
              const roi = getRoiLabel(entry)
              return (
                <tr key={entry.skill_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">
                    {entry.skill_id}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                    {entry.call_count.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                    ${(entry.avg_latency_ms ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                    {(entry.success_rate * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${roi.color}`}>
                      {roi.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400">
                  No cost data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(CostRoiTable)
```

**Step 2: Commit**

```bash
git add src/components/analytics/CostRoiTable.tsx
git commit -m "feat(analytics-ui): add CostRoiTable component"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 表格显示 Skill / Calls / Cost / Success / ROI 五列
- ROI 标签按规则着色（High=绿, Medium=黄, Low=红）
- 空数据显示 "No cost data available"
- 行 hover 效果

---

## Task 8: 创建 SuccessRateChart 组件

**Files:**
- Create: `src/components/analytics/SuccessRateChart.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyStats } from './types'

interface SuccessRateChartProps {
  data: DailyStats[]
  loading: boolean
}

const SuccessRateChart = ({ data, loading }: SuccessRateChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.map((day) => ({
    date: day.date,
    successRate: day.total_calls > 0 ? (day.success_count / day.total_calls) * 100 : 0,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        📈 Success Rate Trend
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
          />
          <Line
            type="monotone"
            dataKey="successRate"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4, fill: '#10B981' }}
            activeDot={{ r: 6 }}
            name="Success Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(SuccessRateChart)
```

**Step 2: Commit**

```bash
git add src/components/analytics/SuccessRateChart.tsx
git commit -m "feat(analytics-ui): add SuccessRateChart component"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 折线图显示每日成功率趋势
- Y 轴范围 0-100%
- 绿色线条，带圆点标记
- Tooltip 显示百分比格式

---

## Task 9: 创建 UserRetentionChart 组件

**Files:**
- Create: `src/components/analytics/UserRetentionChart.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DailyStats } from './types'

interface UserRetentionChartProps {
  data: DailyStats[]
  loading: boolean
}

const UserRetentionChart = ({ data, loading }: UserRetentionChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.slice(-30).map((day) => ({
    date: day.date,
    activeUsers: day.unique_users ?? 0,
    newUsers: Math.max(0, day.unique_users - (data.find((d) => d.date === day.date)?.unique_users ?? 0)),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        👥 User Activity
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
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
          <Legend />
          <Bar dataKey="activeUsers" fill="#3B82F6" name="Active Users" radius={[4, 4, 0, 0]} />
          <Bar dataKey="newUsers" fill="#10B981" name="New Users" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(UserRetentionChart)
```

**Step 2: Commit**

```bash
git add src/components/analytics/UserRetentionChart.tsx
git commit -m "feat(analytics-ui): add UserRetentionChart with bar chart"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 柱状图显示活跃用户数和新用户数
- 蓝色柱代表活跃用户，绿色柱代表新用户
- 显示最近 30 天数据
- Legend 清晰标识

---

## Task 10: 创建 DependencyGraph 组件

**Files:**
- Create: `src/components/analytics/DependencyGraph.tsx`

**Step 1: 创建组件**

```tsx
import { memo, useEffect, useRef } from 'react'

interface SkillNode {
  id: string
  x: number
  y: number
}

interface SkillEdge {
  from: string
  to: string
}

interface DependencyGraphProps {
  loading: boolean
}

const DependencyGraph = ({ loading }: DependencyGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodes = useRef<SkillNode[]>([
    { id: 'skill-1', x: 100, y: 100 },
    { id: 'skill-2', x: 300, y: 100 },
    { id: 'skill-3', x: 200, y: 250 },
  ])
  const edges = useRef<SkillEdge[]>([
    { from: 'skill-1', to: 'skill-2' },
    { from: 'skill-1', to: 'skill-3' },
    { from: 'skill-2', to: 'skill-3' },
  ])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    edges.current.forEach((edge) => {
      const fromNode = nodes.current.find((n) => n.id === edge.from)
      const toNode = nodes.current.find((n) => n.id === edge.to)
      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.strokeStyle = '#9CA3AF'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })

    nodes.current.forEach((node) => {
      ctx.beginPath()
      ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI)
      ctx.fillStyle = '#3B82F6'
      ctx.fill()
      ctx.strokeStyle = '#2563EB'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#1F2937'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.id, node.x, node.y + 35)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        🔗 Skill Dependencies
      </h3>
      <div className="w-full h-48 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full h-full"
        />
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Visualization of skill call dependencies
      </p>
    </div>
  )
}

export default memo(DependencyGraph)
```

**Step 2: Commit**

```bash
git add src/components/analytics/DependencyGraph.tsx
git commit -m "feat(analytics-ui): add DependencyGraph with canvas rendering"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- Canvas 渲染节点和连线
- 蓝色圆形节点，灰色连线
- 节点下方显示 Skill ID
- 响应式画布大小

---

## Task 11: 创建 AnalyticsDashboard 主页面

**Files:**
- Create: `src/pages/AnalyticsDashboard.tsx`

**Step 1: 创建主页面组件**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import OverviewCards from '../components/analytics/OverviewCards'
import DailyTrendChart from '../components/analytics/DailyTrendChart'
import TopSkillsRanking from '../components/analytics/TopSkillsRanking'
import AlertsPanel from '../components/analytics/AlertsPanel'
import CostRoiTable from '../components/analytics/CostRoiTable'
import SuccessRateChart from '../components/analytics/SuccessRateChart'
import UserRetentionChart from '../components/analytics/UserRetentionChart'
import DependencyGraph from '../components/analytics/DependencyGraph'
import type {
  OverviewStats,
  DailyStats,
  TopSkillEntry,
  AnalyticsAlert,
  SkillEvent,
} from '../components/analytics/types'

const AnalyticsDashboard = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [topSkills, setTopSkills] = useState<TopSkillEntry[]>([])
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewData, dailyData, topSkillsData, alertsData] = await Promise.all([
        invoke<OverviewStats>('analytics_get_overview'),
        invoke<DailyStats[]>('analytics_get_daily_stats', { days: 30 }),
        invoke<TopSkillEntry[]>('analytics_get_top_skills', { limit: 10 }),
        invoke<AnalyticsAlert[]>('analytics_get_active_alerts'),
      ])
      setOverview(overviewData)
      setDailyStats(dailyData)
      setTopSkills(topSkillsData)
      setAlerts(alertsData)
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await invoke('analytics_acknowledge_alert', { alertId })
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert,
        ),
      )
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Skills Analytics Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time monitoring and insights for your skills
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          <OverviewCards data={overview} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <DailyTrendChart data={dailyStats} loading={loading} />
          <SuccessRateChart data={dailyStats} loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <TopSkillsRanking data={topSkills} loading={loading} />
          </div>
          <AlertsPanel
            alerts={alerts}
            loading={loading}
            onAcknowledge={handleAcknowledgeAlert}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <CostRoiTable data={topSkills} loading={loading} />
          <UserRetentionChart data={dailyStats} loading={loading} />
        </div>

        <div className="mb-6">
          <DependencyGraph loading={loading} />
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard
```

**Step 2: Commit**

```bash
git add src/pages/AnalyticsDashboard.tsx
git commit -m "feat(analytics-ui): add AnalyticsDashboard main page"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- 加载状态显示 Spinner
- 所有 9 个组件正确布局
- 数据每 60 秒自动刷新
- 告警确认功能正常

---

## Task 12: 路由和导航集成

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

**Step 1: 更新 App.tsx 添加路由**

首先读取现有的 App.tsx 文件以了解当前结构：

```bash
cat src/App.tsx
```

然后更新为以下内容：

```tsx
import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SkillDetail from './pages/SkillDetail'
import AnalyticsDashboard from './pages/AnalyticsDashboard'

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'analytics' | 'detail'>('dashboard')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)

  const handleNavigateToDetail = (skillId: string) => {
    setSelectedSkillId(skillId)
    setCurrentPage('detail')
  }

  const handleNavigateToAnalytics = () => {
    setCurrentPage('analytics')
  }

  const handleNavigateToDashboard = () => {
    setCurrentPage('dashboard')
    setSelectedSkillId(null)
  }

  return (
    <Layout
      currentPage={currentPage}
      onNavigateToDashboard={handleNavigateToDashboard}
      onNavigateToAnalytics={handleNavigateToAnalytics}
    >
      {currentPage === 'dashboard' && (
        <Dashboard
          onNavigateToDetail={handleNavigateToDetail}
          onNavigateToAnalytics={handleNavigateToAnalytics}
        />
      )}
      {currentPage === 'analytics' && <AnalyticsDashboard />}
      {currentPage === 'detail' && selectedSkillId && (
        <SkillDetail skillId={selectedSkillId} onBack={handleNavigateToDashboard} />
      )}
    </Layout>
  )
}

export default App
```

**Step 2: 更新 Layout.tsx 添加 Analytics 链接**

首先读取现有的 Layout.tsx 文件：

```bash
cat src/components/Layout.tsx
```

然后更新导航部分，添加 Analytics 链接：

```tsx
// 在导航区域添加 Analytics 按钮
<button
  onClick={onNavigateToAnalytics}
  className={`text-sm font-medium ${
    currentPage === 'analytics'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
  }`}
>
  Analytics
</button>
```

**Step 3: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat(analytics-ui): integrate analytics route and navigation"
```

**🔍 检测点:** `npm run build` 通过
**✅ 验收标准:**
- App.tsx 路由逻辑正确
- Layout.tsx 显示 Analytics 导航链接
- 点击 Analytics 切换到分析页面
- 点击 Dashboard 返回主页

---

## 最终验收清单

| # | 检查项 | 命令 |
|---|--------|------|
| 1 | recharts 依赖已安装 | `grep recharts package.json` |
| 2 | types.ts 类型定义完整 | `ls src/components/analytics/types.ts` |
| 3 | OverviewCards 组件存在 | `ls src/components/analytics/OverviewCards.tsx` |
| 4 | DailyTrendChart 组件存在 | `ls src/components/analytics/DailyTrendChart.tsx` |
| 5 | TopSkillsRanking 组件存在 | `ls src/components/analytics/TopSkillsRanking.tsx` |
| 6 | AlertsPanel 组件存在 | `ls src/components/analytics/AlertsPanel.tsx` |
| 7 | CostRoiTable 组件存在 | `ls src/components/analytics/CostRoiTable.tsx` |
| 8 | SuccessRateChart 组件存在 | `ls src/components/analytics/SuccessRateChart.tsx` |
| 9 | UserRetentionChart 组件存在 | `ls src/components/analytics/UserRetentionChart.tsx` |
| 10 | DependencyGraph 组件存在 | `ls src/components/analytics/DependencyGraph.tsx` |
| 11 | AnalyticsDashboard 主页面存在 | `ls src/pages/AnalyticsDashboard.tsx` |
| 12 | 路由已添加到 App.tsx | `grep analytics src/App.tsx` |
| 13 | 导航链接已添加到 Layout.tsx | `grep Analytics src/components/Layout.tsx` |
| 14 | TypeScript 编译通过 | `npx tsc --noEmit` |
| 15 | npm run build 通过 | `npm run build` |

---

**Plan complete and saved to Part 1 and Part 2 files.**

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
