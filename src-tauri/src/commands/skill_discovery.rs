use crate::core::skill_store::SkillStore;
use crate::core::discovery::{get_recommended_skills, get_skills_by_category as get_skills_by_category_core, search_skills as search_skills_core};
use crate::core::discovery_remote::{fetch_skills_by_category, DEFAULT_SKILLS_PER_CATEGORY};
use crate::core::tool_adapters::{DetectedSkill, ToolAdapter, ToolId, default_tool_adapters, resolve_default_path, scan_tool_dir};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;
use super::format_anyhow_error;
use anyhow::Context;

#[derive(Debug, Serialize)]
pub struct DiscoveredSkillDto {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct CategoryInfoDto {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize)]
pub struct PaginatedSkillsDto {
    pub skills: Vec<DiscoveredSkillDto>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub current_page: u32,
    pub page_size: u32,
    pub total_items: u32,
    pub total_pages: u32,
}

#[tauri::command]
pub async fn fetch_discovered_skills() -> Result<Vec<DiscoveredSkillDto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let skills = get_recommended_skills();
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags,
                })
                .collect(),
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn get_categories(store: State<'_, SkillStore>) -> Result<Vec<CategoryInfoDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let categories = store.list_categories()?;
        Ok::<_, anyhow::Error>(
            categories
                .into_iter()
                .map(|c| CategoryInfoDto {
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    icon: c.icon,
                    color: c.color,
                })
                .collect(),
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn get_skills_by_category(category_id: String) -> Result<Vec<DiscoveredSkillDto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let skills = get_skills_by_category_core(&category_id);
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags,
                })
                .collect(),
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn search_skills(query: String) -> Result<Vec<DiscoveredSkillDto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let skills = search_skills_core(&query);
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags,
                })
                .collect(),
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn fetch_skills_by_category_with_pagination(
    categoryId: String,
    page: Option<u32>,
    pageSize: Option<u32>,
) -> Result<PaginatedSkillsDto, String> {
    let page = page.unwrap_or(1);
    let page_size = pageSize.unwrap_or(10);
    
    tauri::async_runtime::spawn_blocking(move || {
        // 获取该分类的所有技能（从远程）
        let all_skills = fetch_skills_by_category(&categoryId, DEFAULT_SKILLS_PER_CATEGORY)?;
        
        // 计算分页
        let total = all_skills.len() as u32;
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;
        let page = page.min(total_pages.max(1));
        
        let start_index = ((page - 1) * page_size) as usize;
        let _end_index = (start_index + page_size as usize).min(all_skills.len());
        
        let paginated_skills: Vec<DiscoveredSkillDto> = all_skills
            .into_iter()
            .skip(start_index)
            .take(page_size as usize)
            .map(|s| DiscoveredSkillDto {
                name: s.name,
                description: s.description,
                github_url: s.github_url,
                category: s.category,
                tags: s.tags,
            })
            .collect();
        
        Ok::<_, anyhow::Error>(PaginatedSkillsDto {
            skills: paginated_skills,
            pagination: PaginationInfo {
                current_page: page,
                page_size: page_size,
                total_items: total,
                total_pages,
            },
        })
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

// New command to scan custom paths for new skills
#[derive(Debug, Serialize)]
pub struct LocalDiscoveredSkillDto {
    pub name: String,
    pub path: String,
    pub tool: String,
    pub is_link: bool,
}

#[tauri::command]
pub async fn scan_for_new_skills(
    store: State<'_, SkillStore>,
    _installed_skill_ids: Vec<String>,
) -> Result<Vec<LocalDiscoveredSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Get installed skill names for filtering
        let installed_skills = store.list_skills()?;
        let installed_names: std::collections::HashSet<String> = installed_skills
            .into_iter()
            .map(|s| s.name)
            .collect();
        
        let mut new_skills: Vec<LocalDiscoveredSkillDto> = Vec::new();
        let mut scanned_paths: std::collections::HashSet<String> = std::collections::HashSet::new();
        
        // 1. Scan default tool adapter paths (e.g. ~/.claude/skills, ~/.cursor/skills, etc.)
        for adapter in default_tool_adapters() {
            if let Ok(default_path) = resolve_default_path(&adapter) {
                if !default_path.exists() || !default_path.is_dir() {
                    continue;
                }
                let path_str = default_path.to_string_lossy().to_string();
                if !scanned_paths.insert(path_str) {
                    continue; // Skip duplicate paths (e.g. Amp and Kimi CLI share the same dir)
                }
                if let Ok(detected) = scan_tool_dir(&adapter, &default_path) {
                    for skill in detected {
                        if !installed_names.contains(&skill.name) {
                            new_skills.push(LocalDiscoveredSkillDto {
                                name: skill.name,
                                path: skill.path.to_string_lossy().to_string(),
                                tool: skill.tool.as_key().to_string(),
                                is_link: skill.is_link,
                            });
                        }
                    }
                }
            }
        }
        
        // 2. Scan custom scan paths added by user
        let scan_paths = store.list_scan_paths()?;
        for scan_path in scan_paths {
            let path = PathBuf::from(&scan_path);
            if !path.exists() || !path.is_dir() {
                continue;
            }
            let path_str = path.to_string_lossy().to_string();
            if !scanned_paths.insert(path_str) {
                continue; // Skip if already scanned as a default path
            }
            
            let adapter = ToolAdapter {
                id: ToolId::Agents,
                display_name: "Custom Scan Path",
                relative_skills_dir: "",
                relative_detect_dir: "",
            };
            
            if let Ok(detected) = scan_custom_path(&adapter, &path) {
                for skill in detected {
                    if !installed_names.contains(&skill.name) {
                        new_skills.push(LocalDiscoveredSkillDto {
                            name: skill.name,
                            path: skill.path.to_string_lossy().to_string(),
                            tool: skill.tool.as_key().to_string(),
                            is_link: skill.is_link,
                        });
                    }
                }
            }
        }
        
        Ok::<_, anyhow::Error>(new_skills)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

// Helper function to scan a custom path for skills
fn scan_custom_path(tool: &ToolAdapter, dir: &Path) -> Result<Vec<DetectedSkill>, anyhow::Error> {
    let mut results = Vec::new();
    if !dir.exists() {
        return Ok(results);
    }

    for entry in std::fs::read_dir(dir).with_context(|| format!("read dir {:?}", dir))? {
        let entry: std::fs::DirEntry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        let is_dir = file_type.is_dir() || (file_type.is_symlink() && path.is_dir());
        if !is_dir {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        
        // Check if this is a valid skill directory (contains SKILL.md or similar)
        let skill_file = path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }
        
        let (is_link, link_target) = detect_link(&path);
        results.push(DetectedSkill {
            tool: tool.id.clone(),
            name,
            path,
            is_link,
            link_target,
        });
    }

    Ok(results)
}

fn detect_link(path: &Path) -> (bool, Option<PathBuf>) {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            let target = std::fs::read_link(path).ok();
            (true, target)
        }
        _ => {
            let target = std::fs::read_link(path).ok();
            if target.is_some() {
                (true, target)
            } else {
                (false, None)
            }
        }
    }
}