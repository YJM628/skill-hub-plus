import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type {
  CategoryInfoDto,
  DiscoveredSkillDto,
  ManagedSkill,
  OnboardingPlan,
  ToolOption,
  ToolStatusDto,
  UpdateResultDto,
} from '../../../shared/types'

interface UseSkillManagementReturn {
  // State
  plan: OnboardingPlan | null
  loading: boolean
  error: string | null
  actionMessage: string | null
  successToastMessage: string | null
  managedSkills: ManagedSkill[]
  localPath: string
  localName: string
  gitUrl: string
  gitName: string
  pendingDeleteId: string | null
  gitCandidatesRepoUrl: string
  showGitPickModal: boolean
  showLocalPickModal: boolean
  loadingStartAt: number | null
  toolStatus: ToolStatusDto | null
  showNewToolsModal: boolean
  showAddModal: boolean
  showImportModal: boolean
  pendingSharedToggle: { skill: ManagedSkill; toolId: string } | null
  searchQuery: string
  sortBy: 'updated' | 'name'
  categoryFilter: string | null
  addModalTab: 'local' | 'git' | 'quick'
  discoveredSkills: DiscoveredSkillDto[]
  discoveryCategories: CategoryInfoDto[]
  discoveryLoading: boolean
  categories: CategoryInfoDto[]
  selected: Record<string, boolean>
  variantChoice: Record<string, string>
  syncTargets: Record<string, boolean>
  
  // Setters
  setPlan: (plan: OnboardingPlan | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setActionMessage: (message: string | null) => void
  setSuccessToastMessage: (message: string | null) => void
  setLocalPath: (path: string) => void
  setLocalName: (name: string) => void
  setGitUrl: (url: string) => void
  setGitName: (name: string) => void
  setPendingDeleteId: (id: string | null) => void
  setGitCandidatesRepoUrl: (url: string) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sortBy: 'updated' | 'name') => void
  setCategoryFilter: (filter: string | null) => void
  setAddModalTab: (tab: 'local' | 'git' | 'quick') => void
  setShowNewToolsModal: (show: boolean) => void
  setShowAddModal: (show: boolean) => void
  setShowImportModal: (show: boolean) => void
  setShowGitPickModal: (show: boolean) => void
  setShowLocalPickModal: (show: boolean) => void
  setPendingSharedToggle: (toggle: { skill: ManagedSkill; toolId: string } | null) => void
  setSelected: (selected: Record<string, boolean>) => void
  setVariantChoice: (choice: Record<string, string>) => void
  setSyncTargets: (targets: Record<string, boolean>) => void
  
  // Computed
  pendingDeleteSkill: ManagedSkill | undefined
  installedTools: ToolOption[]
  newlyInstalledToolsText: string | undefined
  isInstalled: (toolId: string) => boolean
  toolLabelById: Record<string, string>
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  pendingSharedLabels: { toolLabel: string; otherLabels: string } | null
  
  // Utility functions
  formatRelative: (ms: number | null | undefined) => string
  getSkillSourceLabel: (skill: ManagedSkill) => string
  getGithubInfo: (url: string | null | undefined) => { label: string; href: string } | null
  isSkillNameTaken: (name: string) => boolean
  visibleSkills: ManagedSkill[]
  
  // Handlers
  loadPlan: () => Promise<OnboardingPlan | null>
  loadManagedSkills: () => Promise<void>
  loadCategories: () => Promise<void>
  loadDiscoveredSkills: () => Promise<void>
  handleInstallQuickSkill: (skill: DiscoveredSkillDto) => Promise<void>
  handleDeleteManaged: (skill: ManagedSkill) => Promise<void>
  handleSyncAllManagedToTools: (toolIds: string[]) => Promise<void>
  runToggleToolForSkill: (skill: ManagedSkill, toolId: string) => Promise<void>
  handleToggleToolForSkill: (skill: ManagedSkill, toolId: string) => void
  handleUpdateManaged: (skill: ManagedSkill) => Promise<void>
  handleUpdateSkillCategory: (skillId: string, category: string | null) => Promise<void>
  handleSharedCancel: () => void
  handleSharedConfirm: () => void
}

export const useSkillManagement = (config: {
  invokeTauri: <T = unknown>(command: string, args?: unknown) => Promise<T>
  tools: ToolOption[]
  sharedToolIdsByToolId: Record<string, string[]>
}): UseSkillManagementReturn => {
  const { t } = useTranslation()
  const { invokeTauri, tools, sharedToolIdsByToolId } = config
  
  // State
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({})
  const [syncTargets, setSyncTargets] = useState<Record<string, boolean>>({})
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null)
  const [managedSkills, setManagedSkills] = useState<ManagedSkill[]>([])
  const [localPath, setLocalPath] = useState('')
  const [localName, setLocalName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitName, setGitName] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [gitCandidatesRepoUrl, setGitCandidatesRepoUrl] = useState<string>('')
  const [showGitPickModal, setShowGitPickModal] = useState(false)
  const [showLocalPickModal, setShowLocalPickModal] = useState(false)
  const [loadingStartAt, setLoadingStartAt] = useState<number | null>(null)
  const [toolStatus, setToolStatus] = useState<ToolStatusDto | null>(null)
  const [showNewToolsModal, setShowNewToolsModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [pendingSharedToggle, setPendingSharedToggle] = useState<{
    skill: ManagedSkill
    toolId: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [addModalTab, setAddModalTab] = useState<'local' | 'git' | 'quick'>('quick')
  const [discoveredSkills, setDiscoveredSkills] = useState<DiscoveredSkillDto[]>([])
  const [discoveryCategories, setDiscoveryCategories] = useState<CategoryInfoDto[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryInfoDto[]>([])
  
  // Removed unused state variables
  // const [gitCandidates, setGitCandidates] = useState<GitCandidate[]>([])
  // const [gitCandidateSelected, setGitCandidateSelected] = useState<GitCandidate | null>(null)
  // const [localCandidates, setLocalCandidates] = useState<LocalCandidate[]>([])
  // const [localCandidatesBasePath, setLocalCandidatesBasePath] = useState('')
  // const [localCandidateSelected, setLocalCandidateSelected] = useState<LocalCandidate | null>(null)

  // Computed values
  const toolLabelById = useMemo(
    () => Object.fromEntries(tools.map((tool) => [tool.id, tool.label])),
    [tools],
  )
  
  // Utility functions
  const formatErrorMessage = useCallback(
    (raw: string) => {
      if (raw.includes('skill already exists in central repo')) {
        return t('errors.skillExistsInHub')
      }
      if (raw.startsWith('TARGET_EXISTS|')) {
        return t('errors.targetExists')
      }
      if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
        return t('errors.toolNotInstalled')
      }
      if (raw.includes('未在该仓库中发现可导入的 Skills')) {
        return t('errors.noSkillsFoundInRepo')
      }
      return raw
    },
    [t],
  )

  const showActionErrors = useCallback(
    (errors: { title: string; message: string }[]) => {
      if (errors.length === 0) return
      const head = errors[0]
      const more =
        errors.length > 1
          ? t('errors.moreCount', { count: errors.length - 1 })
          : ''
      toast.error(
        `${formatErrorMessage(`${head.title}\n${head.message}`)}${more}`,
        { duration: 3200 },
      )
    },
    [formatErrorMessage, t],
  )
  
  const isSkillNameTaken = useCallback(
    (name: string) =>
      managedSkills.some((skill) => skill.name.toLowerCase() === name.toLowerCase()),
    [managedSkills],
  )
  
  const formatRelative = useCallback((ms: number | null | undefined) => {
    if (!ms) return t('relative.empty')
    const diff = Date.now() - ms
    if (diff < 0) return t('relative.empty')
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return t('relative.justNow')
    if (minutes < 60) {
      return t('relative.minutesAgo', { minutes })
    }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      return t('relative.hoursAgo', { hours })
    }
    const days = Math.floor(hours / 24)
    return t('relative.daysAgo', { days })
  }, [t])
  
  const getSkillSourceLabel = useCallback((skill: ManagedSkill) => {
    const key = skill.source_type.toLowerCase()
    if (key.includes('git') && skill.source_ref) {
      return skill.source_ref
    }
    return skill.central_path
  }, [])
  
  const getGithubInfo = useCallback((url: string | null | undefined) => {
    if (!url) return null
    const normalized = url.replace(/^git\+/, '')
    try {
      const parsed = new URL(normalized)
      if (!parsed.hostname.includes('github.com')) return null
      const parts = parsed.pathname.split('/').filter(Boolean)
      const owner = parts[0]
      const repo = parts[1]?.replace(/\.git$/, '')
      if (!owner || !repo) return null
      return {
        label: `${owner}/${repo}`,
        href: `https://github.com/${owner}/${repo}`,
      }
    } catch {
      const match = normalized.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
      if (!match) return null
      const owner = match[1]
      const repo = match[2].replace(/\.git$/, '')
      return {
        label: `${owner}/${repo}`,
        href: `https://github.com/${owner}/${repo}`,
      }
    }
  }, [])
  
  // Computed values
  const pendingDeleteSkill = useMemo(
    () => managedSkills.find((skill) => skill.id === pendingDeleteId),
    [managedSkills, pendingDeleteId],
  )
  
  const installedTools = useMemo(
    () => toolStatus?.installed ?? [],
    [toolStatus],
  )
  
  const newlyInstalledToolsText = useMemo(() => {
    if (!toolStatus || toolStatus.newly_installed.length === 0) {
      return undefined
    }
    const labels = toolStatus.newly_installed
      .map((id) => toolLabelById[id] ?? id)
      .join(', ')
    return labels
  }, [toolStatus, toolLabelById])
  
  const isInstalled = useCallback(
    (toolId: string) => installedTools.some((tool) => tool.id === toolId),
    [installedTools],
  )
  
  const uniqueToolIdsBySkillsDir = useCallback((toolIds: string[]) => {
    const seen = new Set<string>()
    return toolIds.filter((id) => {
      const info = toolStatus?.tools.find((t) => t.key === id)
      if (!info) return false
      if (seen.has(info.skills_dir)) return false
      seen.add(info.skills_dir)
      return true
    })
  }, [toolStatus])
  
  const visibleSkills = useMemo(() => {
    let filtered = managedSkills
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description?.toLowerCase().includes(query),
      )
    }
    
    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter((skill) => skill.category === categoryFilter)
    }
    
    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else {
        return (b.updated_at ? new Date(b.updated_at).getTime() : 0) - (a.updated_at ? new Date(a.updated_at).getTime() : 0)
      }
    })
    
    return sorted
  }, [managedSkills, searchQuery, categoryFilter, sortBy])
  
  const pendingSharedLabels = useMemo(() => {
    if (!pendingSharedToggle) return null
    const toolId = pendingSharedToggle.toolId
    const shared = sharedToolIdsByToolId[toolId] ?? []
    const others = shared.filter((id) => id !== toolId)
    return {
      toolLabel: toolLabelById[toolId] ?? toolId,
      otherLabels: others.map((id) => toolLabelById[id] ?? id).join(', '),
    }
  }, [pendingSharedToggle, sharedToolIdsByToolId, toolLabelById])
  
  // Handlers
  const loadPlan = useCallback(async () => {
    setLoading(true)
    setLoadingStartAt(Date.now())
    setError(null)
    try {
      const result = await invokeTauri<OnboardingPlan>('get_onboarding_plan')
      setPlan(result)
      const defaultSelected: Record<string, boolean> = {}
      const defaultChoice: Record<string, string> = {}
      result.groups.forEach((group) => {
        defaultSelected[group.name] = true
        const first = group.variants[0]
        if (first) {
          defaultChoice[group.name] = first.path
        }
      })
      setSelected(defaultSelected)
      setVariantChoice(defaultChoice)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [invokeTauri])

  const loadManagedSkills = useCallback(async () => {
    try {
      setLoading(true)
      setLoadingStartAt(Date.now())
      const result = await invokeTauri<ManagedSkill[]>('get_managed_skills')
      setManagedSkills(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [invokeTauri])

  const loadCategories = useCallback(async () => {
    try {
      const result = await invokeTauri<CategoryInfoDto[]>('list_categories_db')
      setCategories(result)
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }, [invokeTauri])

  const loadToolStatus = useCallback(async () => {
    try {
      const result = await invokeTauri<ToolStatusDto>('get_tool_status')
      setToolStatus(result)
    } catch (err) {
      console.error('Failed to load tool status:', err)
    }
  }, [invokeTauri])

  const loadDiscoveredSkills = useCallback(async () => {
    setDiscoveryLoading(true)
    setError(null)
    try {
      const skills = await invokeTauri<DiscoveredSkillDto[]>('fetch_discovered_skills_from_db')
      setDiscoveredSkills(skills)
      
      // 从技能中提取唯一分类
      const uniqueCategories = Array.from(
        new Set(skills.map(s => s.category).filter(Boolean))
      ).map(category => ({
        id: category,
        name: category,
        description: '',
        icon: '📦',
        count: skills.filter(s => s.category === category).length
      }))
      setDiscoveryCategories(uniqueCategories)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDiscoveryLoading(false)
    }
  }, [invokeTauri])
  
  const handleInstallQuickSkill = useCallback(
    async (skill: DiscoveredSkillDto) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        setActionMessage(t('actions.installing', { name: skill.name }))
        await invokeTauri('install_quick_skill', { skill })
        const installedText = t('status.skillInstalled', { name: skill.name })
        setActionMessage(installedText)
        setSuccessToastMessage(installedText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        setError(raw)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, t],
  )
  
  const handleDeleteManaged = useCallback(
    async (skill: ManagedSkill) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setActionMessage(t('actions.removing', { name: skill.name }))
      setError(null)
      try {
        await invokeTauri('delete_managed_skill', { skillId: skill.id })
        setActionMessage(t('status.skillRemoved'))
        setSuccessToastMessage(t('status.skillRemoved'))
        setActionMessage(null)
        await loadManagedSkills()
        setPendingDeleteId(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, t],
  )
  
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
    ],
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
    [invokeTauri, loadManagedSkills, loading, t, toolLabelById],
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
    [loading, runToggleToolForSkill, sharedToolIdsByToolId],
  )
  
  const handleUpdateManaged = useCallback(
    async (skill: ManagedSkill) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        setActionMessage(t('actions.updating', { name: skill.name }))
        await invokeTauri<UpdateResultDto>('update_managed_skill', { skillId: skill.id })
        const updatedText = t('status.updated', { name: skill.name })
        setActionMessage(updatedText)
        setSuccessToastMessage(updatedText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        setError(raw)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, t],
  )
  
  const handleUpdateSkillCategory = useCallback(
    async (skillId: string, category: string | null) => {
      try {
        await invokeTauri('update_skill_category', { skillId, category })
        await loadManagedSkills()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      }
    },
    [invokeTauri, loadManagedSkills],
  )
  
  const handleSharedCancel = useCallback(() => {
    if (loading) return
    setPendingSharedToggle(null)
  }, [loading])
  
  const handleSharedConfirm = useCallback(() => {
    if (!pendingSharedToggle) return
    const payload = pendingSharedToggle
    setPendingSharedToggle(null)
    void runToggleToolForSkill(payload.skill, payload.toolId)
  }, [pendingSharedToggle, runToggleToolForSkill])
  
  return {
    // State
    plan,
    loading,
    error,
    actionMessage,
    successToastMessage,
    managedSkills,
    localPath,
    localName,
    gitUrl,
    gitName,
    pendingDeleteId,
    gitCandidatesRepoUrl,
    showGitPickModal,
    showLocalPickModal,
    loadingStartAt,
    showNewToolsModal,
    showAddModal,
    showImportModal,
    pendingSharedToggle,
    searchQuery,
    sortBy,
    categoryFilter,
    addModalTab,
    discoveredSkills,
    discoveryCategories,
    discoveryLoading,
    categories,
    selected,
    variantChoice,
    toolStatus,
    syncTargets,
    
    // Setters
    setPlan,
    setLoading,
    setError,
    setActionMessage,
    setSuccessToastMessage,
    setLocalPath,
    setLocalName,
    setGitUrl,
    setGitName,
    setPendingDeleteId,
    setGitCandidatesRepoUrl,
    setSearchQuery,
    setSortBy,
    setCategoryFilter,
    setAddModalTab,
    setShowNewToolsModal,
    setShowAddModal,
    setShowImportModal,
    setShowGitPickModal,
    setShowLocalPickModal,
    setPendingSharedToggle,
    setSelected,
    setVariantChoice,
    setSyncTargets,
    
    // Computed
    pendingDeleteSkill,
    installedTools,
    newlyInstalledToolsText,
    isInstalled,
    toolLabelById,
    uniqueToolIdsBySkillsDir,
    pendingSharedLabels,
    
    // Utility functions
    formatRelative,
    getSkillSourceLabel,
    getGithubInfo,
    isSkillNameTaken,
    visibleSkills,
    
    // Handlers
    loadPlan,
    loadManagedSkills,
    loadCategories,
    loadToolStatus,
    loadDiscoveredSkills,
    handleDeleteManaged,
    handleSyncAllManagedToTools,
    runToggleToolForSkill,
    handleToggleToolForSkill,
    handleUpdateManaged,
    handleUpdateSkillCategory,
    handleSharedCancel,
    handleSharedConfirm,
    handleInstallQuickSkill,
  }
}
