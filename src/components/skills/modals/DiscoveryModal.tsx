import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { Search, ExternalLink, RefreshCw, Globe, Star, Github, ChevronLeft, ChevronRight, ChevronDown, Loader2, Download, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { openUrl } from '@tauri-apps/plugin-opener'
import { invoke } from '@tauri-apps/api/core'
import type { TFunction } from 'i18next'
import type { DiscoveredSkillDto, CategoryInfoDto, PaginatedSkillsDto, InstallResultDto, ManagedSkill } from '../types'

// 黑名单存储键
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
  
  // 远程分页数据状态
  const [paginatedData, setPaginatedData] = useState<PaginatedSkillsDto | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [useRemotePagination, setUseRemotePagination] = useState(false)

  // 加载指定分类的分页数据
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

  // 当分类、页码或每页大小改变时重新加载数据
  useEffect(() => {
    if (selectedCategory !== 'all') {
      loadPaginatedSkills(selectedCategory, currentPage, pageSize)
    } else {
      setUseRemotePagination(false)
      setPaginatedData(null)
    }
  }, [selectedCategory, currentPage, pageSize, loadPaginatedSkills])

  // 获取当前显示的技能列表
  const currentSkills = useRemotePagination && paginatedData 
    ? paginatedData.skills 
    : discoveredSkills

  // 创建已安装技能的 github_url 集合，用于过滤
  const installedGithubUrls = useMemo(() => {
    return new Set(
      installedSkills
        .filter(skill => skill.source_type === 'git' && skill.source_ref)
        .map(skill => skill.source_ref!.replace(/\.git$/, ''))
    )
  }, [installedSkills])

  // 过滤逻辑（仅用于"全部"分类或搜索时，同时过滤黑名单和已安装技能）
  const filteredSkills = useRemotePagination 
    ? currentSkills.filter((skill) => {
        // 过滤黑名单
        if (blacklist.has(skill.github_url)) {
          return false
        }
        // 过滤已安装的技能
        if (installedGithubUrls.has(skill.github_url.replace(/\.git$/, ''))) {
          return false
        }
        return true
      })
    : currentSkills.filter((skill) => {
        // 过滤黑名单
        if (blacklist.has(skill.github_url)) {
          return false
        }
        
        // 过滤已安装的技能
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

  // 计算总页数
  const totalPages = useRemotePagination && paginatedData
    ? paginatedData.pagination.total_pages
    : Math.ceil(filteredSkills.length / pageSize)

  // 前端分页（仅用于"全部"分类）
  const paginatedSkills = useRemotePagination
    ? currentSkills
    : (() => {
        const startIndex = (currentPage - 1) * pageSize
        const endIndex = startIndex + pageSize
        return filteredSkills.slice(startIndex, endIndex)
      })()

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  // Reset to first page when search or category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory])

  // 添加到黑名单
  const addToBlacklist = useCallback((githubUrl: string) => {
    const newBlacklist = new Set(blacklist)
    newBlacklist.add(githubUrl)
    setBlacklist(newBlacklist)
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify([...newBlacklist]))
    toast.success('已加入黑名单', {
      description: '该技能将不再显示在列表中'
    })
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
        // 如果是 404 或无法访问，提示用户加入黑名单
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
      
      // Convert github_url to git URL format
      // From: https://github.com/user/repo
      // To: https://github.com/user/repo.git
      const gitUrl = skill.github_url.endsWith('.git') 
        ? skill.github_url 
        : `${skill.github_url}.git`
      
      const toastId = toast.loading('正在安装 Skill...', {
        description: `安装 ${skill.name}`
      })
      
      try {
        const result = await invoke<InstallResultDto>('install_git', {
          repoUrl: gitUrl,
          name: skill.name
        })
        
        toast.success('Skill 安装成功', {
          id: toastId,
          description: `${result.name} 已安装到 ${result.central_path}`
        })
        
        // Refresh the list after installation
        if (selectedCategory !== 'all') {
          loadPaginatedSkills(selectedCategory, currentPage, pageSize)
        } else {
          onRefresh()
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        // 检查是否是仓库不存在的错误
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
          toast.error('仓库不存在', {
            id: toastId,
            description: '该 Skill 仓库可能已被删除或设为私有，无法安装'
          })
        } else if (errorMsg.includes('already exists')) {
          toast.error('Skill 已存在', {
            id: toastId,
            description: '该 Skill 已经安装过了'
          })
        } else {
          toast.error('安装失败', {
            id: toastId,
            description: errorMsg
          })
        }
      }
    },
    [selectedCategory, currentPage, pageSize, loadPaginatedSkills, onRefresh]
  )

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
          {/* Skill Channels */}
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

          {/* Search and Filter */}
          <div className="discovery-filters">
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
                          // 刷新列表
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

          {/* Skills Grid */}
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
                return (
                  <div key={`${skill.category}-${skill.name}`} className="discovery-card">
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
                        title="安装此技能"
                      >
                        <Download size={14} />
                        {t('install')}
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
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
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