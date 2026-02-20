use crate::core::skill_store::SkillStore;
use tauri::State;
use super::remove_path_any;
use super::format_anyhow_error;

// Scan paths commands
#[tauri::command]
pub fn add_scan_path(store: State<'_, SkillStore>, path: String) -> Result<String, String> {
    let store = store.inner().clone();
    store.add_scan_path(&path).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn remove_scan_path(
    store: State<'_, SkillStore>,
    path: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // 首先从数据库中移除扫描路径记录
        store.remove_scan_path(&path)?;

        // 查找所有来自该扫描路径的 skill
        let all_skills = store.list_skills()?;
        let skills_to_delete: Vec<_> = all_skills
            .into_iter()
            .filter(|skill| {
                if let Some(ref source_ref) = skill.source_ref {
                    // 检查 source_ref 是否以该扫描路径开头
                    source_ref.starts_with(&path)
                } else {
                    false
                }
            })
            .collect();

        // 删除找到的所有 skill
        let mut delete_failures: Vec<String> = Vec::new();
        for skill in skills_to_delete {
            // 删除工具目录中的副本/软链接
            let targets = store.list_skill_targets(&skill.id)?;
            for target in targets {
                if let Err(err) = remove_path_any(&target.target_path) {
                    delete_failures.push(format!("{}: {}", target.target_path, err));
                }
            }

            // 删除中央存储路径中的文件
            let central_path = std::path::PathBuf::from(&skill.central_path);
            if central_path.exists() {
                if let Err(err) = std::fs::remove_dir_all(&central_path) {
                    delete_failures.push(format!("{}: {}", skill.central_path, err));
                }
            }

            // 删除数据库记录
            store.delete_skill(&skill.id)?;
        }

        if !delete_failures.is_empty() {
            anyhow::bail!(
                "已删除扫描路径，但清理部分文件失败：\n- {}",
                delete_failures.join("\n- ")
            );
        }

        Ok::<_, anyhow::Error>(())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(format_anyhow_error)
}

#[tauri::command]
pub fn list_scan_paths(store: State<'_, SkillStore>) -> Result<Vec<String>, String> {
    let store = store.inner().clone();
    store.list_scan_paths().map_err(|err| err.to_string())
}
