#[cfg(test)]
mod tests {
    use crate::core::analytics_store::{AnalyticsStore, SkillEventRow};
    use tempfile::NamedTempFile;

    fn create_test_store() -> AnalyticsStore {
        let tmp = NamedTempFile::new().unwrap();
        AnalyticsStore::new(tmp.path().to_path_buf()).unwrap()
    }

    fn make_event(skill_id: &str, success: bool, duration_ms: i64) -> SkillEventRow {
        SkillEventRow {
            id: uuid::Uuid::new_v4().to_string(),
            event_type: "skill_invoke".to_string(),
            skill_id: skill_id.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
            user_id: "test_user".to_string(),
            session_id: "test_session".to_string(),
            input_hash: Some("abc123".to_string()),
            success,
            duration_ms: Some(duration_ms),
            error: if success { None } else { Some("test error".to_string()) },
            feedback_score: None,
            token_input: None,
            token_output: None,
            api_cost_usd: None,
            caller_agent: None,
            caller_workflow: None,
            caller_tool: None,
            metadata_json: None,
        }
    }

    #[test]
    fn test_schema_creation() {
        let store = create_test_store();
        store.ensure_schema().unwrap();
    }

    #[test]
    fn test_insert_and_query_events() {
        let store = create_test_store();
        let events = vec![
            make_event("skill-a", true, 100),
            make_event("skill-a", true, 200),
            make_event("skill-b", false, 500),
        ];
        let count = store.insert_events(&events).unwrap();
        assert_eq!(count, 3);

        let overview = store.get_overview(1).unwrap();
        assert_eq!(overview.total_calls, 3);
        assert_eq!(overview.active_users, 1);
    }

    #[test]
    fn test_top_skills() {
        let store = create_test_store();
        let mut events = Vec::new();
        for _ in 0..5 {
            events.push(make_event("popular-skill", true, 100));
        }
        for _ in 0..2 {
            events.push(make_event("rare-skill", true, 200));
        }
        store.insert_events(&events).unwrap();

        let top = store.get_top_skills(1, 10).unwrap();
        assert!(!top.is_empty());
        assert_eq!(top[0].skill_id, "popular-skill");
        assert_eq!(top[0].call_count, 5);
    }

    #[test]
    fn test_active_alerts_empty() {
        let store = create_test_store();
        let alerts = store.get_active_alerts().unwrap();
        assert!(alerts.is_empty());
    }

    #[test]
    fn test_duplicate_insert_ignored() {
        let store = create_test_store();
        let event = make_event("skill-a", true, 100);
        let events = vec![event.clone(), event];
        let count = store.insert_events(&events).unwrap();
        assert_eq!(count, 2);
    }
}
