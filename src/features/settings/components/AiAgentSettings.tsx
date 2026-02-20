import { useCallback, useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'

interface AiAgentDto {
  id: string
  name: string
  api_key: string
  base_url: string
  created_at: number
  updated_at: number
}

interface AiAgentSettingsProps {
  isTauri: boolean
}

export default function AiAgentSettings({ isTauri }: AiAgentSettingsProps) {
  const { t } = useTranslation()
  const [aiAgents, setAiAgents] = useState<AiAgentDto[]>([])
  const [newAiAgentName, setNewAiAgentName] = useState<string>('')
  const [newAiAgentApiKey, setNewAiAgentApiKey] = useState<string>('')
  const [newAiAgentBaseUrl, setNewAiAgentBaseUrl] = useState<string>('')
  const [isAiAgentsExpanded, setIsAiAgentsExpanded] = useState<boolean>(false)

  const loadAiAgents = useCallback(async () => {
    if (!isTauri) return
    try {
      const agents = await invoke<AiAgentDto[]>('list_ai_agents')
      setAiAgents(agents)
    } catch {
      setAiAgents([])
    }
  }, [isTauri])

  const handleAddAiAgent = useCallback(async () => {
    if (!isTauri) return
    const name = newAiAgentName.trim()
    const apiKey = newAiAgentApiKey.trim()
    const baseUrl = newAiAgentBaseUrl.trim()
    
    if (!name || !apiKey || !baseUrl) return
    
    try {
      await invoke('add_ai_agent', { name, apiKey, baseUrl })
      await loadAiAgents()
      setNewAiAgentName('')
      setNewAiAgentApiKey('')
      setNewAiAgentBaseUrl('')
    } catch (err) {
      console.error('Failed to add AI agent:', err)
    }
  }, [isTauri, newAiAgentName, newAiAgentApiKey, newAiAgentBaseUrl, loadAiAgents])

  const handleRemoveAiAgent = useCallback(
    async (agentId: string) => {
      if (!isTauri) return
      try {
        await invoke('remove_ai_agent', { id: agentId })
        await loadAiAgents()
      } catch (err) {
        console.error('Failed to remove AI agent:', err)
      }
    },
    [isTauri, loadAiAgents],
  )

  useEffect(() => {
    if (!isAiAgentsExpanded) {
      setAiAgents([])
      return
    }
    void loadAiAgents()
  }, [loadAiAgents, isAiAgentsExpanded])

  return (
    <div className="settings-field">
      <button
        className="settings-collapsible-header"
        type="button"
        onClick={() => setIsAiAgentsExpanded(!isAiAgentsExpanded)}
        aria-expanded={isAiAgentsExpanded}
      >
        <span className="settings-collapsible-title">
          {t('aiAgents')}
        </span>
        <svg
          className={`settings-collapsible-icon ${
            isAiAgentsExpanded ? 'expanded' : ''
          }`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isAiAgentsExpanded && (
        <div className="settings-collapsible-content">
          <div className="settings-helper">{t('aiAgentsHint')}</div>
          
          {aiAgents.length > 0 && (
            <div className="settings-scan-paths-section">
              <div className="settings-scan-paths-list">
                {aiAgents.map((agent) => (
                  <div key={agent.id} className="settings-scan-path-item">
                    <div className="settings-agent-display">
                      <div className="settings-agent-text">
                        <div className="settings-agent-name">{agent.name}</div>
                        <div className="settings-agent-url">{agent.base_url}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary settings-remove-path"
                      type="button"
                      onClick={() => handleRemoveAiAgent(agent.id)}
                      aria-label={t('removeAiAgent')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="settings-scan-paths-section">
            <div className="settings-scan-paths-label">{t('addNewAiAgent')}</div>
            <div className="settings-input-row">
              <input
                className="settings-input"
                type="text"
                value={newAiAgentName}
                onChange={(e) => setNewAiAgentName(e.target.value)}
                placeholder={t('aiAgentName')}
              />
            </div>
            <div className="settings-input-row">
              <input
                className="settings-input mono"
                type="password"
                value={newAiAgentApiKey}
                onChange={(e) => setNewAiAgentApiKey(e.target.value)}
                placeholder={t('aiAgentApiKey')}
              />
            </div>
            <div className="settings-input-row">
              <input
                className="settings-input mono"
                type="text"
                value={newAiAgentBaseUrl}
                onChange={(e) => setNewAiAgentBaseUrl(e.target.value)}
                placeholder={t('aiAgentBaseUrl')}
              />
              <button
                className="btn btn-secondary settings-browse"
                type="button"
                onClick={handleAddAiAgent}
                disabled={!newAiAgentName.trim() || !newAiAgentApiKey.trim() || !newAiAgentBaseUrl.trim()}
              >
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
