use anyhow::{Context, Result};
use regex::Regex;
use uuid::Uuid;

use super::skill_store::DiscoveredSkillRecord;

#[derive(Debug, Clone)]
pub struct ParsedSkill {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
}

/// Parse awesome-claude-skills README.md content
pub fn parse_awesome_skills_readme(content: &str) -> Result<Vec<ParsedSkill>> {
    let mut skills = Vec::new();
    let mut current_category = String::new();
    
    // Regex to match skill entries: - [name](url) - description
    let skill_regex = Regex::new(r"^-\s+\[([^\]]+)\]\(([^)]+)\)\s+-\s+(.+)$")
        .context("Failed to compile skill regex")?;
    
    // Regex to match category headers: ## 🔧 Category Name
    let category_regex = Regex::new(r"^##\s+[^\s]+\s+(.+)$")
        .context("Failed to compile category regex")?;
    
    for line in content.lines() {
        let trimmed = line.trim();
        
        // Check if this is a category header
        if let Some(caps) = category_regex.captures(trimmed) {
            current_category = caps.get(1)
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_default();
            continue;
        }
        
        // Check if this is a skill entry
        if let Some(caps) = skill_regex.captures(trimmed) {
            let name = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            let url = caps.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            let description = caps.get(3).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            
            // Skip if any field is empty or if it's not a GitHub URL
            if name.is_empty() || url.is_empty() || description.is_empty() {
                continue;
            }
            
            if !url.starts_with("https://github.com/") {
                continue;
            }
            
            skills.push(ParsedSkill {
                name,
                description,
                github_url: url,
                category: current_category.clone(),
            });
        }
    }
    
    Ok(skills)
}

/// Convert parsed skills to database records
pub fn skills_to_records(skills: Vec<ParsedSkill>, source: &str) -> Vec<DiscoveredSkillRecord> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    
    skills
        .into_iter()
        .map(|skill| {
            // Generate a deterministic ID based on github_url
            let id = Uuid::new_v5(&Uuid::NAMESPACE_URL, skill.github_url.as_bytes()).to_string();
            
            // Extract tags from category
            let tags = skill.category.clone();
            
            DiscoveredSkillRecord {
                id,
                name: skill.name,
                description: skill.description,
                github_url: skill.github_url,
                category: normalize_category(&skill.category),
                source: source.to_string(),
                tags,
                created_at: now,
                updated_at: now,
            }
        })
        .collect()
}

/// Normalize category names to match existing categories
fn normalize_category(category: &str) -> String {
    let lower = category.to_lowercase();
    
    // Map to existing category IDs
    if lower.contains("document") {
        "document".to_string()
    } else if lower.contains("development") || lower.contains("code") {
        "development".to_string()
    } else if lower.contains("data") || lower.contains("analysis") {
        "data-analysis".to_string()
    } else if lower.contains("scientific") || lower.contains("research") {
        "research".to_string()
    } else if lower.contains("writing") {
        "writing".to_string()
    } else if lower.contains("learning") || lower.contains("knowledge") {
        "learning".to_string()
    } else if lower.contains("media") || lower.contains("content") {
        "media".to_string()
    } else if lower.contains("health") {
        "health".to_string()
    } else if lower.contains("collaboration") || lower.contains("project") {
        "collaboration".to_string()
    } else if lower.contains("security") || lower.contains("testing") {
        "security".to_string()
    } else if lower.contains("utility") || lower.contains("automation") {
        "utility".to_string()
    } else if lower.contains("collection") {
        "collections".to_string()
    } else {
        "other".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_readme() {
        let content = r#"
# Awesome Claude Skills

## 📄 Document Skills
- [docx](https://github.com/anthropics/skills/tree/main/skills/docx) - Create, edit, analyze Word docs with tracked changes, comments, formatting.
- [pdf](https://github.com/anthropics/skills/tree/main/skills/pdf) - Extract text, tables, metadata, merge & annotate PDFs.

## 🔧 Development & Code Tools
- [web-artifacts-builder](https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder) - Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts.
"#;

        let skills = parse_awesome_skills_readme(content).unwrap();
        assert_eq!(skills.len(), 3);
        
        assert_eq!(skills[0].name, "docx");
        assert_eq!(skills[0].category, "Document Skills");
        assert!(skills[0].github_url.contains("github.com"));
        
        assert_eq!(skills[2].name, "web-artifacts-builder");
        assert_eq!(skills[2].category, "Development & Code Tools");
    }

    #[test]
    fn test_normalize_category() {
        assert_eq!(normalize_category("Document Skills"), "document");
        assert_eq!(normalize_category("Development & Code Tools"), "development");
        assert_eq!(normalize_category("Data & Analysis"), "data-analysis");
        assert_eq!(normalize_category("Unknown Category"), "other");
    }
}
