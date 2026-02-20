import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { Search, ExternalLink, RefreshCw, Globe, Star, Github, ChevronLeft, ChevronRight, ChevronDown, Loader2, Download, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { openUrl } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'
import type { TFunction } from 'i18next'
import type { DiscoveredSkillDto, CategoryInfoDto, PaginatedSkillsDto, InstallResultDto, ManagedSkill } from '../../../shared/types'

const BLACKLIST_STORAGE_KEY = 'skills-hub-blacklist'

type DiscoveryModalProps = {
  open: boolean
  loading: boolean
  discoveredSkills: DiscoveredSkillDto[]
  categories: CategoryInfoDto[]
  installedSkills?: ManagedSkill[]
  onRequestClose: () => void
  onRefresh: () => void
  t: TFunction
}

type SkillChannel = {
  id: string
  name: string
  description: string
  url: string
  icon: React.ReactNode
}

const SKILL_CHANNELS: SkillChannel[] = [
  {
    id: 'skills-sh',
    name: 'skills.sh',
    description: '社区驱动的 Skill 目录，按安装量排序',
    url: 'https://skills.sh',
    icon: <Globe className="w-4 h-4" />,
  },
  {
    id: 'awesome-claude',
    name: 'Awesome Claude Skills',
    description: '精选高质量 Skill 列表',
    url: 'https://github.com/BehiSecc/awesome-claude-skills',
    icon: <Star className="w-4 h-4" />,
  },
  {
    id: 'github-topics',
    name: 'GitHub Topics',
    description: '搜索 topic:claude-skill, topic:ai-skill',
    url: 'https://github.com/topics/claude-skill',
    icon: <Github className="w-4 h-4" />,
  },
]

const CATEGORY_INFO_DEFAULT: Record<string, { name: string; icon: string; color: string }> = {
  all: {
    name: '全部',
    icon: '📚',
    color: '#6b7280',
  },
}

const PAGE_SIZE_OPTIONS = [8, 12, 24]

const DiscoveryModal = ({
  open,
  loading: parentLoading,
  discoveredSkills,
  categories,
  installedSkills = [],
  onRequestClose,
  onRefresh,
  t,
}: DiscoveryModalProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [blacklist, setBlacklist] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })
  
  const [paginatedData, setPaginatedData] = useState<PaginatedSkillsDto | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [useRemotePagination, setUseRemotePagination] = useState(false)
  const [installingSkills, setInstallingSkills] = useState<Set<string>>(new Set())
  const [hoveredSkillGithubUrl, setHoveredSkillGithubUrl] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<Record<string, { stage: string; message: string }>>({})
  const [installQueue, setInstallQueue] = useState<DiscoveredSkillDto[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)

  const loadPaginatedSkills = useCallback(async (category: string, page: number, size: number) => {
    if (category === 'all') {
      setUseRemotePagination(false)
      setPaginatedData(null)
      return
    }

    setIsLoadingPage(true)
    try {
      const result = await invoke<PaginatedSkillsDto>('fetch_skills_by_category_with_pagination', {
        categoryId: category,
        page: page,
        pageSize: size,
      })
      setPaginatedData(result)
      setUseRemotePagination(true)
    } catch (error) {
      console.error('Failed to load paginated skills:', error)
      toast.error('加载技能失败', {
        description: error instanceof Error ? error.message : String(error)
      })
      setUseRemotePagination(false)
      setPaginatedData(null)
    } finally {
      setIsLoadingPage(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCategory !== 'all') {
      loadPaginatedSkills(selectedCategory, currentPage, pageSize)
    } else {
      setUseRemotePagination(false)
      setPaginatedData(null)
    }
  }, [selectedCategory, currentPage, pageSize, loadPaginatedSkills])

  const currentSkills = useRemotePagination && paginatedData 
    ? paginatedData.skills 
    : discoveredSkills

  const installedGithubUrls = useMemo(() => {
    return new Set(
      installedSkills
        .filter(skill => skill.source_type === 'git' && skill.source_ref)
        .map(skill => skill.source_ref!.replace(/\.git$/, ''))
    )
  }, [installedSkills])

  const filteredSkills = useRemotePagination 
    ? currentSkills.filter((skill) => {
        if (blacklist.has(skill.github_url)) {
          return false
        }
        if (installedGithubUrls.has(skill.github_url.replace(/\.git$/, ''))) {
          return false
        }
        return true
      })
    : currentSkills.filter((skill) => {
        if (blacklist.has(skill.github_url)) {
          return false
        }
        
        if (installedGithubUrls.has(skill.github_url.replace(/\.git$/, ''))) {
          return false
        }
        
        const matchesSearch =
          searchQuery.trim() === '' ||
          skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesCategory =
          selectedCategory === 'all' || skill.category === selectedCategory
        
        return matchesSearch && matchesCategory
      })

  const totalPages = useRemotePagination && paginatedData
    ? paginatedData.pagination.total_pages
    : Math.ceil(filteredSkills.length / pageSize)

  const paginatedSkills = useRemotePagination
    ? currentSkills
    : (() => {
        const startIndex = (currentPage - 1) * pageSize
        const endIndex = startIndex + pageSize
        return filteredSkills.slice(startIndex, endIndex)
      })()

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory])

  const addToBlacklist = useCallback((githubUrl: string) => {
    const newBlacklist = new Set(blacklist)
    newBlacklist.add(githubUrl)
    setBlacklist(newBlacklist)
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify([...newBlacklist]))
  }, [blacklist])

  const handleOpenGithub = useCallback(
    async (url: string, skill: DiscoveredSkillDto, e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await openUrl(url)
        toast.success(t('openingGithub'), {
          description: t('openingGithubDesc'),
          action: {
            label: '加入黑名单',
            onClick: () => addToBlacklist(skill.github_url)
          }
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        toast.error('无法打开链接', {
          description: errorMsg,
          action: {
            label: '加入黑名单',
            onClick: () => addToBlacklist(skill.github_url)
          }
        })
      }
    },
    [t, addToBlacklist]
  )



  const handleInstallSkill = useCallback(
    async (skill: DiscoveredSkillDto, e: React.MouseEvent) => {
      e.stopPropagation()
      
      // 检查是否已在队列中
      const isInQueue = installQueue.some(s => s.github_url === skill.github_url)
      const isInstalling = installingSkills.has(skill.github_url)
      
      if (isInQueue || isInstalling) {
        toast.info('⏳ 已在队列中', {
          description: `${skill.name} 正在等待安装或正在安装中`
        })
        return
      }
      
      // 添加到队列
      setInstallQueue(prev => [...prev, skill])
      
      toast.success('✓ 已添加到安装队列', {
        description: `${skill.name} 将在后台自动安装`,
        action: installQueue.length > 0 ? {
          label: `队列中还有 ${installQueue.length} 个技能`,
          onClick: () => {}
        } : undefined
      })
    },
    [installQueue, installingSkills]
  )

  // 处理安装队列
  useEffect(() => {
    const processQueue = async () => {
      if (installQueue.length === 0 || isProcessingQueue) {
        return
      }

      setIsProcessingQueue(true)
      const skillToInstall = installQueue[0]
      
      const gitUrl = skillToInstall.github_url.endsWith('.git') 
        ? skillToInstall.github_url 
        : `${skillToInstall.github_url}.git`
      
      // 添加到安装状态
      setInstallingSkills(prev => new Set(prev).add(skillToInstall.github_url))
      
      // 初始化进度信息
      setInstallProgress(prev => ({
        ...prev,
        [skillToInstall.github_url]: { stage: 'connecting', message: '🔄 正在连接 GitHub...' }
      }))
      
      const toastId = toast.loading('🔄 正在准备安装...', {
        description: skillToInstall.name
      })
      
      try {
        // 模拟进度更新
        setTimeout(() => {
          setInstallProgress(prev => ({
            ...prev,
            [skillToInstall.github_url]: { stage: 'cloning', message: '🔄 正在克隆仓库...' }
          }))
          toast.loading('🔄 正在克隆仓库...', {
            id: toastId,
            description: skillToInstall.name
          })
        }, 500)
        
        const result = await invoke<InstallResultDto>('install_git', {
          repoUrl: gitUrl,
          name: skillToInstall.name
        })
        
        toast.success('✅ Skill 安装成功', {
          id: toastId,
          description: `${result.name} 已安装到 ${result.central_path}`
        })
        
        // 从安装状态中移除
        setInstallingSkills(prev => {
          const newSet = new Set(prev)
          newSet.delete(skillToInstall.github_url)
          return newSet
        })
        
        // 清除进度信息
        setInstallProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[skillToInstall.github_url]
          return newProgress
        })
        
        // 从队列中移除已安装的技能
        setInstallQueue(prev => prev.slice(1))
        
        if (selectedCategory !== 'all') {
          loadPaginatedSkills(selectedCategory, currentPage, pageSize)
        } else {
          onRefresh()
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        // 从安装状态中移除
        setInstallingSkills(prev => {
          const newSet = new Set(prev)
          newSet.delete(skillToInstall.github_url)
          return newSet
        })
        
        // 清除进度信息
        setInstallProgress(prev => {
          const newProgress = { ...prev }
          delete newProgress[skillToInstall.github_url]
          return newProgress
        })
        
        // 从队列中移除失败的技能
        setInstallQueue(prev => prev.slice(1))
        
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
          toast.error('❌ 仓库不存在', {
            id: toastId,
            description: '该 Skill 仓库可能已被删除或设为私有，无法安装'
          })
        } else if (errorMsg.includes('already exists')) {
          toast.error('❌ Skill 已存在', {
            id: toastId,
            description: '该 Skill 已经安装过了'
          })
        } else {
          toast.error('❌ 安装失败', {
            id: toastId,
            description: errorMsg
          })
        }
      } finally {
        setIsProcessingQueue(false)
      }
    }

    processQueue()
  }, [installQueue, isProcessingQueue, selectedCategory, currentPage, pageSize, loadPaginatedSkills, onRefresh])

  const handleOpenChannel = useCallback(
    async (channel: SkillChannel) => {
      try {
        await openUrl(channel.url)
        toast.success('正在打开 ' + channel.name, {
          description: channel.description
        })
      } catch (error) {
        toast.error('无法打开链接', {
          description: error instanceof Error ? error.message : String(error)
        })
      }
    },
    []
  )

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  if (!open) return null

  const isLoading = parentLoading || isLoadingPage

  return (
    <div
      className="modal-backdrop"
      onClick={() => onRequestClose()}
    >
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t('discoverTitle')}</div>
          <button
            className="modal-close"
            type="button"
            onClick={onRequestClose}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="skill-channels">
            <h3 className="skill-channels-title">探索更多 Skills</h3>
            <div className="skill-channels-grid">
              {SKILL_CHANNELS.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  className="skill-channel-card"
                  onClick={() => handleOpenChannel(channel)}
                >
                  <div className="skill-channel-icon">{channel.icon}</div>
                  <div className="skill-channel-content">
                    <h4 className="skill-channel-name">{channel.name}</h4>
                    <p className="skill-channel-description">{channel.description}</p>
                  </div>
                  <ExternalLink className="skill-channel-arrow" size={16} />
                </button>
              ))}
            </div>
          </div>

          <div className="discovery-filters">
            {/* 安装队列状态显示 */}
            {(installQueue.length > 0 || isProcessingQueue) && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    minWidth: '200px'
                  }}>
                    <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
                    <span style={{ 
                      fontWeight: 500, 
                      color: '#1e40af',
                      fontSize: '14px'
                    }}>
                      {isProcessingQueue ? '正在安装' : '等待安装'}
                    </span>
                    <span style={{
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {installQueue.length}
                    </span>
                  </div>
                  
                  {installQueue.length > 0 && (
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      flex: 1,
                      minWidth: '200px'
                    }}>
                      当前: {installQueue[0].name}
                      {installQueue.length > 1 && (
                        <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                          (+{installQueue.length - 1} 个等待中)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                className="input search-input"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="source-tabs">
              <button
                className={`source-tab${selectedCategory === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setSelectedCategory('all')}
              >
                <span>{CATEGORY_INFO_DEFAULT.all.icon}</span>
                {CATEGORY_INFO_DEFAULT.all.name}
                <span className="count">{discoveredSkills.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  className={`source-tab${selectedCategory === category.id ? ' active' : ''}`}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <span>{category.icon}</span>
                  {category.name}
                  <span className="count">
                    {paginatedData?.pagination.total_items ?? discoveredSkills.filter((s) => s.category === category.id).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => {
                  if (blacklist.size === 0) {
                    toast.info('黑名单为空', {
                      description: '点击技能卡片上的"加入黑名单"按钮可以隐藏不想看到的技能'
                    })
                  } else {
                    toast.info('黑名单管理', {
                      description: `当前有 ${blacklist.size} 个技能在黑名单中`,
                      action: {
                        label: '清空黑名单',
                        onClick: () => {
                          setBlacklist(new Set())
                          localStorage.removeItem(BLACKLIST_STORAGE_KEY)
                          toast.success('已清空黑名单')
                          if (selectedCategory !== 'all') {
                            loadPaginatedSkills(selectedCategory, 1, pageSize)
                          } else {
                            onRefresh()
                          }
                        }
                      }
                    })
                  }
                }}
              >
                <Ban size={16} />
                黑名单 {blacklist.size > 0 ? `(${blacklist.size})` : ''}
              </button>
              <button
                className="btn btn-secondary refresh-btn"
                type="button"
                onClick={() => {
                  if (selectedCategory !== 'all') {
                    loadPaginatedSkills(selectedCategory, 1, pageSize)
                  } else {
                    onRefresh()
                  }
                }}
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
                {t('refresh')}
              </button>
            </div>
          </div>

          {isLoading && paginatedSkills.length === 0 ? (
            <div className="discovery-loading">
              <Loader2 size={32} className="animate-spin" />
              <p>{t('loadingSkills')}</p>
            </div>
          ) : paginatedSkills.length === 0 ? (
            <div className="discovery-empty">
              <p>{searchQuery ? t('noResults') : t('noSkillsFound')}</p>
            </div>
          ) : (
            <div className="discovery-grid">
              {paginatedSkills.map((skill) => {
                const categoryInfo = categories.find(c => c.id === skill.category) || { ...CATEGORY_INFO_DEFAULT.all, name: skill.category }
                const isInstalling = installingSkills.has(skill.github_url)
                
                return (
                  <div 
                    key={`${skill.category}-${skill.name}`} 
                    className="discovery-card"
                    onMouseEnter={() => setHoveredSkillGithubUrl(skill.github_url)}
                    onMouseLeave={() => setHoveredSkillGithubUrl(null)}
                    style={{ position: 'relative' }}
                  >
                    <div className="discovery-card-header">
                      <div className="discovery-card-source">
                        <span>{categoryInfo.icon}</span>
                        <span className="source-name">{categoryInfo.name}</span>
                      </div>
                    </div>

                    <div className="discovery-card-body">
                      <h3 className="discovery-card-name">{skill.name}</h3>
                      <p className="discovery-card-description">
                        {skill.description}
                      </p>
                      
                      {skill.tags.length > 0 && (
                        <div className="discovery-card-tags">
                          {skill.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tag">
                              {tag}
                            </span>
                          ))}
                          {skill.tags.length > 3 && (
                            <span className="tag more">+{skill.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="discovery-card-footer">
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={(e) => handleOpenGithub(skill.github_url, skill, e)}
                        title="访问 GitHub 仓库"
                      >
                        <ExternalLink size={14} />
                        {t('visitGithub')}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={(e) => handleInstallSkill(skill, e)}
                        title="自动安装此技能"
                        disabled={isInstalling}
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            {(installProgress[skill.github_url]?.message) || '安装中'}
                          </>
                        ) : (
                          <>
                            <Download size={14} />
                            {t('install')}
                          </>
                        )}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          addToBlacklist(skill.github_url)
                        }}
                        title="加入黑名单，隐藏此技能"
                        style={{ padding: '6px 8px' }}
                      >
                        <Ban size={14} />
                      </button>
                    </div>

                    {hoveredSkillGithubUrl === skill.github_url && (
                      <div 
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          zIndex: 10,
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none'
                        }}
                      >
                        {skill.github_url}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {filteredSkills.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || isLoadingPage}
                  aria-label="上一页"
                >
                  <ChevronLeft size={16} />
                  <span>上一页</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`min-w-[32px] h-8 px-2 text-sm rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-500 text-white font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setCurrentPage(page)}
                      disabled={isLoadingPage}
                      aria-label={`第 ${page} 页`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {isLoadingPage && currentPage === page ? <Loader2 size={14} className="animate-spin" /> : page}
                    </button>
                  ))}
                </div>

                <button
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || isLoadingPage}
                  aria-label="下一页"
                >
                  <span>下一页</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {useRemotePagination && paginatedData
                    ? `共 ${paginatedData.pagination.total_items} 条`
                    : `共 ${filteredSkills.length} 条`
                  }
                </span>
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    disabled={isLoadingPage}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors disabled:opacity-50"
                    aria-label="选择每页显示数量"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(DiscoveryModal)
