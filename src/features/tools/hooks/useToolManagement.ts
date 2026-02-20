import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { ManagedSkill, ToolOption, ToolStatusDto } from '../../../shared/types'

export type PendingSharedToggle = {
  skill: ManagedSkill
  toolId: string
}

export interface UseToolManagementProps {
  managedSkills: ManagedSkill[]
  tools: ToolOption[]
  toolStatus: ToolStatusDto | null
  isInstalled: (toolId: string) => boolean
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  sharedToolIdsByToolId: Record<string, string[]>
  setShowNewToolsModal: Dispatch<SetStateAction<boolean>>
  invokeTauri: <T = unknown>(command: string, args?: unknown) => Promise<T>
  loadManagedSkills: () => Promise<void>
  showActionErrors: (errors: { title: string; message: string }[]) => void
  t: TFunction
  loading: boolean
  pendingSharedToggle: PendingSharedToggle | null
  setPendingSharedToggle: (value: PendingSharedToggle | null) => void
  setLoading: (value: boolean) => void
  setLoadingStartAt: (value: number | null) => void
  setActionMessage: (value: string | null) => void
  setSuccessToastMessage: (value: string | null) => void
  setError: (value: string | null) => void
}

export interface UseToolManagementReturn {
  handleSyncAllManagedToTools: (toolIds: string[]) => Promise<void>
  handleSyncAllNewTools: () => void
  runToggleToolForSkill: (skill: ManagedSkill, toolId: string) => Promise<void>
  handleToggleToolForSkill: (skill: ManagedSkill, toolId: string) => void
  handleSharedCancel: () => void
  handleSharedConfirm: () => void
  pendingSharedLabels: {
    toolLabel: string
    otherLabels: string
  } | null
  toolLabelById: Record<string, string>
}

export const useToolManagement = (config: {
  managedSkills: ManagedSkill[]
  tools: ToolOption[]
  toolStatus: ToolStatusDto | null
  isInstalled: (toolId: string) => boolean
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  sharedToolIdsByToolId: Record<string, string[]>
  setShowNewToolsModal: Dispatch<SetStateAction<boolean>>
  invokeTauri: (command: string, args?: unknown) => Promise<unknown>
  loadManagedSkills: () => Promise<void>
  showActionErrors: (errors: { title: string; message: string }[]) => void
  t: TFunction
  loading: boolean
  pendingSharedToggle: { skill: ManagedSkill; toolId: string } | null
  setPendingSharedToggle: (value: { skill: ManagedSkill; toolId: string } | null) => void
  setLoading: (value: boolean) => void
  setLoadingStartAt: (value: number | null) => void
  setActionMessage: (value: string | null) => void
  setSuccessToastMessage: (value: string | null) => void
  setError: (value: string | null) => void
}): UseToolManagementReturn => {
  const { t, managedSkills, tools, toolStatus, isInstalled, uniqueToolIdsBySkillsDir, sharedToolIdsByToolId, setShowNewToolsModal, invokeTauri, loadManagedSkills, showActionErrors, loading, pendingSharedToggle, setPendingSharedToggle, setLoading, setLoadingStartAt, setActionMessage, setSuccessToastMessage, setError } = config

  const toolLabelById = useMemo(() => {
    const result: Record<string, string> = {}
    for (const tool of tools) {
      result[tool.id] = tool.label
    }
    return result
  }, [tools])

  const handleSyncAllManagedToTools = useCallback(
    async (toolIds: string[]) => {
      if (managedSkills.length === 0) return
      const installedIds = uniqueToolIdsBySkillsDir(
        toolIds.filter((id) => isInstalled(id)),
      )
      if (installedIds.length === 0) return

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let si = 0; si < managedSkills.length; si++) {
          const skill = managedSkills[si]
          for (let ti = 0; ti < installedIds.length; ti++) {
            const toolId = installedIds[ti]
            const toolLabel = toolLabelById[toolId] ?? toolId
            setActionMessage(
              t('actions.syncStep', {
                index: si + 1,
                total: managedSkills.length,
                name: skill.name,
                tool: toolLabel,
              }),
            )
            try {
              await invokeTauri('sync_skill_to_tool', {
                sourcePath: skill.central_path,
                skillId: skill.id,
                tool: toolId,
                name: skill.name,
              })
            } catch (err) {
              const raw = err instanceof Error ? err.message : String(err)
              if (raw.startsWith('TOOL_NOT_INSTALLED|')) continue
              collectedErrors.push({
                title: t('errors.syncFailedTitle', {
                  name: skill.name,
                  tool: toolLabel,
                }),
                message: raw,
              })
            }
          }
        }
        setActionMessage(t('status.syncCompleted'))
        setSuccessToastMessage(t('status.syncCompleted'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) showActionErrors(collectedErrors)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      isInstalled,
      loadManagedSkills,
      managedSkills,
      showActionErrors,
      t,
      toolLabelById,
      uniqueToolIdsBySkillsDir,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
    ],
  )

  const handleSyncAllNewTools = useCallback(
    async () => {
      if (!toolStatus || toolStatus.newly_installed.length === 0) return
      
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      
      try {
        const labels = toolStatus.newly_installed
          .map((id) => toolLabelById[id] ?? id)
          .join(', ')
        setActionMessage(t('actions.syncingToNew', { tools: labels }))
        
        await handleSyncAllManagedToTools(toolStatus.newly_installed)
        
        setSuccessToastMessage(t('status.syncCompleted'))
        setActionMessage(null)
        setShowNewToolsModal(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [handleSyncAllManagedToTools, toolStatus, toolLabelById, t, setLoading, setLoadingStartAt, setError, setSuccessToastMessage, setActionMessage, setShowNewToolsModal],
  )

  const runToggleToolForSkill = useCallback(
    async (skill: ManagedSkill, toolId: string) => {
      if (loading) return
      const toolLabel = toolLabelById[toolId] ?? toolId
      const target = skill.targets.find((t) => t.tool === toolId)
      const synced = Boolean(target)

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        if (synced) {
          setActionMessage(
            t('actions.unsyncing', { name: skill.name, tool: toolLabel }),
          )
          await invokeTauri('unsync_skill_from_tool', {
            skillId: skill.id,
            tool: toolId,
          })
        } else {
          setActionMessage(
            t('actions.syncing', { name: skill.name, tool: toolLabel }),
          )
          await invokeTauri('sync_skill_to_tool', {
            sourcePath: skill.central_path,
            skillId: skill.id,
            tool: toolId,
            name: skill.name,
          })
        }
        const statusText = synced
          ? t('status.syncDisabled')
          : t('status.syncEnabled')
        setActionMessage(statusText)
        setSuccessToastMessage(statusText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        if (raw.startsWith('TARGET_EXISTS|')) {
          const targetPath = raw.split('|')[1] ?? ''
          setError(t('errors.targetExistsDetail', { path: targetPath }))
        } else if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
          setError(t('errors.toolNotInstalled'))
        } else {
          setError(raw)
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      loadManagedSkills,
      loading,
      t,
      toolLabelById,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
    ],
  )

  const handleToggleToolForSkill = useCallback(
    (skill: ManagedSkill, toolId: string) => {
      if (loading) return
      const shared = sharedToolIdsByToolId[toolId] ?? null
      if (shared && shared.length > 1) {
        setPendingSharedToggle({ skill, toolId })
        return
      }
      void runToggleToolForSkill(skill, toolId)
    },
    [loading, runToggleToolForSkill, sharedToolIdsByToolId, setPendingSharedToggle],
  )

  const handleSharedCancel = useCallback(() => {
    if (loading) return
    setPendingSharedToggle(null)
  }, [loading, setPendingSharedToggle])

  const handleSharedConfirm = useCallback(() => {
    if (!pendingSharedToggle) return
    const payload = pendingSharedToggle
    setPendingSharedToggle(null)
    void runToggleToolForSkill(payload.skill, payload.toolId)
  }, [pendingSharedToggle, runToggleToolForSkill, setPendingSharedToggle])

  const pendingSharedLabels = useMemo(() => {
    if (!pendingSharedToggle || !managedSkills || !sharedToolIdsByToolId || !toolLabelById) return null
    const toolId = pendingSharedToggle.toolId
    const shared = sharedToolIdsByToolId[toolId] ?? []
    const others = shared.filter((id) => id !== toolId)
    return {
      toolLabel: toolLabelById[toolId] ?? toolId,
      otherLabels: others.map((id) => toolLabelById[id] ?? id).join(', '),
    }
  }, [pendingSharedToggle, managedSkills, sharedToolIdsByToolId, toolLabelById])

  return {
    handleSyncAllManagedToTools,
    handleSyncAllNewTools,
    runToggleToolForSkill,
    handleToggleToolForSkill,
    handleSharedCancel,
    handleSharedConfirm,
    pendingSharedLabels,
    toolLabelById,
  }
}