use crate::core::skill_store::SkillStore;
use tauri::State;
use super::CategoryInfoDto;

// Categories commands
#[tauri::command]
pub fn add_category(
    store: State<'_, SkillStore>,
    id: String,
    name: String,
    description: String,
    icon: String,
    color: String,
) -> Result<String, String> {
    let store = store.inner().clone();
    store.add_category(&id, &name, &description, &icon, &color).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn remove_category(store: State<'_, SkillStore>, id: String) -> Result<(), String> {
    let store = store.inner().clone();
    store.remove_category(&id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_categories_db(store: State<'_, SkillStore>) -> Result<Vec<CategoryInfoDto>, String> {
    let store = store.inner().clone();
    let categories = store.list_categories().map_err(|err| err.to_string())?;
    Ok(categories
        .into_iter()
        .map(|c| CategoryInfoDto {
            id: c.id,
            name: c.name,
            description: c.description,
            icon: c.icon,
            color: c.color,
        })
        .collect())
}