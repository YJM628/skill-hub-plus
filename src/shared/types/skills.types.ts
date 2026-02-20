// Skill-related type definitions

export interface ManagedSkill {
  id: string;
  name: string;
  central_path: string;
  category: string | null;
  targets: SkillTarget[];
  updated_at: string;
  source_type: 'local' | 'git';
  source_ref?: string;
  git_info?: GitInfo;
  description?: string;
}

export interface SkillTarget {
  tool: string;
  path: string;
  synced_at: string;
  mode: string;
}

export interface GitInfo {
  repo_url: string;
  branch: string;
  commit: string;
}

export interface InstallResultDto {
  name: string;
  skill_id: string;
  central_path: string;
}

export interface UpdateResultDto {
  name: string;
  updated_at: string;
}

export interface LocalCandidate {
  subpath: string;
  name: string;
}

export interface GitCandidate {
  subpath: string;
  name: string;
}

export interface SkillEvent {
  skill_id: string;
  event_type: string;
  timestamp: string;
}

export interface OnboardingPlan {
  groups: OnboardingGroup[];
  total_tools_scanned: number;
  total_skills_found: number;
}

export interface OnboardingGroup {
  name: string;
  variants: OnboardingVariant[];
  has_conflict: boolean;
}

export interface OnboardingVariant {
  path: string;
  name: string;
  tool: string;
  is_link: boolean;
  link_target?: string;
  has_conflict: boolean;
}

export interface CategoryInfoDto {
  id: string;
  name: string;
  count: number;
  icon: string;
  description?: string;
}

export interface DiscoveredSkillDto {
  id: string;
  name: string;
  description: string;
  tags: string[];
  author: string;
  repository_url: string;
  github_url: string;
  category: string;
}

export interface PaginatedSkillsDto {
  skills: DiscoveredSkillDto[];
  total: number;
  page: number;
  page_size: number;
  pagination: {
    current_page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}