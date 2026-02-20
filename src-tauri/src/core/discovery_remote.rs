use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use std::collections::HashMap;

/// skills.sh 热门技能列表（基于真实排行榜数据）
/// 格式：(仓库, 技能名, 分类, 描述)
const SKILLS_SH_POPULAR: &[(&str, &str, &str, &str)] = &[
    ("vercel-labs/skills", "find-skills", "productivity", "帮助发现和安装新技能"),
    ("vercel-labs/agent-skills", "vercel-react-best-practices", "development", "Vercel React 最佳实践"),
    ("vercel-labs/agent-skills", "web-design-guidelines", "development", "Web 设计指南"),
    ("remotion-dev/skills", "remotion-best-practices", "development", "Remotion 最佳实践"),
    ("anthropics/skills", "frontend-design", "development", "前端设计技能"),
    ("vercel-labs/agent-skills", "vercel-composition-patterns", "development", "Vercel 组合模式"),
    ("vercel-labs/agent-browser", "agent-browser", "productivity", "浏览器自动化代理"),
    ("anthropics/skills", "skill-creator", "productivity", "技能创建工具"),
    ("browser-use/browser-use", "browser-use", "productivity", "浏览器使用技能"),
    ("vercel-labs/agent-skills", "vercel-react-native-skills", "development", "React Native 技能"),
    ("nextlevelbuilder/ui-ux-pro-max-skill", "ui-ux-pro-max", "development", "UI/UX 设计专家"),
    ("squirrelscan/skills", "audit-website", "productivity", "网站审计工具"),
    ("obra/superpowers", "brainstorming", "productivity", "头脑风暴助手"),
    ("coreyhaines31/marketingskills", "seo-audit", "documentation", "SEO 审计"),
    ("supabase/agent-skills", "supabase-postgres-best-practices", "development", "Supabase Postgres 最佳实践"),
    ("anthropics/skills", "pdf", "documentation", "PDF 处理"),
    ("coreyhaines31/marketingskills", "copywriting", "documentation", "文案写作"),
    ("vercel-labs/next-skills", "next-best-practices", "development", "Next.js 最佳实践"),
    ("anthropics/skills", "pptx", "documentation", "PPT 处理"),
    ("better-auth/skills", "better-auth-best-practices", "development", "Better Auth 最佳实践"),
];

/// GitHub topic 到分类的映射（备用方案）
pub const CATEGORY_TOPICS: &[(&str, &str)] = &[
    ("development", "topic:claude-skill topic:development"),
    ("productivity", "topic:claude-skill topic:productivity"),
    ("ai", "topic:claude-skill topic:ai topic:assistant"),
    ("documentation", "topic:claude-skill topic:documentation topic:docs"),
];

/// 每个分类默认拉取的技能数量
pub const DEFAULT_SKILLS_PER_CATEGORY: usize = 10;

#[derive(Debug, Deserialize)]
struct SearchResponse {
    items: Vec<RepoItem>,
}

#[derive(Debug, Deserialize)]
struct RepoItem {
    full_name: String,
    html_url: String,
    description: Option<String>,
    topics: Vec<String>,
}

/// 远程发现的技能
#[derive(Debug, Clone)]
pub struct RemoteDiscoveredSkill {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub tags: Vec<String>,
}

/// 从 skills.sh 热门列表按分类获取技能
pub fn fetch_skills_by_category(
    category_id: &str,
    limit: usize,
) -> Result<Vec<RemoteDiscoveredSkill>> {
    // 优先使用 skills.sh 的热门技能列表
    let skills_from_list = fetch_skills_from_popular_list(category_id, limit)?;
    
    // 如果热门列表中的技能数量不足，补充 GitHub 搜索结果
    if skills_from_list.len() < limit {
        let remaining = limit - skills_from_list.len();
        let topic_query = CATEGORY_TOPICS
            .iter()
            .find(|(cat, _)| *cat == category_id)
            .map(|(_, query)| *query)
            .unwrap_or("topic:claude-skill");
        
        let mut github_skills = fetch_github_skills(topic_query, category_id, remaining)?;
        
        // 合并结果，去重（避免重复）
        let existing_repos: std::collections::HashSet<String> = skills_from_list
            .iter()
            .map(|s| s.github_url.clone())
            .collect();
        
        github_skills.retain(|s| !existing_repos.contains(&s.github_url));
        
        let mut result = skills_from_list;
        result.extend(github_skills);
        Ok(result)
    } else {
        Ok(skills_from_list)
    }
}

/// 从 skills.sh 热门列表获取技能
fn fetch_skills_from_popular_list(
    category_id: &str,
    limit: usize,
) -> Result<Vec<RemoteDiscoveredSkill>> {
    let skills: Vec<RemoteDiscoveredSkill> = SKILLS_SH_POPULAR
        .iter()
        .filter(|(_, _, cat, _)| *cat == category_id)
        .take(limit)
        .map(|(repo, name, _, desc)| {
            let github_url = format!("https://github.com/{}", repo);
            RemoteDiscoveredSkill {
                name: name.to_string(),
                description: desc.to_string(),
                github_url,
                category: category_id.to_string(),
                tags: vec!["skills.sh".to_string(), "popular".to_string()],
            }
        })
        .collect();
    
    Ok(skills)
}

/// 获取所有分类的技能
pub fn fetch_all_category_skills(
    limit_per_category: usize,
) -> Result<HashMap<String, Vec<RemoteDiscoveredSkill>>> {
    let mut result = HashMap::new();
    
    for (category_id, _) in CATEGORY_TOPICS {
        let skills = fetch_skills_by_category(category_id, limit_per_category)?;
        result.insert(category_id.to_string(), skills);
    }
    
    Ok(result)
}

/// 从 GitHub 搜索技能仓库
fn fetch_github_skills(
    query: &str,
    category: &str,
    limit: usize,
) -> Result<Vec<RemoteDiscoveredSkill>> {
    let client = Client::new();
    let url = format!(
        "https://api.github.com/search/repositories?q={}&per_page={}&sort=stars&order=desc",
        urlencoding::encode(query),
        limit.clamp(1, 100)
    );

    let response = client
        .get(&url)
        .header("User-Agent", "skills-hub")
        .send()
        .context("GitHub search request failed")?
        .error_for_status()
        .context("GitHub search returned error")?;

    let search_result: SearchResponse = response
        .json()
        .context("Failed to parse GitHub response")?;

    // 转换为技能列表并直接返回（不进行后端验证）
    Ok(search_result
        .items
        .into_iter()
        .map(|item| {
            let topics: Vec<String> = item
                .topics
                .into_iter()
                .filter(|t| !t.is_empty())
                .collect();
            
            RemoteDiscoveredSkill {
                name: item.full_name.split('/').last().unwrap_or(&item.full_name).to_string(),
                description: item.description.unwrap_or_else(|| "No description".to_string()),
                github_url: item.html_url,
                category: category.to_string(),
                tags: topics,
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fetch_skills_by_category() {
        let result = fetch_skills_by_category("development", 5);
        assert!(result.is_ok());
        let skills = result.unwrap();
        assert!(skills.len() <= 5);
    }
}
