import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TFunction } from 'i18next'
import type { TranslationServiceType } from '../../../services/translationService'
import type { CategoryInfoDto } from '../../../shared/types'

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
  onPickStoragePath,
  onToggleLanguage,
  onThemeChange,
  onGitCacheCleanupDaysChange,
  onGitCacheTtlSecsChange,
  onAutoUpdateToggle,
  onClearGitCacheNow,
  onTranslationApiKeyChange,
  translationServiceType,
  onTranslationServiceTypeChange,
  googleTranslationApiKey,
  onGoogleTranslationApiKeyChange,
  onRequestClose,
  t,
}: SettingsModalProps) => {
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [scanPaths, setScanPaths] = useState<string[]>([])
  const [isScanPathsExpanded, setIsScanPathsExpanded] = useState<boolean>(false)
  const [newScanPath, setNewScanPath] = useState<string>('')
  const [categories, setCategories] = useState<CategoryInfoDto[]>([])
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(false)
  const [newCategoryName, setNewCategoryName] = useState<string>('')
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('')
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

  const loadScanPaths = useCallback(async () => {
    if (!isTauri) return
    try {
      const paths = await invoke<string[]>('list_scan_paths')
      setScanPaths(paths)
    } catch {
      setScanPaths([])
    }
  }, [isTauri])

  const loadCategories = useCallback(async () => {
    if (!isTauri) return
    try {
      const cats = await invoke<CategoryInfoDto[]>('list_categories_db')
      setCategories(cats)
    } catch {
      setCategories([])
    }
  }, [isTauri])

  const handleAddScanPath = useCallback(async () => {
    if (!isTauri) return
    const path = newScanPath.trim()
    if (!path) return
    try {
      await invoke('add_scan_path', { path })
      await loadScanPaths()
      setNewScanPath('')
    } catch (err) {
      console.error('Failed to add scan path:', err)
    }
  }, [isTauri, newScanPath, loadScanPaths])

  const handleRemoveScanPath = useCallback(
    async (path: string) => {
      if (!isTauri) return
      try {
        await invoke('remove_scan_path', { path })
        await loadScanPaths()
      } catch (err) {
        console.error('Failed to remove scan path:', err)
      }
    },
    [isTauri, loadScanPaths],
  )

  const handleAddCategory = useCallback(async () => {
    if (!isTauri) return
    const name = newCategoryName.trim()
    const description = newCategoryDescription.trim()
    
    if (!name || !description) return
    
    // 自动生成 ID（使用名称的小写加时间戳）
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    // 使用默认图标和颜色
    const icon = '📁'
    const color = '#3b82f6'
    
    try {
      await invoke('add_category', { id, name, description, icon, color })
      await loadCategories()
      setNewCategoryName('')
      setNewCategoryDescription('')
    } catch (err) {
      console.error('Failed to add category:', err)
    }
  }, [isTauri, newCategoryName, newCategoryDescription, loadCategories])

  const handleRemoveCategory = useCallback(
    async (categoryId: string) => {
      if (!isTauri) return
      try {
        await invoke('remove_category', { id: categoryId })
        await loadCategories()
      } catch (err) {
        console.error('Failed to remove category:', err)
      }
    },
    [isTauri, loadCategories],
  )

  useEffect(() => {
    if (!open) {
      setAppVersion(null)
      setScanPaths([])
      setCategories([])
      return
    }
    void loadAppVersion()
    void loadScanPaths()
    void loadCategories()
  }, [loadAppVersion, loadScanPaths, loadCategories, open])

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

          <div className="settings-field">
            <button
              className="settings-collapsible-header"
              type="button"
              onClick={() => setIsScanPathsExpanded(!isScanPathsExpanded)}
              aria-expanded={isScanPathsExpanded}
            >
              <span className="settings-collapsible-title">
                {t('skillsScanPaths')}
              </span>
              <svg
                className={`settings-collapsible-icon ${
                  isScanPathsExpanded ? 'expanded' : ''
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
            {isScanPathsExpanded && (
              <div className="settings-collapsible-content">
                <div className="settings-helper">{t('skillsScanPathsHint')}</div>
                
                {scanPaths.length > 0 && (
                  <div className="settings-scan-paths-section">
                    <div className="settings-scan-paths-list">
                      {scanPaths.map((path) => (
                        <div key={path} className="settings-scan-path-item">
                          <input
                            className="settings-input mono"
                            value={path}
                            readOnly
                          />
                          <button
                            className="btn btn-secondary settings-remove-path"
                            type="button"
                            onClick={() => handleRemoveScanPath(path)}
                            aria-label={t('removeScanPath')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="settings-scan-paths-section">
                  <div className="settings-scan-paths-label">{t('addNewScanPath')}</div>
                  <div className="settings-input-row">
                    <input
                      className="settings-input mono"
                      type="text"
                      value={newScanPath}
                      onChange={(e) => setNewScanPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddScanPath()
                        }
                      }}
                      placeholder={t('enterScanPath')}
                    />
                    <button
                      className="btn btn-secondary settings-browse"
                      type="button"
                      onClick={handleAddScanPath}
                      disabled={!newScanPath.trim()}
                    >
                      {t('add')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="settings-field">
            <button
              className="settings-collapsible-header"
              type="button"
              onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              aria-expanded={isCategoriesExpanded}
            >
              <span className="settings-collapsible-title">
                {t('skillCategories')}
              </span>
              <svg
                className={`settings-collapsible-icon ${
                  isCategoriesExpanded ? 'expanded' : ''
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
            {isCategoriesExpanded && (
              <div className="settings-collapsible-content">
                <div className="settings-helper">{t('skillCategoriesHint')}</div>
                
                {categories.length > 0 && (
                  <div className="settings-scan-paths-section">
                    <div className="settings-scan-paths-list">
                      {categories.map((category) => (
                        <div key={category.id} className="settings-scan-path-item">
                          <div className="settings-category-display">
                            <span className="settings-category-icon">{category.icon}</span>
                            <div className="settings-category-text">
                              <div className="settings-category-name">{category.name}</div>
                              <div className="settings-category-desc">{category.description}</div>
                            </div>
                          </div>
                          <button
                            className="btn btn-secondary settings-remove-path"
                            type="button"
                            onClick={() => handleRemoveCategory(category.id)}
                            aria-label={t('removeCategory')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="settings-scan-paths-section">
                  <div className="settings-scan-paths-label">{t('addNewCategory')}</div>
                  <div className="settings-input-row">
                    <input
                      className="settings-input"
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCategoryName.trim() && newCategoryDescription.trim()) {
                          handleAddCategory()
                        }
                      }}
                      placeholder={t('categoryName')}
                    />
                  </div>
                  <div className="settings-input-row">
                    <input
                      className="settings-input"
                      type="text"
                      value={newCategoryDescription}
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCategoryName.trim() && newCategoryDescription.trim()) {
                          handleAddCategory()
                        }
                      }}
                      placeholder={t('categoryDescription')}
                    />
                    <button
                      className="btn btn-secondary settings-browse"
                      type="button"
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim() || !newCategoryDescription.trim()}
                    >
                      {t('add')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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

          <div className="settings-field">
            <label className="settings-label" id="settings-translation-service-label">
              {t('translationService')}
            </label>
            <div className="settings-theme-options" role="group" aria-labelledby="settings-translation-service-label">
              <button
                type="button"
                className={`settings-theme-btn ${
                  translationServiceType === 'mymemory' ? 'active' : ''
                }`}
                aria-pressed={translationServiceType === 'mymemory'}
                onClick={() => onTranslationServiceTypeChange('mymemory')}
              >
                {t('translationServiceOptions.mymemory')}
              </button>
              <button
                type="button"
                className={`settings-theme-btn ${
                  translationServiceType === 'google' ? 'active' : ''
                }`}
                aria-pressed={translationServiceType === 'google'}
                onClick={() => onTranslationServiceTypeChange('google')}
              >
                {t('translationServiceOptions.google')}
              </button>
            </div>
            <div className="settings-helper">{t('translationServiceHint')}</div>
          </div>

          {translationServiceType === 'mymemory' && (
            <div className="settings-field">
              <label className="settings-label" htmlFor="settings-translation-api-key">
                {t('myMemoryApiKey')}
              </label>
              <input
                id="settings-translation-api-key"
                className="settings-input mono"
                type="password"
                value={translationApiKey}
                onChange={(e) => onTranslationApiKeyChange(e.target.value)}
                placeholder={t('translationApiKeyPlaceholder')}
              />
              <div className="settings-helper">{t('translationApiKeyHint')}</div>
            </div>
          )}

          {translationServiceType === 'google' && (
            <div className="settings-field">
              <label className="settings-label" htmlFor="settings-google-translation-api-key">
                {t('googleTranslationApiKey')}
              </label>
              <input
                id="settings-google-translation-api-key"
                className="settings-input mono"
                type="password"
                value={googleTranslationApiKey}
                onChange={(e) => onGoogleTranslationApiKeyChange(e.target.value)}
                placeholder={t('googleTranslationApiKeyPlaceholder')}
              />
              <div className="settings-helper">{t('googleTranslationApiKeyHint')}</div>
            </div>
          )}

          <div className="settings-version">
            {t('appName')} {versionText}
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
