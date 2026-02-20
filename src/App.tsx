import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import './App.css'

// Shared context providers
import { AppProvider } from './shared/context/AppContext'
import { useAppContext } from './shared/context/useAppContext'
import { ThemeProvider } from './shared/context/ThemeContext'
import { useTheme } from './shared/context/useTheme'

// Shared hooks
import { useLoading, useToast, useError } from './shared/hooks'

// Common UI components
import Header from './components/common/Header'
import LoadingOverlay from './components/common/LoadingOverlay'
import MainLayout from './components/layout/MainLayout'

// Feature modules
import SkillsDashboard from './features/skills/components/SkillsDashboard'
import AddSkillModal from './features/skills/components/AddSkillModal'
import DeleteModal from './features/skills/components/DeleteModal'
import NewToolsModal from './features/tools/components/NewToolsModal'
import SharedDirModal from './features/tools/components/SharedDirModal'
import SettingsModal from './features/settings/components/SettingsModal'
import DiscoveryModal from './features/discovery/components/DiscoveryModal'
import AnalyticsDashboard from './features/analytics/components/AnalyticsDashboard'

// Translation service
import type { TranslationServiceType } from './services/translationService'
import { useSkillManagement } from './features/skills/hooks/useSkillManagement'
import { useToolManagement } from './features/tools/hooks/useToolManagement'
import { tools } from './shared/data/tools'

function AppContent() {
  const { t, i18n } = useTranslation()
  const { isTauri, invokeTauri, formatErrorMessage } = useAppContext()
  const { resolvedTheme } = useTheme()
  const { loading, actionMessage, startLoading, stopLoading, updateActionMessage } = useLoading()
  const { showSuccess, showError } = useToast()
  const { error, setError, clearError } = useError()

  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [showNewToolsModal, setShowNewToolsModal] = useState(false)
  const [showSharedDirModal, setShowSharedDirModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Settings state
  const [storagePath, setStoragePath] = useState<string>('')
  const [gitCacheCleanupDays, setGitCacheCleanupDays] = useState(7)
  const [gitCacheTtlSecs, setGitCacheTtlSecs] = useState(86400)
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false)
  const [translationApiKey, setTranslationApiKey] = useState('')
  const [translationServiceType, setTranslationServiceType] = useState<TranslationServiceType>('none')
  const [googleTranslationApiKey, setGoogleTranslationApiKey] = useState('')
  const [libreTranslateApiKey, setLibreTranslateApiKey] = useState('')
  const [libreTranslateApiUrl, setLibreTranslateApiUrl] = useState('https://libretranslate.com/translate')

  // Use skill management hook
  const skillManagement = useSkillManagement({
    invokeTauri: invokeTauri as <T = unknown>(command: string, args?: unknown) => Promise<T>,
    tools,
    sharedToolIdsByToolId: {},
  })
  
  // Use tool management hook
  const toolManagement = useToolManagement({
    managedSkills: skillManagement.managedSkills,
    tools,
    toolStatus: skillManagement.toolStatus,
    isInstalled: skillManagement.isInstalled,
    uniqueToolIdsBySkillsDir: skillManagement.uniqueToolIdsBySkillsDir,
    sharedToolIdsByToolId: {},
    setShowNewToolsModal,
    invokeTauri: invokeTauri as <T = unknown>(command: string, args?: unknown) => Promise<T>,
    loadManagedSkills: skillManagement.loadManagedSkills,
    showActionErrors: (errors: { title: string; message: string }[]) => {
      if (errors.length === 0) return
      const head = errors[0]
      const more = errors.length > 1 ? t('errors.moreCount', { count: errors.length - 1 }) : ''
      showError(`${head.title}\n${head.message}${more}`)
    },
    t,
    loading,
    pendingSharedToggle: skillManagement.pendingSharedToggle,
    setPendingSharedToggle: skillManagement.setPendingSharedToggle,
    setLoading: skillManagement.setLoading,
    setLoadingStartAt: () => { /* handled internally by skillManagement */ },
    setActionMessage: skillManagement.setActionMessage,
    setSuccessToastMessage: skillManagement.setSuccessToastMessage,
    setError: skillManagement.setError,
  })

  // Language toggle
  const toggleLanguage = useCallback(() => {
    void i18n.changeLanguage(language === 'en' ? 'zh' : 'en')
  }, [i18n, language])

  // Translation service handlers
  const handleTranslationServiceTypeChange = useCallback((type: TranslationServiceType) => {
    setTranslationServiceType(type)
  }, [])

  const handleTranslationApiKeyChange = useCallback((apiKey: string) => {
    setTranslationApiKey(apiKey)
  }, [])

  const handleGoogleTranslationApiKeyChange = useCallback((apiKey: string) => {
    setGoogleTranslationApiKey(apiKey)
  }, [])

  const handleLibreTranslateApiKeyChange = useCallback((apiKey: string) => {
    setLibreTranslateApiKey(apiKey)
  }, [])

  const handleLibreTranslateApiUrlChange = useCallback((url: string) => {
    setLibreTranslateApiUrl(url)
  }, [])

  // Storage path handler
  const handlePickStoragePath = useCallback(async () => {
    if (!isTauri) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({ directory: true })
      if (selected && typeof selected === 'string') {
        await invokeTauri('set_central_repo_path', { path: selected })
        setStoragePath(selected)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isTauri, invokeTauri, setError])

  // Git cache handlers
  const handleGitCacheCleanupDaysChange = useCallback((days: number) => {
    setGitCacheCleanupDays(days)
  }, [])

  const handleGitCacheTtlSecsChange = useCallback((secs: number) => {
    setGitCacheTtlSecs(secs)
  }, [])

  const handleAutoUpdateToggle = useCallback((enabled: boolean) => {
    setAutoUpdateEnabled(enabled)
  }, [])

  const handleClearGitCacheNow = useCallback(async () => {
    if (!isTauri) return
    try {
      startLoading(t('actions.clearingCache'))
      await invokeTauri('clear_git_cache')
      showSuccess(t('status.cacheCleared'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      stopLoading()
    }
  }, [isTauri, invokeTauri, startLoading, stopLoading, showSuccess, setError, t])

  // Modal handlers
  const handleOpenSettings = useCallback(() => setShowSettingsModal(true), [])
  const handleCloseSettings = useCallback(() => setShowSettingsModal(false), [])
  
  const handleOpenAdd = useCallback(() => setShowAddModal(true), [])
  const handleCloseAdd = useCallback(() => setShowAddModal(false), [])
  
  const handleOpenDiscovery = useCallback(() => {
    setShowDiscoveryModal(true)
    void skillManagement.loadDiscoveredSkills()
  }, [skillManagement])
  
  const handleCloseDiscovery = useCallback(() => setShowDiscoveryModal(false), [])
  
  const handleOpenAnalytics = useCallback(() => setShowAnalyticsModal(true), [])
  const handleCloseAnalytics = useCallback(() => setShowAnalyticsModal(false), [])
  
  const handleCloseNewTools = useCallback(() => setShowNewToolsModal(false), [])
  const handleCloseSharedDir = useCallback(() => setShowSharedDirModal(false), [])
  const handleCloseDelete = useCallback(() => setShowDeleteModal(false), [])

  // Load settings on mount
  useEffect(() => {
    if (!isTauri) return
    
    const loadSettings = async () => {
      try {
        const [path, cleanupDays, ttlSecs, autoUpdate] = await Promise.all([
          invokeTauri<string>('get_central_repo_path') as Promise<string>,
          invokeTauri<number>('get_git_cache_cleanup_days') as Promise<number>,
          invokeTauri<number>('get_git_cache_ttl_secs') as Promise<number>,
          invokeTauri<boolean>('get_auto_update_enabled') as Promise<boolean>,
        ])
        setStoragePath(path)
        setGitCacheCleanupDays(cleanupDays)
        setGitCacheTtlSecs(ttlSecs)
        setAutoUpdateEnabled(autoUpdate)
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    
    loadSettings()
  }, [isTauri, invokeTauri])

  // Load managed skills on mount
  useEffect(() => {
    if (isTauri) {
      void skillManagement.loadManagedSkills()
      void skillManagement.loadCategories()
      void skillManagement.loadToolStatus()
      // Sync awesome-claude-skills data on app start
      invokeTauri('sync_awesome_claude_skills')
        .then(() => console.log('Awesome Claude Skills synced successfully'))
        .catch(err => console.error('Failed to sync awesome claude skills:', err))
    }
  }, [isTauri])

  // Error handling
  useEffect(() => {
    if (error) {
      showError(formatErrorMessage(error))
      clearError()
      updateActionMessage('')
    }
  }, [error, formatErrorMessage, showError, clearError, updateActionMessage])

  // Render
  return (
    <div className={`app-container ${resolvedTheme}`}>
      <MainLayout
        header={
          <Header
            language={language}
            loading={loading}
            onToggleLanguage={toggleLanguage}
            onOpenSettings={handleOpenSettings}
            onOpenAdd={handleOpenAdd}
            onOpenDiscovery={handleOpenDiscovery}
            onOpenAnalytics={handleOpenAnalytics}
            t={t}
          />
        }
      >
        <SkillsDashboard
          loading={loading}
          searchQuery={skillManagement.searchQuery}
          sortBy={skillManagement.sortBy}
          categoryFilter={skillManagement.categoryFilter}
          categories={skillManagement.categories}
          visibleSkills={skillManagement.visibleSkills}
          installedTools={tools}
          plan={skillManagement.plan}
          getGithubInfo={skillManagement.getGithubInfo}
          getSkillSourceLabel={skillManagement.getSkillSourceLabel}
          formatRelative={skillManagement.formatRelative}
          onSortChange={skillManagement.setSortBy}
          onSearchChange={skillManagement.setSearchQuery}
          onCategoryFilterChange={skillManagement.setCategoryFilter}
          onRefresh={skillManagement.loadManagedSkills}
          onUpdateAll={() => toolManagement.handleSyncAllManagedToTools(skillManagement.installedTools.map(t => t.id))}
          onReviewImport={() => {}}
          onUpdateSkill={skillManagement.handleUpdateManaged}
          onDeleteSkill={skillManagement.setPendingDeleteId}
          onToggleTool={skillManagement.handleToggleToolForSkill}
          onSkillCategoryChange={skillManagement.handleUpdateSkillCategory}
          t={t}
        />
      </MainLayout>

      {/* Modals */}
      {showAddModal && (
        <AddSkillModal
          open={showAddModal}
          loading={loading}
          canClose={!loading}
          addModalTab={skillManagement.addModalTab}
          localPath={skillManagement.localPath}
          localName={skillManagement.localName}
          gitUrl={skillManagement.gitUrl}
          gitName={skillManagement.gitName}
          syncTargets={skillManagement.syncTargets}
          installedTools={tools}
          toolStatus={skillManagement.toolStatus}
          isTauri={isTauri}
          invokeTauri={invokeTauri as <T = unknown>(command: string, args?: unknown) => Promise<T>}
          onRequestClose={handleCloseAdd}
          onTabChange={skillManagement.setAddModalTab}
          onLocalPathChange={skillManagement.setLocalPath}
          onPickLocalPath={async () => {
            if (!isTauri) return
            try {
              const { open } = await import('@tauri-apps/plugin-dialog')
              const selected = await open({ directory: true })
              if (selected && typeof selected === 'string') {
                skillManagement.setLocalPath(selected)
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
          onLocalNameChange={skillManagement.setLocalName}
          onGitUrlChange={skillManagement.setGitUrl}
          onGitNameChange={skillManagement.setGitName}
          onSyncTargetChange={(toolId: string, checked: boolean) => {
            if (skillManagement.setSyncTargets) {
              const currentSyncTargets = skillManagement.syncTargets ?? {}
              skillManagement.setSyncTargets({ ...currentSyncTargets, [toolId]: checked })
            }
          }}
          onSubmit={async () => {
            if (skillManagement.addModalTab === 'local') {
              if (!skillManagement.localPath || !skillManagement.localName) {
                setError(t('errors.requiredFields'))
                return
              }
              try {
                await invokeTauri('add_local_skill', {
                  path: skillManagement.localPath,
                  name: skillManagement.localName,
                })
                showSuccess(t('status.skillAdded'))
                handleCloseAdd()
                await skillManagement.loadManagedSkills()
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            } else if (skillManagement.addModalTab === 'git') {
              if (!skillManagement.gitUrl || !skillManagement.gitName) {
                setError(t('errors.requiredFields'))
                return
              }
              try {
                await invokeTauri('add_git_skill', {
                  url: skillManagement.gitUrl,
                  name: skillManagement.gitName,
                })
                showSuccess(t('status.skillAdded'))
                handleCloseAdd()
                await skillManagement.loadManagedSkills()
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            } else if (skillManagement.addModalTab === 'quick') {
              // Quick install is handled by onInstallQuickSkill callback
              handleCloseAdd()
            }
          }}
          onInstallQuickSkill={async () => {
            try {
              await invokeTauri('install_local', {
                sourcePath: '/Users/junmengye/skills-hub/docs/skill-creator-enhanced',
                name: 'skill-creator-enhanced',
              })
              showSuccess(t('status.skillAdded'))
              handleCloseAdd()
              await skillManagement.loadManagedSkills()
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
          onViewQuickSkill={() => {
            const skill = skillManagement.managedSkills.find(s => s.name === 'skill-creator-enhanced')
            if (skill) {
              window.location.href = `/skill/${skill.id}`
            } else {
              window.open('https://github.com/claude-ai/skill-creator-enhanced', '_blank')
            }
          }}
          t={t}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          open={showSettingsModal}
          isTauri={isTauri}
          language={language}
          storagePath={storagePath}
          gitCacheCleanupDays={gitCacheCleanupDays}
          gitCacheTtlSecs={gitCacheTtlSecs}
          autoUpdateEnabled={autoUpdateEnabled}
          themePreference={resolvedTheme === 'dark' ? 'dark' : resolvedTheme === 'light' ? 'light' : 'system'}
          translationApiKey={translationApiKey}
          translationServiceType={translationServiceType}
          googleTranslationApiKey={googleTranslationApiKey}
          libreTranslateApiKey={libreTranslateApiKey}
          libreTranslateApiUrl={libreTranslateApiUrl}
          onPickStoragePath={handlePickStoragePath}
          onToggleLanguage={toggleLanguage}
          onThemeChange={(theme: 'light' | 'dark' | 'system') => {
            const themePreference = theme === 'system' ? 'system' : theme === 'light' ? 'light' : 'dark'
            if (isTauri) {
              invokeTauri('set_theme_preference', { theme: themePreference }).catch((err) => {
                console.error('Failed to set theme preference:', err)
              })
            }
          }}
          onGitCacheCleanupDaysChange={handleGitCacheCleanupDaysChange}
          onGitCacheTtlSecsChange={handleGitCacheTtlSecsChange}
          onAutoUpdateToggle={handleAutoUpdateToggle}
          onTranslationServiceTypeChange={handleTranslationServiceTypeChange}
          onTranslationApiKeyChange={handleTranslationApiKeyChange}
          onGoogleTranslationApiKeyChange={handleGoogleTranslationApiKeyChange}
          onLibreTranslateApiKeyChange={handleLibreTranslateApiKeyChange}
          onLibreTranslateApiUrlChange={handleLibreTranslateApiUrlChange}
          onClearGitCacheNow={handleClearGitCacheNow}
          onRequestClose={handleCloseSettings}
          t={t}
        />
      )}

      {showDiscoveryModal && (
        <DiscoveryModal
          open={showDiscoveryModal}
          loading={skillManagement.discoveryLoading}
          discoveredSkills={skillManagement.discoveredSkills}
          categories={skillManagement.discoveryCategories}
          installedSkills={skillManagement.managedSkills}
          onRequestClose={handleCloseDiscovery}
          onRefresh={() => void skillManagement.loadDiscoveredSkills()}
          t={t}
        />
      )}

      {showAnalyticsModal && (
        <div className="modal-backdrop" onClick={handleCloseAnalytics}>
          <div
            className="modal analytics-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '1400px',
              width: '95vw',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="modal-header">
              <div className="modal-title">Analytics Dashboard</div>
              <button
                className="modal-close"
                onClick={handleCloseAnalytics}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              <AnalyticsDashboard />
            </div>
          </div>
        </div>
      )}

      {showNewToolsModal && (
        <NewToolsModal
          open={showNewToolsModal}
          loading={loading}
          toolsLabelText={skillManagement.newlyInstalledToolsText || ''}
          onLater={handleCloseNewTools}
          onSyncAll={toolManagement.handleSyncAllNewTools}
          t={t}
        />
      )}

      {showSharedDirModal && (
        <SharedDirModal
          open={showSharedDirModal}
          loading={loading}
          toolLabel={skillManagement.pendingSharedLabels?.toolLabel || ''}
          otherLabels={skillManagement.pendingSharedLabels?.otherLabels || ''}
          onRequestClose={handleCloseSharedDir}
          onConfirm={skillManagement.handleSharedConfirm}
          t={t}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          open={showDeleteModal}
          loading={loading}
          skillName={skillManagement.pendingDeleteSkill?.name || null}
          onRequestClose={handleCloseDelete}
          onConfirm={() => {
            if (skillManagement.pendingDeleteId) {
              void skillManagement.handleDeleteManaged(skillManagement.pendingDeleteSkill!)
            }
          }}
          t={t}
        />
      )}

      {/* Loading overlay */}
      {loading && <LoadingOverlay loading={loading} actionMessage={actionMessage} loadingStartAt={skillManagement.loadingStartAt} t={t} />}

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  )
}

export default App