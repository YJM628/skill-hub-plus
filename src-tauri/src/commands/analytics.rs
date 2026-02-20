// Analytics commands
#[tauri::command]
pub async fn get_analytics_overview(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
) -> Result<crate::core::analytics_store::AnalyticsOverview, String> {
    let days = days.unwrap_or(7);
    store.get_overview(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_daily_trend(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::DailyStats>, String> {
    let days = days.unwrap_or(30);
    store.get_daily_trend(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_top_skills(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::TopSkillEntry>, String> {
    let days = days.unwrap_or(7);
    let limit = limit.unwrap_or(10);
    store.get_top_skills(days, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_success_rate(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    skill_id: Option<String>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::DailyStats>, String> {
    let days = days.unwrap_or(30);
    store
        .get_success_rate_trend(skill_id.as_deref(), days)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_cost_summary(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::TopSkillEntry>, String> {
    let days = days.unwrap_or(30);
    store.get_cost_summary(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_caller_analysis(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::CallerDependency>, String> {
    let days = days.unwrap_or(30);
    store.get_caller_analysis(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_user_retention(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    days: Option<i64>,
) -> Result<Vec<crate::core::analytics_store::UserRetentionPair>, String> {
    let days = days.unwrap_or(30);
    store.get_user_retention(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_analytics_alerts(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
) -> Result<Vec<crate::core::analytics_store::AnalyticsAlert>, String> {
    store.get_active_alerts().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn acknowledge_analytics_alert(
    store: tauri::State<'_, std::sync::Arc<crate::core::analytics_store::AnalyticsStore>>,
    alert_id: String,
) -> Result<(), String> {
    store.acknowledge_alert(&alert_id).map_err(|e| e.to_string())
}
