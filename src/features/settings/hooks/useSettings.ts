import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TranslationServiceType } from '../../../services/translationService'
import { translationService } from '../../../services/translationService'
import type { TFunction } from 'i18next'

export interface UseSettingsReturn {
  storagePath: string
  gitCacheCleanupDays: number
  gitCacheTtlSecs: number
  autoUpdateEnabled: boolean
  translationApiKey: string
  translationServiceType: TranslationServiceType
  googleTranslationApiKey: string
  handlePickStoragePath: () => Promise<void>
  handleGitCacheCleanupDaysChange: (nextDays: number) => Promise<void>
  handleGitCacheTtlSecsChange: (nextSecs: number) => Promise<void>
  handleAutoUpdateToggle: (enabled: boolean) => void
  handleTranslationApiKeyChange: (key: string) => void
  handleTranslationServiceTypeChange: (type: TranslationServiceType) => void
  handleGoogleTranslationApiKeyChange: (key: string) => void
  handleClearGitCacheNow: () => Promise<void>
}

export function useSettings(
  isTauri: boolean,
  t: TFunction,
  loadManagedSkills: () => Promise<void>,
  setError: (error: string | null) => void
): UseSettingsReturn {
  const [storagePath, setStoragePath] = useState<string>(t('notAvailable'))
  const [gitCacheCleanupDays, setGitCacheCleanupDays] = useState<number>(30)
  const [gitCacheTtlSecs, setGitCacheTtlSecs] = useState<number>(60)
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true)
  const [translationApiKey, setTranslationApiKey] = useState<string>('')
  const [translationServiceType, setTranslationServiceType] = useState<TranslationServiceType>('mymemory')
  const [googleTranslationApiKey, setGoogleTranslationApiKey] = useState<string>('')

  const handlePickStoragePath = useCallback(async () => {
    try {
      if (!isTauri) {
        throw new Error(t('errors.notTauri'))
      }
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('selectStoragePath'),
      })
      if (selected && typeof selected === 'string') {
        await invoke('set_storage_path', { path: selected })
        setStoragePath(selected)
        await loadManagedSkills()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isTauri, loadManagedSkills, t, setError])

  const handleGitCacheCleanupDaysChange = useCallback(
    async (nextDays: number) => {
      const normalized = Math.max(0, Math.min(nextDays, 3650))
      setGitCacheCleanupDays(normalized)
      if (!isTauri) return
      try {
        await invoke('set_git_cache_cleanup_days', { days: normalized })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [isTauri, setError],
  )

  const handleGitCacheTtlSecsChange = useCallback(
    async (nextSecs: number) => {
      const normalized = Math.max(0, Math.min(nextSecs, 3600))
      setGitCacheTtlSecs(normalized)
      if (!isTauri) return
      try {
        await invoke('set_git_cache_ttl_secs', { secs: normalized })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [isTauri, setError],
  )

  const handleAutoUpdateToggle = useCallback(
    (enabled: boolean) => {
      setAutoUpdateEnabled(enabled)
    },
    [],
  )

  const handleTranslationApiKeyChange = useCallback(
    (key: string) => {
      setTranslationApiKey(key)
      translationService.setApiKey(key || null)
    },
    [],
  )

  const handleTranslationServiceTypeChange = useCallback(
    (type: TranslationServiceType) => {
      setTranslationServiceType(type)
      translationService.setServiceType(type)
    },
    [],
  )

  const handleGoogleTranslationApiKeyChange = useCallback(
    (key: string) => {
      setGoogleTranslationApiKey(key)
      translationService.setGoogleApiKey(key || null)
    },
    [],
  )

  const handleClearGitCacheNow = useCallback(async () => {
    if (!isTauri) {
      setError(t('errors.notTauri'))
      return
    }
    try {
      await invoke('clear_git_cache_now')
      setError(t('status.gitCacheCleared'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isTauri, t, setError])

  return {
    storagePath,
    gitCacheCleanupDays,
    gitCacheTtlSecs,
    autoUpdateEnabled,
    translationApiKey,
    translationServiceType,
    googleTranslationApiKey,
    handlePickStoragePath,
    handleGitCacheCleanupDaysChange,
    handleGitCacheTtlSecsChange,
    handleAutoUpdateToggle,
    handleTranslationApiKeyChange,
    handleTranslationServiceTypeChange,
    handleGoogleTranslationApiKeyChange,
    handleClearGitCacheNow,
  }
}
