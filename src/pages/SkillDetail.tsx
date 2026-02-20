import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import type { FileTreeNode } from '../components/FileTree'
import { useSkillContent } from '../hooks/skills/useSkillContent'
import { useTranslation as useTranslationHook } from '../hooks/skills/useTranslation'
import { SkillDetailHeader } from '../components/skills/common/SkillDetailHeader'
import { SkillDetailContent } from '../components/skills/detail/SkillDetailContent'
import type { Language } from '../services/translationService'
import type { ChatPanelConfig } from '@/chat-panel-core/types'

type ViewMode = 'edit' | 'preview' | 'split' | 'translate' | 'optimize'

export default function SkillDetail() {
  const { skillId } = useParams<{ skillId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [skillName, setSkillName] = useState('')
  const [targetLanguage, setTargetLanguage] = useState<Language>('zh')
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string>('SKILL.md')
  const [showFileTree, setShowFileTree] = useState(true)
  const [skillPath, setSkillPath] = useState('')
  const [loading, setLoading] = useState(true)

  const { content, originalContent, loading: contentLoading, hasChanges, saving, setContent, loadFileContent, handleSave } = useSkillContent({
    skillId: skillId || '',
    selectedFilePath
  })

  const { translatedContent, translating, translationError, isRateLimitError, handleTranslate, resetTranslation } = useTranslationHook({
    content,
    targetLanguage
  })

  const [optimizeSessionId] = useState(() => `skill-optimize-${skillId}`)

  const optimizeChatConfig = useMemo<ChatPanelConfig>(() => {
    // Extract parent directory from skillPath (e.g., /Users/junmengye/.skillshub/skill-creator-enhanced -> /Users/junmengye/.skillshub)
    const parentDir = skillPath ? skillPath.split('/').slice(0, -1).join('/') : '';
    
    return {
      apiEndpoint: '/api/chat',
      title: t('optimizationChat'),
      description: t('optimizationWelcomeMessage'),
      placeholder: t('optimizationPromptPlaceholder'),
      systemContext: content
        ? `The following is the content of a skill file (${selectedFilePath}) named "${skillName}":\n\n${content}`
        : undefined,
      defaultWorkingDirectory: parentDir,
      suggestions: [
        { value: `帮我分析这个 skill 的结构和质量，路径是 ${skillPath}`, label: '🔍 分析 Skill' },
        { value: `这个 skill 有什么优化空间？请给出具体建议，路径是 ${skillPath}`, label: '✨ 优化建议' },
        { value: `我的工作流程是___，想复用这个 skill，有什么建议？路径是 ${skillPath}`, label: '🔄 复用建议' },
        { value: `帮我检查这个 skill 的最佳实践合规性，路径是 ${skillPath}`, label: '✅ 最佳实践' },
      ],
    };
  }, [t, content, selectedFilePath, skillName, skillPath])

  const loadSkillContent = useCallback(async (fileName = selectedFilePath) => {
    if (!skillId) return
    
    try {
      setLoading(true)
      await loadFileContent(fileName)
      setSelectedFilePath(fileName)
      
      // Extract skill name from frontmatter if loading SKILL.md
      if (fileName === 'SKILL.md') {
        const nameMatch = content.match(/^---\s*\nname:\s*(.+?)\s*\n/m)
        if (nameMatch) {
          setSkillName(nameMatch[1].replace(/['"]/g, ''))
        }
      }
    } catch (error) {
      toast.error(t('errors.loadFailed'))
      console.error('Failed to load skill:', error)
    } finally {
      setLoading(false)
    }
  }, [skillId, loadFileContent, content])

  const loadFileTree = useCallback(async () => {
    if (!skillId) return
    
    try {
      const tree = await invoke<FileTreeNode[]>('list_skill_files', { skillId })
      setFileTree(tree)
      
      const skills = await invoke<{ id: string; central_path: string }[]>('get_managed_skills')
      const currentSkill = skills.find(s => s.id === skillId)
      if (currentSkill) {
        setSkillPath(currentSkill.central_path)
      }
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
  }, [skillId])

  useEffect(() => {
    loadSkillContent()
    loadFileTree()
  }, [loadSkillContent, loadFileTree, location.key])

  const handleFileSelect = useCallback((path: string) => {
    loadSkillContent(path)
  }, [loadSkillContent])

  // Auto-translate when entering translate mode or when target language changes
  useEffect(() => {
    if (viewMode === 'translate' && content && !translating) {
      handleTranslate()
    }
  }, [viewMode, content, targetLanguage, translating, handleTranslate])

  // Clear translation when leaving translate mode
  useEffect(() => {
    if (viewMode !== 'translate') {
      resetTranslation()
    }
  }, [viewMode, resetTranslation])

  const handleBack = () => {
    if (hasChanges) {
      if (confirm(t('confirmUnsavedChanges'))) {
        navigate(-1)
      }
    } else {
      navigate(-1)
    }
  }

  const handleGoToSettings = () => {
    navigate('/?openSettings=true')
  }

  const handleTargetLanguageChange = (lang: Language) => {
    setTargetLanguage(lang)
    // Clear previous translation when language changes
    resetTranslation()
  }

  if (loading || contentLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <SkillDetailHeader
        skillName={skillName}
        hasChanges={hasChanges}
        saving={saving}
        viewMode={viewMode}
        showFileTree={showFileTree}
        targetLanguage={targetLanguage}
        onBack={handleBack}
        onSave={handleSave}
        onToggleFileTree={() => setShowFileTree(!showFileTree)}
        onViewModeChange={setViewMode}
        onTargetLanguageChange={handleTargetLanguageChange}
        onRetryTranslation={handleTranslate}
        translating={translating}
        t={t}
      />
      <div className="flex-1 overflow-hidden">
        <SkillDetailContent
          viewMode={viewMode}
          showFileTree={showFileTree}
          fileTree={fileTree}
          skillPath={skillPath}
          selectedFilePath={selectedFilePath}
          content={content}
          translatedContent={translatedContent}
          translating={translating}
          translationError={translationError}
          isRateLimitError={isRateLimitError}
          optimizeSessionId={optimizeSessionId}
          optimizeChatConfig={optimizeChatConfig}
          onFileSelect={handleFileSelect}
          onContentChange={setContent}
          onRetryTranslation={handleTranslate}
          onGoToSettings={handleGoToSettings}
          t={t}
        />
      </div>
    </div>
  )
}