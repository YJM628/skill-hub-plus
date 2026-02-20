import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TFunction } from 'i18next'
import type { TranslationServiceType } from '../../../services/translationService'
import TranslationSettings from './TranslationSettings'
import AiAgentSettings from './AiAgentSettings'
import SkillDirectorySettings from './SkillDirectorySettings'

type SettingsModalProps = {
  open: boolean
  isTauri: boolean
  language: string
  storagePath: string
  gitCacheCleanupDays: number
  gitCacheTtlSecs: number
  autoUpdateEnabled: boolean
  themePreference: 'system' | 'light' | 'dark'
  translationApiKey: string
  onTranslationApiKeyChange: (key: string) => void
  translationServiceType: TranslationServiceType
  onTranslationServiceTypeChange: (type: TranslationServiceType) => void
  googleTranslationApiKey: string
  onGoogleTranslationApiKeyChange: (key: string) => void
  libreTranslateApiKey: string
  libreTranslateApiUrl: string
  onLibreTranslateApiKeyChange: (key: string) => void
  onLibreTranslateApiUrlChange: (url: string) => void
  onRequestClose: () => void
  onPickStoragePath: () => void
  onToggleLanguage: () => void
  onThemeChange: (nextTheme: 'system' | 'light' | 'dark') => void
  onGitCacheCleanupDaysChange: (nextDays: number) => void
  onGitCacheTtlSecsChange: (nextSecs: number) => void
  onAutoUpdateToggle: (enabled: boolean) => void
  onClearGitCacheNow: () => void
  t: TFunction
}

const SettingsModal = ({
  open,
  isTauri,
  language,
  storagePath,
  gitCacheCleanupDays,
  gitCacheTtlSecs,
  autoUpdateEnabled,
  themePreference,
  translationApiKey,
  translationServiceType,
  googleTranslationApiKey,
  libreTranslateApiKey,
  libreTranslateApiUrl,
  onPickStoragePath,
  onToggleLanguage,
  onThemeChange,
  onGitCacheCleanupDaysChange,
  onGitCacheTtlSecsChange,
  onAutoUpdateToggle,
  onClearGitCacheNow,
  onTranslationApiKeyChange,
  onTranslationServiceTypeChange,
  onGoogleTranslationApiKeyChange,
  onLibreTranslateApiKeyChange,
  onLibreTranslateApiUrlChange,
  onRequestClose,
  t,
}: SettingsModalProps) => {
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const versionText = useMemo(() => {
    if (!isTauri) return t('notAvailable')
    if (!appVersion) return t('unknown')
    return `v${appVersion}`
  }, [appVersion, isTauri, t])

  const loadAppVersion = useCallback(async () => {
    if (!isTauri) {
      setAppVersion(null)
      return
    }
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      const v = await getVersion()
      setAppVersion(v)
    } catch {
      setAppVersion(null)
    }
  }, [isTauri])



  useEffect(() => {
    if (!open) {
      setAppVersion(null)
      return
    }
    void loadAppVersion()
  }, [loadAppVersion, open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onRequestClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="settings-title">
            {t('settings')}
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onRequestClose}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <div className="modal-body settings-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-language">
              {t('interfaceLanguage')}
            </label>
            <div className="settings-select-wrap">
              <select
                id="settings-language"
                className="settings-select"
                value={language}
                onChange={(event) => {
                  if (event.target.value !== language) {
                    onToggleLanguage()
                  }
                }}
              >
                <option value="en">{t('languageOptions.en')}</option>
                <option value="zh">{t('languageOptions.zh')}</option>
              </select>
              <svg
                className="settings-select-caret"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label" id="settings-theme-label">
              {t('themeMode')}
            </label>
            <div className="settings-theme-options" role="group" aria-labelledby="settings-theme-label">
              <button
                type="button"
                className={`settings-theme-btn ${
                  themePreference === 'system' ? 'active' : ''
                }`}
                aria-pressed={themePreference === 'system'}
                onClick={() => onThemeChange('system')}
              >
                {t('themeOptions.system')}
              </button>
              <button
                type="button"
                className={`settings-theme-btn ${
                  themePreference === 'light' ? 'active' : ''
                }`}
                aria-pressed={themePreference === 'light'}
                onClick={() => onThemeChange('light')}
              >
                {t('themeOptions.light')}
              </button>
              <button
                type="button"
                className={`settings-theme-btn ${
                  themePreference === 'dark' ? 'active' : ''
                }`}
                aria-pressed={themePreference === 'dark'}
                onClick={() => onThemeChange('dark')}
              >
                {t('themeOptions.dark')}
              </button>
            </div>
          </div>

          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-storage">
              {t('skillsStoragePath')}
            </label>
            <div className="settings-input-row">
              <input
                id="settings-storage"
                className="settings-input mono"
                value={storagePath}
                readOnly
              />
              <button
                className="btn btn-secondary settings-browse"
                type="button"
                onClick={onPickStoragePath}
              >
                {t('browse')}
              </button>
            </div>
            <div className="settings-helper">{t('skillsStorageHint')}</div>
          </div>

          <SkillDirectorySettings isTauri={isTauri} t={t} />

          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-git-cache-days">
              {t('gitCacheCleanupDays')}
            </label>
            <div className="settings-input-row">
              <input
                id="settings-git-cache-days"
                className="settings-input"
                type="number"
                min={0}
                max={3650}
                step={1}
                value={gitCacheCleanupDays}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isNaN(next)) {
                    onGitCacheCleanupDaysChange(next)
                  }
                }}
              />
              <button
                className="btn btn-secondary settings-browse"
                type="button"
                onClick={onClearGitCacheNow}
              >
                {t('cleanNow')}
              </button>
            </div>
            <div className="settings-helper">{t('gitCacheCleanupHint')}</div>
          </div>

          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-git-cache-ttl">
              {t('gitCacheTtlSecs')}
            </label>
            <div className="settings-input-row">
              <input
                id="settings-git-cache-ttl"
                className="settings-input"
                type="number"
                min={0}
                max={3600}
                step={1}
                value={gitCacheTtlSecs}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isNaN(next)) {
                    onGitCacheTtlSecsChange(next)
                  }
                }}
              />
            </div>
            <div className="settings-helper">{t('gitCacheTtlHint')}</div>
          </div>

          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-auto-update">
              {t('autoUpdateEnabled')}
            </label>
            <div className="settings-toggle-row">
              <button
                id="settings-auto-update"
                type="button"
                className={`settings-toggle ${autoUpdateEnabled ? 'active' : ''}`}
                aria-pressed={autoUpdateEnabled}
                onClick={() => onAutoUpdateToggle(!autoUpdateEnabled)}
              >
                <span className="settings-toggle-track" />
                <span className="settings-toggle-thumb" />
              </button>
              <span className="settings-toggle-label">
                {autoUpdateEnabled ? t('enabled') : t('disabled')}
              </span>
            </div>
            <div className="settings-helper">{t('autoUpdateHint')}</div>
          </div>

          <TranslationSettings
            translationServiceType={translationServiceType}
            translationApiKey={translationApiKey}
            googleTranslationApiKey={googleTranslationApiKey}
            libreTranslateApiKey={libreTranslateApiKey}
            libreTranslateApiUrl={libreTranslateApiUrl}
            onTranslationServiceTypeChange={onTranslationServiceTypeChange}
            onTranslationApiKeyChange={onTranslationApiKeyChange}
            onGoogleTranslationApiKeyChange={onGoogleTranslationApiKeyChange}
            onLibreTranslateApiKeyChange={onLibreTranslateApiKeyChange}
            onLibreTranslateApiUrlChange={onLibreTranslateApiUrlChange}
          />

          <AiAgentSettings isTauri={isTauri} />

          <div className="settings-version">
            {t('appName')} {versionText}
          </div>

          <div className="settings-project-info" style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#3b82f6' }}>项目说明</div>
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #6b7280)' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>感谢原作者的无私贡献,原始项目地址：</strong>
                <a 
                  href="https://github.com/qufei1993/skills-hub" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', textDecoration: 'none' }}
                >
                  https://github.com/qufei1993/skills-hub
                </a>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>改动说明：</strong>
                <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                  <li>本项目在原始项目基础上进行了大量功能扩展与性能优化。</li>
                  <li>由于代码改动范围较大、冲突较多，目前尚未逐项提交审核。</li>
                  <li>主要新增功能包括：
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyleType: 'circle' }}>
                      <li>支持自定义扫描路径；</li>
                      <li>支持 Skill 自定义目录、配置目录及展示说明；</li>
                      <li>点击 Skill 可查看详情，包括文件树预览、原始内容、翻译及 AI 优化建议；</li>
                      <li>提供 Skill 使用仪表盘，并支持通过 SDK 或 MCP 协议上报使用数据；</li>
                      <li>实现 Skill 的自动发现与一键安装；</li>
                      <li>内置常用 Skill，并集成增强版 Skill Creator 工具。</li>
                    </ul>
                  </li>
                  <li>当前 AI 优化模块较为简略，因其核心能力正在另一个独立项目中深度打磨,本 Skill Hub 管理系统实为该主项目的子模块。</li>
                  <li>项目目标是构建完整的数据闭环与自进化能力，相关功能完善后将择机开源。</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn btn-primary btn-full" onClick={onRequestClose}>
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(SettingsModal)

