use super::discovery_config::{DiscoveryConfig, RecommendedSkill, SkillCategory};
use super::discovery_remote::{fetch_all_category_skills, DEFAULT_SKILLS_PER_CATEGORY};

/// 发现的 Skill 信息（简化版）
#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoveredSkill {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub tags: Vec<String>,
}

/// 技能分类信息
#[derive(Debug, Clone, serde::Serialize)]
pub struct CategoryInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub color: String,
}

impl From<SkillCategory> for CategoryInfo {
    fn from(cat: SkillCategory) -> Self {
        CategoryInfo {
            id: cat.id,
            name: cat.name,
            description: cat.description,
            icon: cat.icon,
            color: cat.color,
        }
    }
}

impl From<RecommendedSkill> for DiscoveredSkill {
    fn from(skill: RecommendedSkill) -> Self {
        DiscoveredSkill {
            name: skill.name,
            description: skill.description,
            github_url: skill.github_url,
            category: skill.category,
            tags: skill.tags,
        }
    }
}

/// 获取所有推荐的技能（混合本地和远程数据）
pub fn get_recommended_skills() -> Vec<DiscoveredSkill> {
    let config = DiscoveryConfig::get_default();
    let mut skills: Vec<DiscoveredSkill> = config
        .skills
        .into_iter()
        .map(DiscoveredSkill::from)
        .collect();
    
    // 尝试从远程获取更多技能
    if let Ok(remote_skills_map) = fetch_all_category_skills(DEFAULT_SKILLS_PER_CATEGORY) {
        for (category_id, remote_skills) in remote_skills_map {
            // 过滤掉已存在的技能（通过 github_url 去重）
            let existing_urls: std::collections::HashSet<&str> = skills
                .iter()
                .filter(|s| s.category == category_id)
                .map(|s| s.github_url.as_str())
                .collect();
            
            let new_skills: Vec<DiscoveredSkill> = remote_skills
                .into_iter()
                .filter(|remote| !existing_urls.contains(remote.github_url.as_str()))
                .map(|remote| DiscoveredSkill {
                    name: remote.name,
                    description: remote.description,
                    github_url: remote.github_url,
                    category: remote.category,
                    tags: remote.tags,
                })
                .collect();
            
            skills.extend(new_skills);
        }
    }
    
    skills
}

/// 获取所有分类
#[allow(dead_code)]
pub fn get_categories() -> Vec<CategoryInfo> {
    let config = DiscoveryConfig::get_default();
    config
        .categories
        .values()
        .cloned()
        .map(CategoryInfo::from)
        .collect()
}

/// 按分类获取技能
pub fn get_skills_by_category(category_id: &str) -> Vec<DiscoveredSkill> {
    let config = DiscoveryConfig::get_default();
    config
        .get_skills_by_category(category_id)
        .into_iter()
        .map(|skill| DiscoveredSkill::from(skill.clone()))
        .collect()
}

/// 搜索技能
pub fn search_skills(query: &str) -> Vec<DiscoveredSkill> {
    let config = DiscoveryConfig::get_default();
    config
        .search_skills(query)
        .into_iter()
        .map(|skill| DiscoveredSkill::from(skill.clone()))
        .collect()
}