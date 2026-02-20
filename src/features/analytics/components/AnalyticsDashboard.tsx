import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { Activity, RefreshCw, BookOpen } from 'lucide-react'
import OverviewCards from '../../../components/analytics/OverviewCards'
import DailyTrendChart from '../../../components/analytics/DailyTrendChart'
import TopSkillsRanking from '../../../components/analytics/TopSkillsRanking'
import AlertsPanel from '../../../components/analytics/AlertsPanel'
import CostRoiTable from '../../../components/analytics/CostRoiTable'
import SuccessRateChart from '../../../components/analytics/SuccessRateChart'
import UserRetentionChart from '../../../components/analytics/UserRetentionChart'
import DependencyGraph from '../../../components/analytics/DependencyGraph'
import type {
  OverviewStats,
  DailyStats,
  TopSkillEntry,
  AnalyticsAlert,
  CallerDependency,
} from '../../../components/analytics/types'

// Helper function to invoke Tauri commands with error handling
const invokeTauri = async <T,>(command: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    console.error(`Failed to invoke Tauri command ${command}:`, error)
    throw error
  }
}

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [topSkills, setTopSkills] = useState<TopSkillEntry[]>([])
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([])
  const [callerDependencies, setCallerDependencies] = useState<CallerDependency[]>([])

  // Fetch all analytics data from backend
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch data in parallel
      const [overviewData, dailyTrendData, topSkillsData, alertsData, callerData] = await Promise.all([
        invokeTauri<OverviewStats>('get_analytics_overview', { days: 7 }),
        invokeTauri<DailyStats[]>('get_analytics_daily_trend', { days: 30 }),
        invokeTauri<TopSkillEntry[]>('get_analytics_top_skills', { days: 7, limit: 10 }),
        invokeTauri<AnalyticsAlert[]>('get_analytics_alerts'),
        invokeTauri<CallerDependency[]>('get_analytics_caller_analysis', { days: 30 }),
      ])

      setOverview(overviewData)
      setDailyStats(dailyTrendData)
      setTopSkills(topSkillsData)
      setAlerts(alertsData)
      setCallerDependencies(callerData)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
      // Set empty state on error
      setOverview(null)
      setDailyStats([])
      setTopSkills([])
      setAlerts([])
      setCallerDependencies([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  const handleRefresh = useCallback(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await invokeTauri('acknowledge_analytics_alert', { alertId })
      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert,
        ),
      )
    } catch (error) {
      console.error('Failed to acknowledge alert:', error)
    }
  }, [])

  const handleDownloadSDKDocs = useCallback(async () => {
    try {
      // 从 docs 目录读取 SDK 文档
      const sdkDocsResponse = await fetch('/docs/analytics-sdk-guide.md')
      if (!sdkDocsResponse.ok) {
        throw new Error(`Failed to fetch SDK docs: ${sdkDocsResponse.statusText}`)
      }
      const sdkDocs = await sdkDocsResponse.text()

      const filePath = await invoke<string>('save_file_with_dialog', {
        content: sdkDocs,
        defaultFilename: '@skillshub-analytics-sdk-guide.md'
      })
      
      toast.success('文档下载成功', {
        description: `已保存到: ${filePath}`
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 用户取消文件选择不算错误
      if (errorMessage.includes('cancelled')) {
        return
      }
      
      console.error('[SDK Docs] Failed to download:', error)
      toast.error('下载失败', {
        description: errorMessage
      })
    }
  }, [])

  const handleDownloadMCPDocs = useCallback(async () => {
    try {
      // 从 docs 目录读取 MCP 文档
      const mcpDocsResponse = await fetch('/docs/mcp-analytics-guide.md')
      if (!mcpDocsResponse.ok) {
        throw new Error(`Failed to fetch MCP docs: ${mcpDocsResponse.statusText}`)
      }
      const mcpDocs = await mcpDocsResponse.text()

      const filePath = await invoke<string>('save_file_with_dialog', {
        content: mcpDocs,
        defaultFilename: '@skillshub-mcp-analytics-guide.md'
      })
      
      toast.success('文档下载成功', {
        description: `已保存到: ${filePath}`
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 用户取消文件选择不算错误
      if (errorMessage.includes('cancelled')) {
        return
      }
      
      console.error('[MCP Docs] Failed to download:', error)
      toast.error('下载失败', {
        description: errorMessage
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with gradient and glassmorphism */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 dark:from-blue-500/5 dark:via-purple-600/5 dark:to-pink-500/5 rounded-2xl blur-3xl" />
          <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    Skills Analytics
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Real-time monitoring
                    </span>
                    <span className="text-gray-400">•</span>
                    <span>Last updated: just now</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadSDKDocs}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 shadow-sm hover:shadow-md group"
                  title="Download SDK Documentation"
                >
                  <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">SDK Docs</span>
                </button>
                <button
                  onClick={handleDownloadMCPDocs}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 shadow-sm hover:shadow-md group"
                  title="Download MCP Documentation"
                >
                  <BookOpen className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">MCP Docs</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="mb-8">
          <OverviewCards data={overview} loading={loading} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <DailyTrendChart data={dailyStats} loading={loading} />
          <SuccessRateChart data={dailyStats} loading={loading} />
        </div>

        {/* Cost/ROI and Top Skills */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <CostRoiTable data={topSkills} loading={loading} />
          <TopSkillsRanking data={topSkills} loading={loading} />
        </div>

        {/* Alerts and Retention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <AlertsPanel
            alerts={alerts}
            loading={loading}
            onAcknowledge={handleAcknowledgeAlert}
          />
          <UserRetentionChart data={dailyStats} loading={loading} />
        </div>

        {/* Dependency Graph */}
        <div className="mb-6">
          <DependencyGraph data={callerDependencies} loading={loading} />
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>📊 Analytics data is updated in real-time • Showing last 30 days</p>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsDashboard