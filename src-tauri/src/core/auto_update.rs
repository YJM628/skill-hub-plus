use anyhow::Result;

use crate::core::installer::update_managed_skill_from_source;
use crate::core::skill_store::SkillStore;

/// Check for updates to Git skills if auto-update is enabled
/// This function should be called periodically (e.g., on app startup)
pub fn check_auto_updates<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &SkillStore,
) -> Result<Vec<String>> {
    // Check if auto-update is enabled
    let auto_update_enabled = store.get_auto_update_enabled()?;
    if !auto_update_enabled {
        log::info!("[auto_update] Auto-update is disabled, skipping");
        return Ok(vec![]);
    }

    // Get all Git skills
    let all_skills = store.list_skills()?;
    let git_skills: Vec<_> = all_skills
        .into_iter()
        .filter(|skill| skill.source_type == "git")
        .collect();

    if git_skills.is_empty() {
        log::info!("[auto_update] No Git skills to update");
        return Ok(vec![]);
    }

    log::info!(
        "[auto_update] Checking updates for {} Git skills",
        git_skills.len()
    );

    let mut updated_skills = Vec::new();
    let mut failed_skills = Vec::new();

    for skill in git_skills {
        let skill_name = skill.name.clone();
        let skill_id = skill.id.clone();

        log::info!("[auto_update] Checking update for skill: {}", skill_name);

        match update_managed_skill_from_source(app, store, &skill_id) {
            Ok(result) => {
                log::info!(
                    "[auto_update] Successfully updated skill: {} (updated {} targets)",
                    skill_name,
                    result.updated_targets.len()
                );
                updated_skills.push(skill_name);
            }
            Err(err) => {
                log::warn!(
                    "[auto_update] Failed to update skill {}: {}",
                    skill_name,
                    err
                );
                failed_skills.push(skill_name);
            }
        }
    }

    if !updated_skills.is_empty() {
        log::info!(
            "[auto_update] Auto-update completed: {} skills updated, {} failed",
            updated_skills.len(),
            failed_skills.len()
        );
    }

    Ok(updated_skills)
}