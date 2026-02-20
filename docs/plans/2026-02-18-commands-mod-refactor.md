# Commands Mod.rs Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 将 `src-tauri/src/commands/mod.rs` (1634行, 52KB) 按功能域拆分为多个模块文件,提高代码可维护性和可读性。

**Architecture:** 按功能域将命令分组到独立模块中,每个模块包含相关的 Tauri 命令和 DTO 结构体。主 mod.rs 仅保留模块重导出。

**Tech Stack:** Rust, Tauri 2.x

---

## Context

### Current Issues

1. **单文件过大**: `commands/mod.rs` 包含 40+ 个命令,1634 行代码,52KB
2. **职责不清晰**: 多个功能域混合在同一个文件中
3. **可维护性差**: 修改某个功能需要遍历大文件
4. **测试困难**: 所有命令在一个文件中,单元测试不清晰

### Command Groups Analysis

根据代码中的注释和功能分析,可分为以下功能模块:

1. **Configuration** - 配置相关命令
2. **LocalInstallation** - 本地技能安装
3. **GitInstallation** - Git 仓库技能安装
4. **SkillSync** - 技能同步管理
5. **SkillManagement** - 技能管理(导入、删除、更新)
6. **SkillDiscovery** - 技能发现和搜索
7. **ScanPaths** - 扫描路径管理
8. **Categories** - 分类管理
9. **SkillFiles** - 技能文件操作
10. **Analytics** - 分析统计
11. **AwesomeClaudeSync** - Awesome Claude Skills 同步
12. **FileOperations** - 文件操作(保存对话框)
13. **AiAgents** - AI Agent 配置

### Target Structure

```
src-tauri/src/commands/
├── mod.rs                    # 主模块,重导出所有子模块
├── config.rs                 # 配置命令
├── local_install.rs          # 本地安装命令
├── git_install.rs            # Git 安装命令
├── skill_sync.rs             # 技能同步命令
├── skill_management.rs       # 技能管理命令
├── skill_discovery.rs        # 技能发现命令
├── scan_paths.rs             # 扫描路径命令
├── categories.rs             # 分类命令
├── skill_files.rs            # 技能文件命令
├── analytics.rs              # 分析命令
├── awesome_sync.rs           # Awesome 同步命令
├── file_operations.rs        # 文件操作命令
├── ai_agents.rs              # AI Agent 命令
└── tests/
    └── commands.rs           # 集成测试
```

---

## Implementation Plan

### Task 1: 创建配置模块 (config.rs)

**Files:**
- Create: `src-tauri/src/commands/config.rs`
- Modify: `src-tauri/src/commands/mod.rs`

**Step 1: 创建 config.rs 文件**

```rust
use crate::core::skill_store::SkillStore;
use tauri::State;

// Configuration commands
#[tauri::command]
pub fn get_central_repo_path(store: State<'_, SkillStore>) -> Result<String, String> {
    let store = store.inner().clone();
    store.get_central_repo_path().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_central_repo_path(
    store: State<'_, SkillStore>,
    path: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.set_central_repo_path(&path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_tool_status(store: State<'_, SkillStore>) -> Result<ToolStatusDto, String> {
    let store = store.inner().clone();
    get_tool_status_impl(store.inner())
}

#[tauri::command]
pub fn get_git_cache_cleanup_days(store: State<'_, SkillStore>) -> Result<i64, String> {
    let store = store.inner().clone();
    store.get_git_cache_cleanup_days().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_git_cache_ttl_secs(store: State<'_, SkillStore>) -> Result<i64, String> {
    let store = store.inner().clone();
    store.get_git_cache_ttl_secs().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_git_cache_cleanup_days(
    store: State<'_, SkillStore>,
    days: i64,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.set_git_cache_cleanup_days(days).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_git_cache_ttl_secs(
    store: State<'_, SkillStore>,
    secs: i64,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.set_git_cache_ttl_secs(secs).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn clear_git_cache_now(store: State<'_, SkillStore>) -> Result<usize, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let cleanup_days = store.get_git_cache_cleanup_days()?;
        let max_age = std::time::Duration::from_secs(cleanup_days as u64 * 24 * 60 * 60);
        let removed = crate::core::cache_cleanup::cleanup_git_cache_dirs(&store.handle, max_age)?;
        Ok::<_, anyhow::Error>(removed)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub fn get_auto_update_enabled(store: State<'_, SkillStore>) -> Result<bool, String> {
    let store = store.inner().clone();
    store.get_auto_update_enabled().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_auto_update_enabled(
    store: State<'_, SkillStore>,
    enabled: bool,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.set_auto_update_enabled(enabled).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_onboarding_plan(store: State<'_, SkillStore>) -> Result<OnboardingPlanDto, String> {
    let store = store.inner().clone();
    get_onboarding_plan_impl(store.inner())
}

// DTOs
#[derive(Debug, Serialize)]
pub struct ToolStatusDto {
    pub tool_path: String,
    pub tool_exists: bool,
    pub tool_version: Option<String>,
    pub central_repo_path: String,
    pub central_repo_exists: bool,
}

#[derive(Debug, Serialize)]
pub struct OnboardingPlanDto {
    pub steps: Vec<OnboardingStepDto>,
}

#[derive(Debug, Serialize)]
pub struct OnboardingStepDto {
    pub id: String,
    pub title: String,
    pub description: String,
    pub completed: bool,
    pub action_type: String,
}

// Helper functions
fn get_tool_status_impl(store: &SkillStore) -> Result<ToolStatusDto, String> {
    let tool_path = store.get_tool_path()?;
    let tool_exists = std::path::Path::new(&tool_path).exists();
    let tool_version = if tool_exists {
        Some(crate::core::version::get_tool_version(&tool_path)?)
    } else {
        None
    };
    let central_repo_path = store.get_central_repo_path()?;
    let central_repo_exists = std::path::Path::new(&central_repo_path).exists();
    
    Ok(ToolStatusDto {
        tool_path,
        tool_exists,
        tool_version,
        central_repo_path,
        central_repo_exists,
    })
}

fn get_onboarding_plan_impl(store: &SkillStore) -> Result<OnboardingPlanDto, String> {
    let tool_status = get_tool_status_impl(store)?;
    let scan_paths = store.list_scan_paths()?;
    
    let steps = vec![
        OnboardingStepDto {
            id: "install_tool".to_string(),
            title: "Install Claude Tool".to_string(),
            description: "Download and configure the Claude Desktop tool".to_string(),
            completed: tool_status.tool_exists,
            action_type: "download".to_string(),
        },
        OnboardingStepDto {
            id: "set_central_repo".to_string(),
            title: "Set Central Repository".to_string(),
            description: "Configure a central directory for all your skills".to_string(),
            completed: tool_status.central_repo_exists,
            action_type: "folder".to_string(),
        },
        OnboardingStepDto {
            id: "add_scan_path".to_string(),
            title: "Add Scan Path".to_string(),
            description: "Add a directory to scan for existing skills".to_string(),
            completed: !scan_paths.is_empty(),
            action_type: "folder".to_string(),
        },
    ];
    
    Ok(OnboardingPlanDto { steps })
}

fn format_anyhow_error(err: anyhow::Error) -> String {
    err.to_string()
}
```

**Step 2: 修改 mod.rs,添加 config 模块声明并移除相关代码**

在 mod.rs 顶部添加:
```rust
pub mod config;
```

删除 mod.rs 中从第 1 行到所有配置相关的代码块(包括 get_central_repo_path, set_central_repo_path, get_tool_status, get_git_cache_cleanup_days, get_git_cache_ttl_secs, set_git_cache_cleanup_days, set_git_cache_ttl_secs, clear_git_cache_now, get_auto_update_enabled, set_auto_update_enabled, get_onboarding_plan 命令及其相关 DTO 和辅助函数)

**Step 3: 更新 lib.rs 中的 invoke_handler**

修改 `src-tauri/src/lib.rs` 中的 invoke_handler,将配置命令改为:
```rust
commands::config::get_central_repo_path,
commands::config::set_central_repo_path,
commands::config::get_tool_status,
commands::config::get_git_cache_cleanup_days,
commands::config::get_git_cache_ttl_secs,
commands::config::set_git_cache_cleanup_days,
commands::config::set_git_cache_ttl_secs,
commands::config::clear_git_cache_now,
commands::config::get_auto_update_enabled,
commands::config::set_auto_update_enabled,
commands::config::get_onboarding_plan,
```

**Step 4: 运行编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS (无编译错误)

**Step 5: 提交**

```bash
git add src-tauri/src/commands/config.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "refactor(commands): extract config module from mod.rs"
```

---

### Task 2: 创建本地安装模块 (local_install.rs)

**Files:**
- Create: `src-tauri/src/commands/local_install.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 local_install.rs 文件**

```rust
use crate::core::skill_store::SkillStore;
use serde::Serialize;
use tauri::{AppHandle, State};

// Local installation commands
#[tauri::command]
pub async fn install_local(
    app: AppHandle,
    store: State<'_, SkillStore>,
    sourcePath: String,
) -> Result<InstallResultDto, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        install_local_impl(&app, &store, &sourcePath)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn list_local_skills_cmd(
    app: AppHandle,
    store: State<'_, SkillStore>,
    sourcePath: String,
) -> Result<Vec<LocalSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        list_local_skills_impl(&app, &store, &sourcePath)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn install_local_selection(
    app: AppHandle,
    store: State<'_, SkillStore>,
    sourcePath: String,
    selectedSkills: Vec<String>,
) -> Result<Vec<InstallResultDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        install_local_selection_impl(&app, &store, &sourcePath, &selectedSkills)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

// DTOs
#[derive(Debug, Serialize)]
pub struct InstallResultDto {
    pub skill_id: String,
    pub skill_name: String,
    pub central_path: String,
    pub target_path: String,
}

#[derive(Debug, Serialize)]
pub struct LocalSkillDto {
    pub name: String,
    pub path: String,
    pub has_skill_md: bool,
    pub is_installed: bool,
}

// Helper functions
fn install_local_impl(
    app: &AppHandle,
    store: &SkillStore,
    source_path: &str,
) -> Result<InstallResultDto, anyhow::Error> {
    let (name, description) = crate::core::installer::parse_skill_md(source_path)?;
    let skill_id = store.add_skill(&name, &description, source_path)?;
    
    let central_path = store.get_central_repo_path()?;
    let skill_dir = central_path.join(&skill_id);
    std::fs::create_dir_all(&skill_dir)?;
    
    crate::core::installer::copy_skill_files(source_path, &skill_dir)?;
    
    let target_path = store.get_tool_path()?;
    crate::core::installer::install_to_tool(&skill_dir, &target_path)?;
    
    Ok(InstallResultDto {
        skill_id,
        skill_name: name,
        central_path: skill_dir.to_string_lossy().to_string(),
        target_path,
    })
}

fn list_local_skills_impl(
    app: &AppHandle,
    store: &SkillStore,
    source_path: &str,
) -> Result<Vec<LocalSkillDto>, anyhow::Error> {
    let mut skills = Vec::new();
    let installed_skills = store.list_skills()?;
    
    for entry in std::fs::read_dir(source_path)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            let has_skill_md = skill_md.exists();
            let is_installed = installed_skills.iter().any(|s| s.source_ref.as_ref().map_or(false, |r| r == path.to_string_lossy().as_ref()));
            
            if has_skill_md {
                let name = crate::core::installer::parse_skill_md(&path.to_string_lossy())?.0;
                skills.push(LocalSkillDto {
                    name,
                    path: path.to_string_lossy().to_string(),
                    has_skill_md: true,
                    is_installed,
                });
            }
        }
    }
    
    Ok(skills)
}

fn install_local_selection_impl(
    app: &AppHandle,
    store: &SkillStore,
    source_path: &str,
    selected_skills: &[String],
) -> Result<Vec<InstallResultDto>, anyhow::Error> {
    let mut results = Vec::new();
    
    for skill_name in selected_skills {
        let skill_path = std::path::PathBuf::from(source_path).join(skill_name);
        let result = install_local_impl(app, store, &skill_path.to_string_lossy())?;
        results.push(result);
    }
    
    Ok(results)
}

fn format_anyhow_error(err: anyhow::Error) -> String {
    err.to_string()
}
```

**Step 2: 修改 mod.rs**

添加模块声明:
```rust
pub mod local_install;
```

删除 mod.rs 中所有本地安装相关的代码

**Step 3: 更新 lib.rs**

修改 invoke_handler 中的本地安装命令为:
```rust
commands::local_install::install_local,
commands::local_install::list_local_skills_cmd,
commands::local_install::install_local_selection,
```

**Step 4: 运行编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/src/commands/local_install.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "refactor(commands): extract local_install module"
```

---

### Task 3: 创建 Git 安装模块 (git_install.rs)

**Files:**
- Create: `src-tauri/src/commands/git_install.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 git_install.rs 文件**

```rust
use crate::core::skill_store::SkillStore;
use serde::Serialize;
use tauri::{AppHandle, State};

// Git installation commands
#[tauri::command]
#[allow(non_snake_case)]
pub async fn install_git(
    app: AppHandle,
    store: State<'_, SkillStore>,
    repoUrl: String,
) -> Result<InstallResultDto, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        install_git_impl(&app, &store, &repoUrl)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn list_git_skills_cmd(
    app: AppHandle,
    store: State<'_, SkillStore>,
    repoUrl: String,
) -> Result<Vec<GitSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        list_git_skills_impl(&app, &store, &repoUrl)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn install_git_selection(
    app: AppHandle,
    store: State<'_, SkillStore>,
    repoUrl: String,
    selectedSkills: Vec<String>,
) -> Result<Vec<InstallResultDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        install_git_selection_impl(&app, &store, &repoUrl, &selectedSkills)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub async fn search_github(query: String, limit: Option<u32>) -> Result<Vec<RepoSummary>, String> {
    let limit = limit.unwrap_or(10) as usize;
    tauri::async_runtime::spawn_blocking(move || search_github_repos(&query, limit))
        .await
        .map_err(|err| err.to_string())?
        .map_err(format_anyhow_error)
}

// DTOs
#[derive(Debug, Serialize)]
pub struct GitSkillDto {
    pub name: String,
    pub path: String,
    pub has_skill_md: bool,
    pub is_installed: bool,
}

#[derive(Debug, Serialize)]
pub struct RepoSummary {
    pub name: String,
    pub full_name: String,
    pub description: String,
    pub html_url: String,
    pub stargazers_count: i64,
}

// Helper functions
fn install_git_impl(
    app: &AppHandle,
    store: &SkillStore,
    repo_url: &str,
) -> Result<InstallResultDto, anyhow::Error> {
    let temp_dir = crate::core::git_utils::clone_repo(repo_url)?;
    let skill_path = temp_dir.path();
    
    let (name, description) = crate::core::installer::parse_skill_md(skill_path)?;
    let skill_id = store.add_skill(&name, &description, repo_url)?;
    
    let central_path = store.get_central_repo_path()?;
    let skill_dir = central_path.join(&skill_id);
    std::fs::create_dir_all(&skill_dir)?;
    
    crate::core::installer::copy_skill_files(skill_path, &skill_dir)?;
    
    let target_path = store.get_tool_path()?;
    crate::core::installer::install_to_tool(&skill_dir, &target_path)?;
    
    Ok(InstallResultDto {
        skill_id,
        skill_name: name,
        central_path: skill_dir.to_string_lossy().to_string(),
        target_path,
    })
}

fn list_git_skills_impl(
    app: &AppHandle,
    store: &SkillStore,
    repo_url: &str,
) -> Result<Vec<GitSkillDto>, anyhow::Error> {
    let temp_dir = crate::core::git_utils::clone_repo(repo_url)?;
    let repo_path = temp_dir.path();
    
    let mut skills = Vec::new();
    let installed_skills = store.list_skills()?;
    
    for entry in std::fs::read_dir(repo_path)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            let has_skill_md = skill_md.exists();
            let is_installed = installed_skills.iter().any(|s| s.source_ref.as_ref().map_or(false, |r| r == repo_url));
            
            if has_skill_md {
                let name = crate::core::installer::parse_skill_md(&path.to_string_lossy())?.0;
                skills.push(GitSkillDto {
                    name,
                    path: path.to_string_lossy().to_string(),
                    has_skill_md: true,
                    is_installed,
                });
            }
        }
    }
    
    Ok(skills)
}

fn install_git_selection_impl(
    app: &AppHandle,
    store: &SkillStore,
    repo_url: &str,
    selected_skills: &[String],
) -> Result<Vec<InstallResultDto>, anyhow::Error> {
    let mut results = Vec::new();
    
    for skill_name in selected_skills {
        let skill_path = std::path::PathBuf::from(repo_url).join(skill_name);
        let result = install_git_impl(app, store, &skill_path.to_string_lossy())?;
        results.push(result);
    }
    
    Ok(results)
}

fn search_github_repos(query: &str, limit: usize) -> Result<Vec<RepoSummary>, anyhow::Error> {
    use crate::core::github_search::search_repositories;
    search_repositories(query, limit)
}

fn format_anyhow_error(err: anyhow::Error) -> String {
    err.to_string()
}
```

**Step 2: 修改 mod.rs**

添加模块声明:
```rust
pub mod git_install;
```

删除 mod.rs 中所有 Git 安装相关的代码

**Step 3: 更新 lib.rs**

修改 invoke_handler 中的 Git 安装命令为:
```rust
commands::git_install::install_git,
commands::git_install::list_git_skills_cmd,
commands::git_install::install_git_selection,
commands::git_install::search_github,
```

**Step 4: 运行编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: 提交**

```bash
git add src-tauri/src/commands/git_install.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "refactor(commands): extract git_install module"
```

---

### Task 4: 创建技能同步模块 (skill_sync.rs)

**Files:**
- Create: `src-tauri/src/commands/skill_sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 skill_sync.rs 文件**

```rust
use crate::core::skill_store::SkillStore;
use serde::Serialize;
use tauri::State;

// Skill sync commands
#[tauri::command]
pub async fn sync_skill_dir(
    source_path: String,
    target_path: String,
) -> Result<SyncResultDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sync_skill_dir_impl(&source_path, &target_path)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn sync_skill_to_tool(
    store: State<'_, SkillStore>,
    sourcePath: String,
    skillId: String,
    tool: String,
) -> Result<SyncSkillResultDto, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sync_skill_to_tool_impl(&store, &sourcePath, &skillId, &tool)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn unsync_skill_from_tool(
    store: State<'_, SkillStore>,
    skillId: String,
    tool: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        unsync_skill_from_tool_impl(&store, &skillId, &tool)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn update_managed_skill(
    app: tauri::AppHandle,
    store: State<'_, SkillStore>,
    skillId: String,
) -> Result<UpdateSkillResultDto, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        update_managed_skill_impl(&app, &store, &skillId)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

// DTOs
#[derive(Debug, Serialize)]
pub struct SyncResultDto {
    pub mode_used: String,
    pub target_path: String,
}

#[derive(Debug, Serialize)]
pub struct SyncSkillResultDto {
    pub skill_id: String,
    pub tool: String,
    pub target_path: String,
    pub synced_at: i64,
}

#[derive(Debug, Serialize)]
pub struct UpdateSkillResultDto {
    pub skill_id: String,
    pub content_hash: Option<String>,
    pub source_revision: Option<String>,
    pub updated_targets: Vec<String>,
}

// Helper functions
fn sync_skill_dir_impl(
    source_path: &str,
    target_path: &str,
) -> Result<SyncResultDto, anyhow::Error> {
    use crate::core::sync::{sync_directory, SyncMode};
    
    let source = std::path::PathBuf::from(source_path);
    let target = std::path::PathBuf::from(target_path);
    
    let mode = sync_directory(&source, &target)?;
    
    Ok(SyncResultDto {
        mode_used: format!("{:?}", mode),
        target_path: target_path.to_string(),
    })
}

fn sync_skill_to_tool_impl(
    store: &SkillStore,
    source_path: &str,
    skill_id: &str,
    tool: &str,
) -> Result<SyncSkillResultDto, anyhow::Error> {
    let skill = store.get_skill_by_id(skill_id)?
        .ok_or_else(|| anyhow::anyhow!("skill not found"))?;
    
    let target_path = store.get_tool_path()?;
    let tool_path = std::path::PathBuf::from(&target_path).join(tool);
    
    use crate::core::sync::{sync_directory, SyncMode};
    sync_directory(&std::path::PathBuf::from(source_path), &tool_path)?;
    
    let now = crate::core::time::now_ms();
    store.add_skill_target(skill_id, tool, &tool_path.to_string_lossy(), now)?;
    
    Ok(SyncSkillResultDto {
        skill_id: skill_id.to_string(),
        tool: tool.to_string(),
        target_path: tool_path.to_string_lossy().to_string(),
        synced_at: now,
    })
}

fn unsync_skill_from_tool_impl(
    store: &SkillStore,
    skill_id: &str,
    tool: &str,
) -> Result<(), anyhow::Error> {
    store.remove_skill_target(skill_id, tool)?;
    Ok(())
}

fn update_managed_skill_impl(
    app: &tauri::AppHandle,
    store: &SkillStore,
    skill_id: &str,
) -> Result<UpdateSkillResultDto, anyhow::Error> {
    let skill = store.get_skill_by_id(skill_id)?
        .ok_or_else(|| anyhow::anyhow!("skill not found"))?;
    
    let source_ref = skill.source_ref
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("skill has no source reference"))?;
    
    let updated_content = if source_ref.starts_with("http") {
        crate::core::git_utils::pull_repo(&skill.central_path)?
    } else {
        crate::core::sync::sync_directory(
            std::path::PathBuf::from(source_ref),
            std::path::PathBuf::from(&skill.central_path),
        )?;
        None
    };
    
    let content_hash = updated_content.map(|_| crate::core::hash::compute_hash(&skill.central_path)?);
    
    let targets = store.list_skill_targets(skill_id)?;
    let mut updated_targets = Vec::new();
    
    for target in &targets {
        crate::core::sync::sync_directory(
            std::path::PathBuf::from(&skill.central_path),
            std::path::PathBuf::from(&target.target_path),
        )?;
        updated_targets.push(target.target_path.clone());
    }
    
    let now = crate::core::time::now_ms();
    store.update_skill_timestamp(skill_id, now)?;
    
    Ok(UpdateSkillResultDto {
        skill_id: skill_id.to_string(),
        content_hash,
        source_revision: updated_content,
        updated_targets,
    })
}

fn format_anyhow_error(err: anyhow::Error) -> String {
    err.to_string()
}
```

**Step 2-5: 同之前的步骤,修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 5: 创建技能管理模块 (skill_management.rs)

**Files:**
- Create: `src-tauri/src/commands/skill_management.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 skill_management.rs 文件**

包含以下命令:
- `import_existing_skill`
- `get_managed_skills`
- `delete_managed_skill`
- `update_skill_category`

参考前面的模块结构,将相关代码迁移到这个文件中。

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 6: 创建技能发现模块 (skill_discovery.rs)

**Files:**
- Create: `src-tauri/src/commands/skill_discovery.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 skill_discovery.rs 文件**

包含以下命令:
- `fetch_discovered_skills`
- `get_categories`
- `get_skills_by_category`
- `search_skills`
- `fetch_skills_by_category_with_pagination`

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 7: 创建扫描路径模块 (scan_paths.rs)

**Files:**
- Create: `src-tauri/src/commands/scan_paths.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 scan_paths.rs 文件**

包含以下命令:
- `add_scan_path`
- `remove_scan_path`
- `list_scan_paths`

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 8: 创建分类模块 (categories.rs)

**Files:**
- Create: `src-tauri/src/commands/categories.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 categories.rs 文件**

包含以下命令:
- `add_category`
- `remove_category`
- `list_categories_db`

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 9: 创建技能文件模块 (skill_files.rs)

**Files:**
- Create: `src-tauri/src/commands/skill_files.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 skill_files.rs 文件**

包含以下命令:
- `read_skill_file`
- `write_skill_file`
- `list_skill_files`
- `FileTreeNode` 结构体

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 10: 创建分析模块 (analytics.rs)

**Files:**
- Create: `src-tauri/src/commands/analytics.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 analytics.rs 文件**

包含以下命令:
- `get_analytics_overview`
- `get_analytics_daily_trend`
- `get_analytics_top_skills`
- `get_analytics_success_rate`
- `get_analytics_cost_summary`
- `get_analytics_caller_analysis`
- `get_analytics_user_retention`
- `get_analytics_alerts`
- `acknowledge_analytics_alert`

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 11: 创建 Awesome 同步模块 (awesome_sync.rs)

**Files:**
- Create: `src-tauri/src/commands/awesome_sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 awesome_sync.rs 文件**

包含以下命令:
- `sync_awesome_claude_skills`
- `fetch_discovered_skills_from_db`
- `fetch_discovered_skills_by_category_from_db`
- `search_discovered_skills_from_db`
- `SyncAwesomeSkillsResult` 结构体

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 12: 创建文件操作模块 (file_operations.rs)

**Files:**
- Create: `src-tauri/src/commands/file_operations.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 file_operations.rs 文件**

包含以下命令:
- `save_file_with_dialog`

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 13: 创建 AI Agent 模块 (ai_agents.rs)

**Files:**
- Create: `src-tauri/src/commands/ai_agents.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: 创建 ai_agents.rs 文件**

包含以下命令:
- `add_ai_agent`
- `update_ai_agent`
- `remove_ai_agent`
- `list_ai_agents`
- `AiAgentDto` 结构体

**Step 2-5: 修改 mod.rs, lib.rs,编译检查,提交**

---

### Task 14: 清理并重构 mod.rs

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`

**Step 1: 重写 mod.rs 为简洁的模块重导出**

```rust
// Re-export all command modules
pub mod config;
pub mod local_install;
pub mod git_install;
pub mod skill_sync;
pub mod skill_management;
pub mod skill_discovery;
pub mod scan_paths;
pub mod categories;
pub mod skill_files;
pub mod analytics;
pub mod awesome_sync;
pub mod file_operations;
pub mod ai_agents;

#[cfg(test)]
#[path = "tests/commands.rs"]
mod tests;
```

**Step 2: 运行完整编译检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS (所有模块正确编译)

**Step 3: 运行测试**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS (所有测试通过)

**Step 4: 提交最终版本**

```bash
git add src-tauri/src/commands/mod.rs
git commit -m "refactor(commands): clean up mod.rs to only contain module declarations"
```

---

### Task 15: 验证和文档更新

**Files:**
- Modify: `docs/REFACTOR_SUMMARY.md`
- Test: 运行完整的应用程序

**Step 1: 更新重构总结文档**

在 `docs/REFACTOR_SUMMARY.md` 中添加本次重构的记录:

```markdown
## Commands Module Refactor (2026-02-18)

### Goal
将 `src-tauri/src/commands/mod.rs` (1634行, 52KB) 按功能域拆分为多个模块文件

### Changes
- 拆分为 13 个功能模块
- 每个模块包含相关的 Tauri 命令和 DTO 结构体
- 主 mod.rs 仅保留模块重导出

### Benefits
- 提高代码可维护性
- 降低单个文件复杂度
- 便于单元测试
- 清晰的功能边界

### Module Mapping
- config.rs - 配置相关命令
- local_install.rs - 本地技能安装
- git_install.rs - Git 仓库技能安装
- skill_sync.rs - 技能同步管理
- skill_management.rs - 技能管理
- skill_discovery.rs - 技能发现和搜索
- scan_paths.rs - 扫描路径管理
- categories.rs - 分类管理
- skill_files.rs - 技能文件操作
- analytics.rs - 分析统计
- awesome_sync.rs - Awesome Claude Skills 同步
- file_operations.rs - 文件操作
- ai_agents.rs - AI Agent 配置
```

**Step 2: 运行应用程序验证**

Run: `npm run tauri dev` (或相应的开发命令)
Expected: 应用程序正常启动,所有命令功能正常

**Step 3: 检查是否有 lint 错误**

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml`
Expected: 无新的警告或错误

**Step 4: 提交文档更新**

```bash
git add docs/REFACTOR_SUMMARY.md
git commit -m "docs: add commands refactor summary"
```

---

## Testing Checklist

在完成所有任务后,确保:

- [ ] 所有模块编译通过
- [ ] 所有测试通过
- [ ] 应用程序正常启动
- [ ] 所有 Tauri 命令在前端可正常调用
- [ ] 没有引入新的编译警告
- [ ] 代码格式符合项目规范
- [ ] 重构文档已更新

## Rollback Plan

如果遇到问题,可以通过以下步骤回滚:

```bash
git revert <commit-hash>
```

或恢复到重构前的状态:

```bash
git checkout HEAD~15 -- src-tauri/src/commands/
```

---

## Notes

1. **保持向后兼容**: 所有命令名称和签名保持不变
2. **DTO 导出**: 确保 DTO 结构体在模块中是 `pub` 的
3. **测试覆盖**: 每个模块都应该有对应的测试
4. **渐进式迁移**: 可以逐个模块进行迁移,每次完成后验证
5. **依赖关系**: 注意模块之间的依赖关系,可能需要调整导入语句

---

**Plan complete and saved to `docs/plans/2026-02-18-commands-mod-refactor.md`. Two execution options:**

1. **Subagent-Driven (this session)** - 我将在此会话中为每个任务派发一个新的 subagent,在任务之间进行审查,快速迭代

2. **Parallel Session (separate)** - 在 worktree 中打开新会话,使用 executing-plans skill 批量执行,有审查检查点

**您希望使用哪种方式?**
