use crate::core::skill_store::SkillStore;
use serde::Serialize;
use tauri::State;
use anyhow::Context;
use super::now_ms;
use super::format_anyhow_error;

#[tauri::command]
#[allow(non_snake_case)]
pub async fn read_skill_file(
    store: State<'_, SkillStore>,
    skillId: String,
    fileName: String,
) -> Result<String, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skill = store
            .get_skill_by_id(&skillId)?
            .ok_or_else(|| anyhow::anyhow!("skill not found"))?;
        
        let file_path = std::path::PathBuf::from(&skill.central_path).join(&fileName);
        
        if !file_path.exists() {
            anyhow::bail!("file not found: {}", fileName);
        }
        
        let content = std::fs::read_to_string(&file_path)
            .with_context(|| format!("failed to read file: {}", fileName))?;
        
        Ok::<_, anyhow::Error>(content)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn write_skill_file(
    store: State<'_, SkillStore>,
    skillId: String,
    fileName: String,
    content: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skill = store
            .get_skill_by_id(&skillId)?
            .ok_or_else(|| anyhow::anyhow!("skill not found"))?;
        
        let file_path = std::path::PathBuf::from(&skill.central_path).join(&fileName);
        
        // Ensure parent directory exists
        if let Some(parent) = file_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("failed to create parent directory"))?;
        }
        
        std::fs::write(&file_path, content)
            .with_context(|| format!("failed to write file: {}", fileName))?;
        
        // Update the skill's description from the file if it's SKILL.md
        let now = now_ms();
        if fileName == "SKILL.md" {
            // Parse the updated SKILL.md to extract description
            if let Some((name, description, _)) = crate::core::installer::parse_skill_md(&file_path) {
                store.update_skill_description(&skillId, name, description)?;
            }
        }
        
        // Update the skill's updated_at timestamp
        store.update_skill_timestamp(&skillId, now)?;
        
        Ok::<_, anyhow::Error>(())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[derive(Debug, Serialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub node_type: String, // "file" or "directory"
    pub children: Option<Vec<FileTreeNode>>,
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn list_skill_files(
    store: State<'_, SkillStore>,
    skillId: String,
) -> Result<Vec<FileTreeNode>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skill = store
            .get_skill_by_id(&skillId)?
            .ok_or_else(|| anyhow::anyhow!("skill not found"))?;
        
        let skill_path = std::path::PathBuf::from(&skill.central_path);
        
        if !skill_path.exists() {
            anyhow::bail!("skill directory not found: {}", skill.central_path);
        }
        
        fn build_tree(path: &std::path::Path, base_path: &std::path::Path) -> anyhow::Result<Vec<FileTreeNode>> {
            let mut nodes = Vec::new();
            
            let mut entries: Vec<_> = std::fs::read_dir(path)?
                .filter_map(|e| e.ok())
                .collect();
            
            // Sort: directories first, then files, alphabetically
            entries.sort_by(|a, b| {
                let a_is_dir = a.path().is_dir();
                let b_is_dir = b.path().is_dir();
                if a_is_dir != b_is_dir {
                    b_is_dir.cmp(&a_is_dir)
                } else {
                    a.file_name().cmp(&b.file_name())
                }
            });
            
            for entry in entries {
                let entry_path = entry.path();
                let name = entry.file_name()
                    .to_string_lossy()
                    .to_string();
                
                // Skip hidden files and directories
                if name.starts_with('.') {
                    continue;
                }
                
                let relative_path = entry_path
                    .strip_prefix(base_path)?
                    .to_string_lossy()
                    .to_string();
                
                if entry_path.is_dir() {
                    let children = build_tree(&entry_path, base_path)?;
                    nodes.push(FileTreeNode {
                        name,
                        path: relative_path,
                        node_type: "directory".to_string(),
                        children: Some(children),
                    });
                } else {
                    nodes.push(FileTreeNode {
                        name,
                        path: relative_path,
                        node_type: "file".to_string(),
                        children: None,
                    });
                }
            }
            
            Ok(nodes)
        }
        
        let tree = build_tree(&skill_path, &skill_path)?;
        Ok::<_, anyhow::Error>(tree)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}
