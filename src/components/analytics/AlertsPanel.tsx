import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Info, Check, ExternalLink } from 'lucide-react'
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
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const activeAlerts = alerts.filter((a) => !a.acknowledged)

  const handleSkillClick = (skillId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation()
    if (skillId) {
      navigate(`/skill/${encodeURIComponent(skillId)}`)
    }
  }

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
                  {alert.skill_id && (
                    <button
                      onClick={(e) => handleSkillClick(alert.skill_id, e)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1 group/link"
                    >
                      <span>Skill: {alert.skill_id}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </button>
                  )}
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
