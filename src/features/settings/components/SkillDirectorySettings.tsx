import { memo, useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TFunction } from 'i18next'
import type { CategoryInfoDto } from '../../../shared/types'

type SkillDirectorySettingsProps = {
  isTauri: boolean
  t: TFunction
}

const SkillDirectorySettings = ({ isTauri, t }: SkillDirectorySettingsProps) => {
  const [scanPaths, setScanPaths] = useState<string[]>([])
  const [newScanPath, setNewScanPath] = useState<string>('')
  const [isScanPathsExpanded, setIsScanPathsExpanded] = useState<boolean>(false)
  const [categories, setCategories] = useState<CategoryInfoDto[]>([])
  const [newCategoryName, setNewCategoryName] = useState<string>('')
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('')
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(false)

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
    
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
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

  // Expose load functions to parent component
  if (typeof window !== 'undefined') {
    (window as any).loadSkillDirectorySettings = async () => {
      await Promise.all([loadScanPaths(), loadCategories()])
    }
  }

  return (
    <>
      {/* Skill Scan Paths Section */}
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

      {/* Skill Categories Section */}
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
    </>
  )
}

export default memo(SkillDirectorySettings)
