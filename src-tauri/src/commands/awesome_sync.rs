// Awesome Claude Skills sync commands
use tauri::State;
use serde::Serialize;
use anyhow::Context;

#[tauri::command]
pub async fn sync_awesome_claude_skills(
    store: State<'_, crate::core::skill_store::SkillStore>,
) -> Result<SyncAwesomeSkillsResult, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sync_awesome_claude_skills_impl(&store)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(format_anyhow_error)
}

#[derive(Debug, Serialize)]
pub struct SyncAwesomeSkillsResult {
    pub total_synced: usize,
    pub source: String,
}

fn sync_awesome_claude_skills_impl(store: &crate::core::skill_store::SkillStore) -> Result<SyncAwesomeSkillsResult, anyhow::Error> {
    use crate::core::discovery_parser::{parse_awesome_skills_readme, skills_to_records};
    
    // Check if we already have data in the database
    let existing_skills = store.list_discovered_skills()
        .context("Failed to check existing skills")?;
    
    // If we have data, return early without fetching from network
    if !existing_skills.is_empty() {
        return Ok(SyncAwesomeSkillsResult {
            total_synced: existing_skills.len(),
            source: "awesome-claude-skills (cached)".to_string(),
        });
    }
    
    // Only fetch from network if database is empty
    let url = "https://raw.githubusercontent.com/BehiSecc/awesome-claude-skills/main/README.md";
    
    println!("Fetching README from {} (database is empty)...", url);
    
    let response = reqwest::blocking::get(url)
        .with_context(|| format!("Failed to fetch README from {}", url))?;
    
    if !response.status().is_success() {
        anyhow::bail!("Failed to fetch README: HTTP {}", response.status());
    }
    
    let content = response.text()
        .context("Failed to read response body")?;
    
    println!("README fetched, parsing...");
    
    // Parse README
    let parsed_skills = parse_awesome_skills_readme(&content)
        .context("Failed to parse README")?;
    
    let total = parsed_skills.len();
    println!("Parsed {} skills from README", total);
    
    // Convert to database records
    let records = skills_to_records(parsed_skills, "awesome-claude-skills");
    
    // Clear existing skills from this source
    store.clear_discovered_skills()
        .context("Failed to clear existing skills")?;
    
    // Insert new skills
    for record in &records {
        store.upsert_discovered_skill(record)
            .with_context(|| format!("Failed to insert skill: {}", record.name))?;
    }
    
    println!("Successfully synced {} skills to database", total);
    
    Ok(SyncAwesomeSkillsResult {
        total_synced: total,
        source: "awesome-claude-skills".to_string(),
    })
}

#[tauri::command]
pub async fn fetch_discovered_skills_from_db(
    store: State<'_, crate::core::skill_store::SkillStore>,
) -> Result<Vec<DiscoveredSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skills = store.list_discovered_skills()?;
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags.split(',').map(|t: &str| t.trim().to_string()).collect(),
                })
                .collect(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn fetch_discovered_skills_by_category_from_db(
    store: State<'_, crate::core::skill_store::SkillStore>,
    category: String,
) -> Result<Vec<DiscoveredSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skills = store.list_discovered_skills_by_category(&category)?;
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags.split(',').map(|t: &str| t.trim().to_string()).collect(),
                })
                .collect(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn search_discovered_skills_from_db(
    store: State<'_, crate::core::skill_store::SkillStore>,
    query: String,
) -> Result<Vec<DiscoveredSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skills = store.search_discovered_skills(&query)?;
        Ok::<_, anyhow::Error>(
            skills
                .into_iter()
                .map(|s| DiscoveredSkillDto {
                    name: s.name,
                    description: s.description,
                    github_url: s.github_url,
                    category: s.category,
                    tags: s.tags.split(',').map(|t: &str| t.trim().to_string()).collect(),
                })
                .collect(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(format_anyhow_error)
}

#[derive(Debug, Serialize)]
pub struct DiscoveredSkillDto {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub tags: Vec<String>,
}

fn format_anyhow_error(err: anyhow::Error) -> String {
    err.to_string()
}
