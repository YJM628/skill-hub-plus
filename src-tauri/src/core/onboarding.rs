use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::Result;
use serde::Serialize;

use super::central_repo::resolve_central_repo_path;
use super::content_hash::hash_dir;
use super::skill_store::SkillStore;
use super::tool_adapters::{default_tool_adapters, scan_tool_dir, DetectedSkill, ToolAdapter};

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingVariant {
    pub tool: String,
    pub name: String,
    pub path: PathBuf,
    pub fingerprint: Option<String>,
    pub is_link: bool,
    pub link_target: Option<PathBuf>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingGroup {
    pub name: String,
    pub variants: Vec<OnboardingVariant>,
    pub has_conflict: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct OnboardingPlan {
    pub total_tools_scanned: usize,
    pub total_skills_found: usize,
    pub groups: Vec<OnboardingGroup>,
}

pub fn build_onboarding_plan<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &SkillStore,
) -> Result<OnboardingPlan> {
    let home =
        dirs::home_dir().ok_or_else(|| anyhow::anyhow!("failed to resolve home directory"))?;
    let central = resolve_central_repo_path(app, store)?;
    let managed_targets = store
        .list_all_skill_target_paths()
        .unwrap_or_default()
        .into_iter()
        .map(|(tool, path)| managed_target_key(&tool, Path::new(&path)))
        .collect::<std::collections::HashSet<_>>();
    
    // Get installed skill names to filter them out from discovery
    let installed_skill_names = store
        .list_skills()
        .unwrap_or_default()
        .into_iter()
        .map(|skill| skill.name)
        .collect::<std::collections::HashSet<_>>();
    
    build_onboarding_plan_in_home(&home, Some(&central), Some(&managed_targets), Some(&installed_skill_names))
}

fn build_onboarding_plan_in_home(
    home: &Path,
    exclude_root: Option<&Path>,
    exclude_managed_targets: Option<&std::collections::HashSet<String>>,
    installed_skill_names: Option<&std::collections::HashSet<String>>,
) -> Result<OnboardingPlan> {
    let adapters = default_tool_adapters();
    let mut all_detected: Vec<DetectedSkill> = Vec::new();
    let mut scanned = 0usize;
    
    // Track skills found in ~/.agents/skills to filter duplicates from other tools
    let mut agents_skills_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for adapter in &adapters {
        if !home.join(adapter.relative_detect_dir).exists() {
            continue;
        }
        scanned += 1;
        let dir = home.join(adapter.relative_skills_dir);
        let detected = scan_tool_dir(adapter, &dir)?;
        
        // Filter detected skills based on priority rules
        let filtered = filter_detected_with_priority(
            detected,
            exclude_root,
            exclude_managed_targets,
            adapter,
            &mut agents_skills_names,
            installed_skill_names,
        );
        
        all_detected.extend(filtered);
    }

    let mut grouped: HashMap<String, Vec<OnboardingVariant>> = HashMap::new();
    for skill in all_detected.iter() {
        let fingerprint = hash_dir(&skill.path).ok();
        let entry = grouped.entry(skill.name.clone()).or_default();
        entry.push(OnboardingVariant {
            tool: skill.tool.as_key().to_string(),
            name: skill.name.clone(),
            path: skill.path.clone(),
            fingerprint,
            is_link: skill.is_link,
            link_target: skill.link_target.clone(),
        });
    }

    let groups: Vec<OnboardingGroup> = grouped
        .into_iter()
        .map(|(name, variants)| {
            let mut uniq = variants
                .iter()
                .filter_map(|v| v.fingerprint.as_ref())
                .collect::<std::collections::HashSet<_>>()
                .len();
            if uniq == 0 {
                uniq = 1;
            }
            OnboardingGroup {
                name,
                has_conflict: uniq > 1,
                variants,
            }
        })
        .collect();

    Ok(OnboardingPlan {
        total_tools_scanned: scanned,
        total_skills_found: all_detected.len(),
        groups,
    })
}

// New function to filter skills with priority logic
fn filter_detected_with_priority(
    detected: Vec<DetectedSkill>,
    exclude_root: Option<&Path>,
    exclude_managed_targets: Option<&std::collections::HashSet<String>>,
    adapter: &ToolAdapter,
    agents_skills_names: &mut std::collections::HashSet<String>,
    installed_skill_names: Option<&std::collections::HashSet<String>>,
) -> Vec<DetectedSkill> {
    let is_agents_adapter = adapter.id.as_key() == "agents";
    
    // First, collect skill names from agents adapter
    if is_agents_adapter {
        for skill in &detected {
            agents_skills_names.insert(skill.name.clone());
        }
    }
    
    // Then filter the detected skills
    detected
        .into_iter()
        .filter(|skill| {
            // Apply existing filters
            if let Some(exclude_root) = exclude_root {
                if is_under(&skill.path, exclude_root) {
                    return false;
                }
                if let Some(target) = &skill.link_target {
                    if is_under(target, exclude_root) {
                        return false;
                    }
                }
            }
            if let Some(exclude) = exclude_managed_targets {
                if exclude.contains(&managed_target_key(skill.tool.as_key(), &skill.path)) {
                    return false;
                }
            }
            
            // Apply priority filter: if this is not the agents adapter and the skill name
            // already exists in ~/.agents/skills, filter it out
            if !is_agents_adapter && agents_skills_names.contains(&skill.name) {
                return false;
            }
            
            // Filter out already installed skills
            if let Some(installed) = installed_skill_names {
                if installed.contains(&skill.name) {
                    return false;
                }
            }
            
            true
        })
        .collect()
}

#[allow(dead_code)]
fn filter_detected(
    detected: Vec<DetectedSkill>,
    exclude_root: Option<&Path>,
    exclude_managed_targets: Option<&std::collections::HashSet<String>>,
) -> Vec<DetectedSkill> {
    if exclude_root.is_none() && exclude_managed_targets.is_none() {
        return detected;
    }
    detected
        .into_iter()
        .filter(|skill| {
            if let Some(exclude_root) = exclude_root {
                if is_under(&skill.path, exclude_root) {
                    return false;
                }
                if let Some(target) = &skill.link_target {
                    if is_under(target, exclude_root) {
                        return false;
                    }
                }
            }
            if let Some(exclude) = exclude_managed_targets {
                if exclude.contains(&managed_target_key(skill.tool.as_key(), &skill.path)) {
                    return false;
                }
            }
            true
        })
        .collect()
}

fn is_under(path: &Path, base: &Path) -> bool {
    path.starts_with(base)
}

fn managed_target_key(tool: &str, path: &Path) -> String {
    let tool = tool.to_ascii_lowercase();
    let normalized = normalize_path_for_key(path);
    format!("{tool}\n{normalized}")
}

fn normalize_path_for_key(path: &Path) -> String {
    let normalized: PathBuf = path.components().collect();
    let s = normalized.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        s.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        s
    }
}

#[cfg(test)]
#[path = "tests/onboarding.rs"]
mod tests;