use crate::core::skill_store::SkillStore;
use crate::core::discovery::{get_recommended_skills, get_skills_by_category as get_skills_by_category_core, search_skills as search_skills_core};
use crate::core::discovery_remote::{fetch_skills_by_category, DEFAULT_SKILLS_PER_CATEGORY};
use serde::Serialize;
use tauri::State;
use super::format_anyhow_error;

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