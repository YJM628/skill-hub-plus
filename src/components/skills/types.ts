// Re-export shared types for backward compatibility
export * from '../../shared/types'

export type ToolInfoDto = {
  key: string
  label: string
  installed: boolean
  skills_dir: string
}

export type ToolStatusDto = {
  tools: ToolInfoDto[]
  installed: string[]
  newly_installed: string[]
}

// Extended OnboardingVariant with additional fields for component use
export type OnboardingVariantExtended = {
  tool: string
  name: string
  path: string
  fingerprint?: string | null
  is_link: boolean
  link_target?: string | null
}

// Extended OnboardingGroup with conflict detection
export type OnboardingGroupExtended = {
  name: string
  variants: OnboardingVariantExtended[]
  has_conflict: boolean
}

// Extended OnboardingPlan with scan statistics
export type OnboardingPlanExtended = {
  total_tools_scanned: number
  total_skills_found: number
  groups: OnboardingGroupExtended[]
}

// Local skill candidate with validation
export type LocalSkillCandidate = {
  name: string
  description?: string | null
  subpath: string
  valid: boolean
  reason?: string | null
}

// Git skill candidate
export type GitSkillCandidate = {
  name: string
  description?: string | null
  subpath: string
}

// Pagination info for component use
export type PaginationInfo = {
  current_page: number
  page_size: number
  total_items: number
  total_pages: number
}
