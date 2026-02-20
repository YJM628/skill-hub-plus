mod commands;
mod core;

use core::skill_store::{default_db_path, migrate_legacy_db_if_needed, SkillStore};
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .targets([
                        Target::new(TargetKind::LogDir { file_name: None }),
                        #[cfg(desktop)]
                        Target::new(TargetKind::Stdout),
                    ])
                    .build(),
            )?;

            let db_path = default_db_path(app.handle()).map_err(tauri::Error::from)?;
            migrate_legacy_db_if_needed(&db_path).map_err(tauri::Error::from)?;
            let store = SkillStore::new(db_path.clone());
            store.ensure_schema().map_err(tauri::Error::from)?;
            store.initialize_default_scan_paths().map_err(tauri::Error::from)?;
            app.manage(store.clone());

            // Initialize Analytics
            let analytics_db_path = db_path.with_file_name("skills_hub_analytics.db");
            let analytics_store = crate::core::analytics_store::AnalyticsStore::new(analytics_db_path)
                .map_err(|e| tauri::Error::from(anyhow::anyhow!("{}", e)))?;
            let analytics_arc = std::sync::Arc::new(analytics_store);

            // Start ingest server in background
            let ingest_store = analytics_arc.clone();
            std::thread::spawn(move || {
                if let Err(err) = crate::core::analytics_ingest::start_ingest_server(ingest_store) {
                    log::error!("[analytics] Failed to start ingest server: {}", err);
                }
            });

            // Start chat server in background
            std::thread::spawn(move || {
                if let Err(err) = crate::core::chat_server::start_chat_server() {
                    log::error!("[chat] Failed to start chat server: {}", err);
                }
            });

            // Make AnalyticsStore available to Tauri commands
            app.manage(std::sync::Arc::clone(&analytics_arc));

            // Best-effort cleanup of our own old git temp directories.
            // Safety:
            // - Only deletes directories that match prefix `skills-hub-git-*`
            // - And contain our marker file `.skills-hub-git-temp`
            // - And are older than the max age.
            let handle = app.handle().clone();
            let store_for_cleanup = store.clone();
            tauri::async_runtime::spawn(async move {
                let removed = core::temp_cleanup::cleanup_old_git_temp_dirs(
                    &handle,
                    std::time::Duration::from_secs(24 * 60 * 60),
                )
                .unwrap_or(0);
                if removed > 0 {
                    log::info!("cleaned up {} old git temp dirs", removed);
                }

                let cleanup_days =
                    core::cache_cleanup::get_git_cache_cleanup_days(&store_for_cleanup);
                if cleanup_days > 0 {
                    let max_age =
                        std::time::Duration::from_secs(cleanup_days as u64 * 24 * 60 * 60);
                    let removed =
                        core::cache_cleanup::cleanup_git_cache_dirs(&handle, max_age).unwrap_or(0);
                    if removed > 0 {
                        log::info!("cleaned up {} git cache dirs", removed);
                    }
                }

                // Check for auto-updates on startup
                let store_for_update = store_for_cleanup.clone();
                let handle_for_update = handle.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    match core::auto_update::check_auto_updates(&handle_for_update, &store_for_update) {
                        Ok(updated) => {
                            if !updated.is_empty() {
                                log::info!(
                                    "[auto_update] Startup check: {} skills were auto-updated: {:?}",
                                    updated.len(),
                                    updated
                                );
                            }
                        }
                        Err(err) => {
                            log::warn!("[auto_update] Startup check failed: {}", err);
                        }
                    }
                });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_central_repo_path,
            commands::set_central_repo_path,
            commands::get_tool_status,
            commands::get_git_cache_cleanup_days,
            commands::get_git_cache_ttl_secs,
            commands::set_git_cache_cleanup_days,
            commands::set_git_cache_ttl_secs,
            commands::clear_git_cache_now,
            commands::get_auto_update_enabled,
            commands::set_auto_update_enabled,
            commands::get_onboarding_plan,
            commands::install_local,
            commands::list_local_skills_cmd,
            commands::install_local_selection,
            commands::install_git,
            commands::list_git_skills_cmd,
            commands::install_git_selection,
            commands::sync_skill_dir,
            commands::sync_skill_to_tool,
            commands::unsync_skill_from_tool,
            commands::update_managed_skill,
            commands::search_github,
            commands::import_existing_skill,
            commands::get_managed_skills,
            commands::delete_managed_skill,
            commands::update_skill_category,
            commands::fetch_discovered_skills,
            commands::get_categories,
            commands::get_skills_by_category,
            commands::search_skills,
            commands::fetch_skills_by_category_with_pagination,
            commands::add_scan_path,
            commands::remove_scan_path,
            commands::list_scan_paths,
            commands::read_skill_file,
            commands::write_skill_file,
            commands::list_skill_files,
            commands::save_file_with_dialog,
            commands::select_directory_dialog,
            commands::add_category,
            commands::remove_category,
            commands::list_categories_db,
            commands::get_analytics_overview,
            commands::get_analytics_daily_trend,
            commands::get_analytics_top_skills,
            commands::get_analytics_success_rate,
            commands::get_analytics_cost_summary,
            commands::get_analytics_caller_analysis,
            commands::get_analytics_user_retention,
            commands::get_analytics_alerts,
            commands::acknowledge_analytics_alert,
            commands::sync_awesome_claude_skills,
            commands::fetch_discovered_skills_from_db,
            commands::fetch_discovered_skills_by_category_from_db,
            commands::search_discovered_skills_from_db,
            commands::add_ai_agent,
            commands::update_ai_agent,
            commands::remove_ai_agent,
            commands::list_ai_agents,
            commands::scan_for_new_skills,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
