use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 推荐的技能配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedSkill {
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub tags: Vec<String>,
}

/// 技能分类配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillCategory {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub color: String,
}

/// 发现配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryConfig {
    pub categories: HashMap<String, SkillCategory>,
    pub skills: Vec<RecommendedSkill>,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        let mut categories = HashMap::new();
        
        categories.insert(
            "development".to_string(),
            SkillCategory {
                id: "development".to_string(),
                name: "开发工具".to_string(),
                description: "提升开发效率的工具和技能".to_string(),
                icon: "💻".to_string(),
                color: "#3b82f6".to_string(),
            },
        );
        
        categories.insert(
            "productivity".to_string(),
            SkillCategory {
                id: "productivity".to_string(),
                name: "生产力".to_string(),
                description: "提高工作效率的技能".to_string(),
                icon: "⚡".to_string(),
                color: "#f59e0b".to_string(),
            },
        );
        
        categories.insert(
            "ai".to_string(),
            SkillCategory {
                id: "ai".to_string(),
                name: "AI 辅助".to_string(),
                description: "AI 相关的技能和工具".to_string(),
                icon: "🤖".to_string(),
                color: "#8b5cf6".to_string(),
            },
        );
        
        categories.insert(
            "documentation".to_string(),
            SkillCategory {
                id: "documentation".to_string(),
                name: "文档".to_string(),
                description: "文档编写和管理技能".to_string(),
                icon: "📚".to_string(),
                color: "#10b981".to_string(),
            },
        );

        let skills = vec![
            // 开发工具
            RecommendedSkill {
                name: "Git Worktree Manager".to_string(),
                description: "管理 Git 工作树，支持并行开发多个分支".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "development".to_string(),
                tags: vec!["git".to_string(), "workflow".to_string()],
            },
            RecommendedSkill {
                name: "Code Review Assistant".to_string(),
                description: "辅助代码审查，提供代码质量建议".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "development".to_string(),
                tags: vec!["review".to_string(), "quality".to_string()],
            },
            
            // 生产力
            RecommendedSkill {
                name: "Task Planner".to_string(),
                description: "任务规划和分解，帮助制定详细的实施计划".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "productivity".to_string(),
                tags: vec!["planning".to_string(), "productivity".to_string()],
            },
            RecommendedSkill {
                name: "Brainstorming Helper".to_string(),
                description: "创意头脑风暴，帮助探索用户意图和需求".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "productivity".to_string(),
                tags: vec!["brainstorm".to_string(), "ideas".to_string()],
            },
            
            // AI 辅助
            RecommendedSkill {
                name: "AI Prompt Optimizer".to_string(),
                description: "优化 AI 提示词，提升 AI 响应质量".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "ai".to_string(),
                tags: vec!["ai".to_string(), "prompt".to_string()],
            },
            
            // 文档
            RecommendedSkill {
                name: "Documentation Generator".to_string(),
                description: "自动生成项目文档和 API 文档".to_string(),
                github_url: "https://github.com/anthropics/claude-code-skills".to_string(),
                category: "documentation".to_string(),
                tags: vec!["docs".to_string(), "generator".to_string()],
            },
        ];

        DiscoveryConfig {
            categories,
            skills,
        }
    }
}

impl DiscoveryConfig {
    /// 获取默认配置
    pub fn get_default() -> Self {
        Self::default()
    }
    
    /// 按分类获取技能
    pub fn get_skills_by_category(&self, category_id: &str) -> Vec<&RecommendedSkill> {
        self.skills
            .iter()
            .filter(|skill| skill.category == category_id)
            .collect()
    }
    
    /// 搜索技能
    pub fn search_skills(&self, query: &str) -> Vec<&RecommendedSkill> {
        let query_lower = query.to_lowercase();
        self.skills
            .iter()
            .filter(|skill| {
                skill.name.to_lowercase().contains(&query_lower)
                    || skill.description.to_lowercase().contains(&query_lower)
                    || skill.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            })
            .collect()
    }
}
