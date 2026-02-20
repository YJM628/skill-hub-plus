// AI Agents configuration commands
use tauri::State;
use serde::Serialize;

#[tauri::command]
#[allow(non_snake_case)]
pub fn add_ai_agent(
    store: State<'_, crate::core::skill_store::SkillStore>,
    name: String,
    apiKey: String,
    baseUrl: String,
) -> Result<String, String> {
    let store = store.inner().clone();
    store.add_ai_agent(&name, &apiKey, &baseUrl).map_err(|err| err.to_string())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn update_ai_agent(
    store: State<'_, crate::core::skill_store::SkillStore>,
    id: String,
    name: String,
    apiKey: String,
    baseUrl: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.update_ai_agent(&id, &name, &apiKey, &baseUrl).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn remove_ai_agent(
    store: State<'_, crate::core::skill_store::SkillStore>,
    id: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    store.remove_ai_agent(&id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_ai_agents(store: State<'_, crate::core::skill_store::SkillStore>) -> Result<Vec<AiAgentDto>, String> {
    let store = store.inner().clone();
    let agents = store.list_ai_agents().map_err(|err| err.to_string())?;
    Ok(agents
        .into_iter()
        .map(|a| AiAgentDto {
            id: a.id,
            name: a.name,
            api_key: a.api_key,
            base_url: a.base_url,
            created_at: a.created_at,
            updated_at: a.updated_at,
        })
        .collect())
}

#[derive(Debug, Serialize)]
pub struct AiAgentDto {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub created_at: i64,
    pub updated_at: i64,
}