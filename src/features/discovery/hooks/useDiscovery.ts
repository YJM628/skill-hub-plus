import { useState, useCallback } from 'react'
import { invokeTauri } from '../../../shared/services/tauriApi'
import type { DiscoveredSkillDto, CategoryInfoDto } from '../../../shared/types'

export interface UseDiscoveryReturn {
  discoveryLoading: boolean
  discoveredSkills: DiscoveredSkillDto[]
  discoveryCategories: CategoryInfoDto[]
  loadDiscoveredSkills: () => Promise<void>
}

export function useDiscovery(
  installedSkills: Array<{ id: string; name: string }>,
): UseDiscoveryReturn {
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveredSkills, setDiscoveredSkills] = useState<DiscoveredSkillDto[]>([])
  const [discoveryCategories, setDiscoveryCategories] = useState<CategoryInfoDto[]>([])

  const loadDiscoveredSkills = useCallback(async () => {
    setDiscoveryLoading(true)
    try {
      const result = await invokeTauri<{
        skills: DiscoveredSkillDto[]
        categories: CategoryInfoDto[]
      }>('discover_skills', {
        installedSkillIds: installedSkills.map((s) => s.id),
      })
      setDiscoveredSkills(result.skills)
      setDiscoveryCategories(result.categories)
    } catch (err) {
      console.error('Failed to discover skills:', err)
    } finally {
      setDiscoveryLoading(false)
    }
  }, [installedSkills])

  return {
    discoveryLoading,
    discoveredSkills,
    discoveryCategories,
    loadDiscoveredSkills,
  }
}