import { memo } from 'react'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { TFunction } from 'i18next'
import type { ToolOption, ToolStatusDto } from '../types'

type AddSkillModalProps = {
  open: boolean
  loading: boolean
  canClose: boolean
  addModalTab: 'local' | 'git' | 'quick'
  localPath: string
  localName: string
  gitUrl: string
  gitName: string
  syncTargets: Record<string, boolean>
  installedTools: ToolOption[]
  toolStatus: ToolStatusDto | null
  isTauri: boolean
  invokeTauri: <T = unknown>(command: string, args?: unknown) => Promise<T>
  onRequestClose: () => void
  onTabChange: (tab: 'local' | 'git' | 'quick') => void
  onLocalPathChange: (value: string) => void
  onPickLocalPath: () => void
  onLocalNameChange: (value: string) => void
  onGitUrlChange: (value: string) => void
  onGitNameChange: (value: string) => void
  onSyncTargetChange: (toolId: string, checked: boolean) => void
  onSubmit: () => void
  onInstallQuickSkill?: () => void
  onViewQuickSkill?: () => void
  t: TFunction
}

const AddSkillModal = ({
  open,
  loading,
  canClose,
  addModalTab,
  localPath,
  localName,
  gitUrl,
  gitName,
  syncTargets,
  installedTools,
  toolStatus,
  isTauri,
  invokeTauri,
  onRequestClose,
  onTabChange,
  onLocalPathChange,
  onPickLocalPath,
  onLocalNameChange,
  onGitUrlChange,
  onGitNameChange,
  onSyncTargetChange,
  onSubmit,
  onInstallQuickSkill,
  onViewQuickSkill,
  t,
}: AddSkillModalProps) => {
  if (!open) return null

  const handleOpenGuide = async () => {
    const url = 'https://www.deeplearning.ai/short-courses/agent-skills-with-anthropic/'
    console.log('handleOpenGuide called, isTauri:', isTauri)
    
    if (isTauri) {
      try {
        console.log('Attempting to open URL with openUrl:', url)
        await openUrl(url)
        console.log('URL opened successfully with openUrl')
      } catch (err) {
        console.error('Failed to open URL in Tauri:', err)
        // Fallback to window.open if Tauri fails
        console.log('Falling back to window.open')
        window.open(url, '_blank')
      }
    } else {
      console.log('Not in Tauri environment, using window.open')
      window.open(url, '_blank')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={() => (canClose ? onRequestClose() : null)}
    >
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t('addSkillTitle')}</div>
          <button
            className="modal-close"
            type="button"
            onClick={onRequestClose}
            aria-label={t('close')}
            disabled={!canClose}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="tabs">
            <button
              className={`tab-item${addModalTab === 'quick' ? ' active' : ''}`}
              type="button"
              onClick={() => onTabChange('quick')}
            >
              {t('quickTab')}
            </button>
            <button
              className={`tab-item${addModalTab === 'local' ? ' active' : ''}`}
              type="button"
              onClick={() => onTabChange('local')}
            >
              {t('localTab')}
            </button>
            <button
              className={`tab-item${addModalTab === 'git' ? ' active' : ''}`}
              type="button"
              onClick={() => onTabChange('git')}
            >
              {t('gitTab')}
            </button>
          </div>

          {addModalTab === 'quick' ? (
            <>
              <div className="form-group">
                <div style={{ marginBottom: '16px' }}>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={(e) => {
                      console.log('Skill Creation Guide button clicked')
                      e.stopPropagation()
                      void handleOpenGuide()
                    }}
                    style={{ width: '100%' }}
                  >
                    📚 {t('skillCreationGuide')}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">{t('recommendedSkill')}</label>
                <div className="quick-skill-card">
                  <div className="quick-skill-header">
                    <div className="quick-skill-name">skill-creator-enhanced</div>
                  </div>
                  <div className="quick-skill-description">
                    {t('skillCreatorEnhancedDesc')}
                  </div>
                  <div className="quick-skill-actions">
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onViewQuickSkill) onViewQuickSkill()
                      }}
                      disabled={loading}
                    >
                      {t('view')}
                    </button>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onInstallQuickSkill) onInstallQuickSkill()
                      }}
                      disabled={loading}
                    >
                      {t('install')}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : addModalTab === 'local' ? (
            <>
              <div className="form-group">
                <label className="label">{t('localFolder')}</label>
                <div className="input-row">
                  <input
                    className="input"
                    placeholder={t('localPathPlaceholder')}
                    value={localPath}
                    onChange={(event) => onLocalPathChange(event.target.value)}
                  />
                  <button
                    className="btn btn-secondary input-action"
                    type="button"
                    onClick={onPickLocalPath}
                    disabled={!canClose}
                  >
                    {t('browse')}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="label">{t('optionalNamePlaceholder')}</label>
                <input
                  className="input"
                  placeholder={t('optionalNamePlaceholder')}
                  value={localName}
                  onChange={(event) => onLocalNameChange(event.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="label">{t('repositoryUrl')}</label>
                <input
                  className="input"
                  placeholder={t('gitUrlPlaceholder')}
                  value={gitUrl}
                  onChange={(event) => onGitUrlChange(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="label">{t('optionalNamePlaceholder')}</label>
                <input
                  className="input"
                  placeholder={t('optionalNamePlaceholder')}
                  value={gitName}
                  onChange={(event) => onGitNameChange(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="label">{t('installToTools')}</label>
            {toolStatus ? (
              <div className="tool-matrix">
                {installedTools.map((tool) => (
                  <label
                    key={tool.id}
                    className={`tool-pill-toggle${
                      syncTargets[tool.id] ? ' active' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(syncTargets[tool.id])}
                      onChange={(event) =>
                        onSyncTargetChange(tool.id, event.target.checked)
                      }
                    />
                    {syncTargets[tool.id] ? <span className="status-badge" /> : null}
                    {tool.label}
                  </label>
                ))}
              </div>
            ) : (
              <div className="helper-text">{t('detectingTools')}</div>
            )}
            <div className="helper-text">{t('syncAfterCreate')}</div>
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onRequestClose}
            disabled={!canClose}
          >
            {t('cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={loading || addModalTab === 'quick'}
            style={{ display: addModalTab === 'quick' ? 'none' : 'block' }}
          >
            {addModalTab === 'local' ? t('create') : t('install')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(AddSkillModal)
