// Tauri API service layer - abstraction for all Tauri commands

import { invoke } from '@tauri-apps/api/core';

/**
 * Invoke Tauri command with automatic error handling
 */
export async function invokeTauri<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    // Re-throw as Error for consistent error handling
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  }
}

// Skill-related commands
export const skillCommands = {
  loadManagedSkills: () => invokeTauri('load_managed_skills'),
  installLocalSkill: (basePath: string, subpath: string, name?: string) =>
    invokeTauri('install_local_skill', { basePath, subpath, name }),
  installGitSkill: (repoUrl: string, subpath: string, name?: string) =>
    invokeTauri('install_git_skill', { repoUrl, subpath, name }),
  deleteManagedSkill: (skillId: string) =>
    invokeTauri('delete_managed_skill', { skillId }),
  updateManagedSkill: (skillId: string) =>
    invokeTauri('update_managed_skill', { skillId }),
  syncSkillToTool: (sourcePath: string, skillId: string, tool: string, name: string) =>
    invokeTauri('sync_skill_to_tool', { sourcePath, skillId, tool, name }),
  unsyncSkillFromTool: (skillId: string, tool: string) =>
    invokeTauri('unsync_skill_from_tool', { skillId, tool }),
  updateSkillCategory: (skillId: string, category: string | null) =>
    invokeTauri('update_skill_category', { skillId, category }),
  getSkillEvents: (skillId: string) =>
    invokeTauri('get_skill_events', { skillId }),
};

// Tool-related commands
export const toolCommands = {
  getTools: () => invokeTauri('get_tools'),
  getToolStatus: () => invokeTauri('get_tool_status'),
};

// Settings-related commands
export const settingsCommands = {
  getStoragePath: () => invokeTauri('get_storage_path'),
  pickStoragePath: () => invokeTauri('pick_storage_path'),
  getGitCacheCleanupDays: () => invokeTauri('get_git_cache_cleanup_days'),
  setGitCacheCleanupDays: (days: number) =>
    invokeTauri('set_git_cache_cleanup_days', { days }),
  getGitCacheTtlSecs: () => invokeTauri('get_git_cache_ttl_secs'),
  setGitCacheTtlSecs: (sec: number) =>
    invokeTauri('set_git_cache_ttl_secs', { sec }),
  getAutoUpdateEnabled: () => invokeTauri('get_auto_update_enabled'),
  setAutoUpdateEnabled: (enabled: boolean) =>
    invokeTauri('set_auto_update_enabled', { enabled }),
  getThemePreference: () => invokeTauri('get_theme_preference'),
  setThemePreference: (theme: string) =>
    invokeTauri('set_theme_preference', { theme }),
  getTranslationApiKey: () => invokeTauri('get_translation_api_key'),
  setTranslationApiKey: (key: string) =>
    invokeTauri('set_translation_api_key', { key }),
  getTranslationServiceType: () => invokeTauri('get_translation_service_type'),
  setTranslationServiceType: (type: string) =>
    invokeTauri('set_translation_service_type', { type }),
  getGoogleTranslationApiKey: () => invokeTauri('get_google_translation_api_key'),
  setGoogleTranslationApiKey: (key: string) =>
    invokeTauri('set_google_translation_api_key', { key }),
  clearGitCache: () => invokeTauri('clear_git_cache'),
};

// File system commands
export const fileCommands = {
  openDirectory: () => invokeTauri('open_directory'),
  readLocalCandidates: (basePath: string) =>
    invokeTauri('read_local_candidates', { basePath }),
  readGitCandidates: (repoUrl: string) =>
    invokeTauri('read_git_candidates', { repoUrl }),
};

// Analytics commands
export const analyticsCommands = {
  getAnalyticsData: () => invokeTauri('get_analytics_data'),
};

// Discovery commands
export const discoveryCommands = {
  discoverSkills: () => invokeTauri('discover_skills'),
};
