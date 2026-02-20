import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface UseSkillContentParams {
  skillId: string
  selectedFilePath: string
}

interface UseSkillContentReturn {
  content: string
  originalContent: string
  loading: boolean
  hasChanges: boolean
  saving: boolean
  setContent: (content: string) => void
  loadFileContent: (fileName: string) => Promise<void>
  handleSave: () => Promise<void>
}

export function useSkillContent({ skillId, selectedFilePath }: UseSkillContentParams): UseSkillContentReturn {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasChanges = content !== originalContent

  const loadFileContent = useCallback(async (fileName: string) => {
    if (!skillId) return
    
    try {
      setLoading(true)
      const fileContent = await invoke<string>('read_skill_file', {
        skillId,
        fileName
      })
      setContent(fileContent)
      setOriginalContent(fileContent)
    } catch (error) {
      console.error('Failed to load skill:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [skillId])

  const handleSave = useCallback(async () => {
    if (!skillId || !hasChanges || !selectedFilePath) return
    
    try {
      setSaving(true)
      await invoke('write_skill_file', {
        skillId,
        fileName: selectedFilePath,
        content
      })
      setOriginalContent(content)
    } catch (error) {
      console.error('Failed to save skill:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [skillId, hasChanges, content, selectedFilePath])

  return {
    content,
    originalContent,
    loading,
    hasChanges,
    saving,
    setContent,
    loadFileContent,
    handleSave
  }
}
