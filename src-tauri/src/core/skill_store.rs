use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use tauri::Manager;

const DB_FILE_NAME: &str = "skills_hub.db";
const LEGACY_APP_IDENTIFIERS: &[&str] = &["com.tauri.dev", "com.tauri.dev.skillshub"];

// Schema versioning: bump when making changes and add a migration step.
const SCHEMA_VERSION: i32 = 6;

// Minimal schema for MVP: skills, skill_targets, settings, discovered_skills(optional).
const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NULL,
  source_revision TEXT NULL,
  central_path TEXT NOT NULL UNIQUE,
  content_hash TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_sync_at INTEGER NULL,
  last_seen_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NULL
);

CREATE TABLE IF NOT EXISTS skill_targets (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  target_path TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT NULL,
  synced_at INTEGER NULL,
  UNIQUE(skill_id, tool),
  FOREIGN KEY(skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_paths (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS discovered_skills (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  found_path TEXT NOT NULL,
  name_guess TEXT NULL,
  fingerprint TEXT NULL,
  found_at INTEGER NOT NULL,
  imported_skill_id TEXT NULL,
  FOREIGN KEY(imported_skill_id) REFERENCES skills(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills(updated_at);
CREATE INDEX IF NOT EXISTS idx_scan_paths_path ON scan_paths(path);
CREATE INDEX IF NOT EXISTS idx_categories_id ON categories(id);
"#;

#[derive(Clone, Debug)]
pub struct SkillStore {
    db_path: PathBuf,
}

#[derive(Clone, Debug)]
pub struct SkillRecord {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub source_type: String,
    pub source_ref: Option<String>,
    pub source_revision: Option<String>,
    pub central_path: String,
    pub content_hash: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_sync_at: Option<i64>,
    pub last_seen_at: i64,
    pub status: String,
}

#[derive(Clone, Debug)]
pub struct SkillTargetRecord {
    pub id: String,
    pub skill_id: String,
    pub tool: String,
    pub target_path: String,
    pub mode: String,
    pub status: String,
    pub last_error: Option<String>,
    pub synced_at: Option<i64>,
}

#[derive(Clone, Debug)]
pub struct DiscoveredSkillRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub github_url: String,
    pub category: String,
    pub source: String,
    pub tags: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug)]
pub struct AiAgentRecord {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub base_url: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl SkillStore {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    #[allow(dead_code)]
    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn ensure_schema(&self) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute_batch("PRAGMA foreign_keys = ON;")?;

            let user_version: i32 = conn.query_row("PRAGMA user_version;", [], |row| row.get(0))?;
            if user_version == 0 {
                conn.execute_batch(SCHEMA_V1)?;
                conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
            } else if user_version == 1 {
                // Migration from v1 to v2: add description column
                conn.execute("ALTER TABLE skills ADD COLUMN description TEXT NULL", [])?;
                conn.pragma_update(None, "user_version", 2)?;
            } else if user_version == 2 {
                // Migration from v2 to v3: add category column
                conn.execute("ALTER TABLE skills ADD COLUMN category TEXT NULL", [])?;
                conn.pragma_update(None, "user_version", 3)?;
            } else if user_version == 3 {
                // Migration from v3 to v4: add categories table
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS categories (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        icon TEXT NOT NULL,
                        color TEXT NOT NULL,
                        created_at INTEGER NOT NULL
                    )",
                    [],
                )?;
                conn.execute("CREATE INDEX IF NOT EXISTS idx_categories_id ON categories(id)", [])?;
                // Initialize default categories
                Self::initialize_default_categories(conn)?;
                conn.pragma_update(None, "user_version", 4)?;
            } else if user_version == 4 {
                // Migration from v4 to v5: recreate discovered_skills table with new schema
                // Drop old table if exists
                conn.execute("DROP TABLE IF EXISTS discovered_skills", [])?;
                // Create new table with updated schema
                conn.execute(
                    "CREATE TABLE discovered_skills (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT NOT NULL,
                        github_url TEXT NOT NULL,
                        category TEXT NOT NULL,
                        source TEXT NOT NULL,
                        tags TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )",
                    [],
                )?;
                conn.execute("CREATE INDEX idx_discovered_skills_category ON discovered_skills(category)", [])?;
                conn.execute("CREATE INDEX idx_discovered_skills_source ON discovered_skills(source)", [])?;
                conn.pragma_update(None, "user_version", 5)?;
            } else if user_version == 5 {
                // Migration from v5 to v6: add ai_agents table
                conn.execute(
                    "CREATE TABLE IF NOT EXISTS ai_agents (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        api_key TEXT NOT NULL,
                        base_url TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    )",
                    [],
                )?;
                conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_agents_name ON ai_agents(name)", [])?;
                conn.pragma_update(None, "user_version", 6)?;
            } else if user_version > SCHEMA_VERSION {
                anyhow::bail!(
                    "database schema version {} is newer than app supports {}",
                    user_version,
                    SCHEMA_VERSION
                );
            }

            // Ensure scan_paths table exists for backwards compatibility
            // This is needed for existing databases that were created before scan_paths was added
            conn.execute(
                "CREATE TABLE IF NOT EXISTS scan_paths (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL
                )",
                [],
            )?;
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_scan_paths_path ON scan_paths(path)",
                [],
            )?;

            Ok(())
        })
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
            let mut rows = stmt.query(params![key])?;
            Ok(rows
                .next()?
                .map(|row| row.get::<_, String>(0))
                .transpose()?)
        })
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
            Ok(())
        })
    }

    #[allow(dead_code)]
    pub fn set_onboarding_completed(&self, completed: bool) -> Result<()> {
        self.set_setting(
            "onboarding_completed",
            if completed { "true" } else { "false" },
        )
    }

    pub fn get_auto_update_enabled(&self) -> Result<bool> {
        Ok(self
            .get_setting("auto_update_enabled")?
            .map(|v| v == "true")
            .unwrap_or(false))
    }

    pub fn set_auto_update_enabled(&self, enabled: bool) -> Result<()> {
        self.set_setting(
            "auto_update_enabled",
            if enabled { "true" } else { "false" },
        )
    }

    pub fn upsert_skill(&self, record: &SkillRecord) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO skills (
          id, name, description, category, source_type, source_ref, source_revision, central_path, content_hash,
          created_at, updated_at, last_sync_at, last_seen_at, status
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
          ?10, ?11, ?12, ?13, ?14
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          category = excluded.category,
          source_type = excluded.source_type,
          source_ref = excluded.source_ref,
          source_revision = excluded.source_revision,
          central_path = excluded.central_path,
          content_hash = excluded.content_hash,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          last_sync_at = excluded.last_sync_at,
          last_seen_at = excluded.last_seen_at,
          status = excluded.status",
                params![
                    record.id,
                    record.name,
                    record.description,
                    record.category,
                    record.source_type,
                    record.source_ref,
                    record.source_revision,
                    record.central_path,
                    record.content_hash,
                    record.created_at,
                    record.updated_at,
                    record.last_sync_at,
                    record.last_seen_at,
                    record.status
                ],
            )?;
            Ok(())
        })
    }

    pub fn upsert_skill_target(&self, record: &SkillTargetRecord) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO skill_targets (
          id, skill_id, tool, target_path, mode, status, last_error, synced_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        )
        ON CONFLICT(skill_id, tool) DO UPDATE SET
          target_path = excluded.target_path,
          mode = excluded.mode,
          status = excluded.status,
          last_error = excluded.last_error,
          synced_at = excluded.synced_at",
                params![
                    record.id,
                    record.skill_id,
                    record.tool,
                    record.target_path,
                    record.mode,
                    record.status,
                    record.last_error,
                    record.synced_at
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_skills(&self) -> Result<Vec<SkillRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
        "SELECT id, name, description, category, source_type, source_ref, source_revision, central_path, content_hash,
                created_at, updated_at, last_sync_at, last_seen_at, status
         FROM skills
         ORDER BY updated_at DESC",
      )?;
            let rows = stmt.query_map([], |row| {
                Ok(SkillRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    category: row.get(3)?,
                    source_type: row.get(4)?,
                    source_ref: row.get(5)?,
                    source_revision: row.get(6)?,
                    central_path: row.get(7)?,
                    content_hash: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    last_sync_at: row.get(11)?,
                    last_seen_at: row.get(12)?,
                    status: row.get(13)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn get_skill_by_id(&self, skill_id: &str) -> Result<Option<SkillRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
        "SELECT id, name, description, category, source_type, source_ref, source_revision, central_path, content_hash,
                created_at, updated_at, last_sync_at, last_seen_at, status
         FROM skills
         WHERE id = ?1
         LIMIT 1",
      )?;
            let mut rows = stmt.query(params![skill_id])?;
            if let Some(row) = rows.next()? {
                Ok(Some(SkillRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    category: row.get(3)?,
                    source_type: row.get(4)?,
                    source_ref: row.get(5)?,
                    source_revision: row.get(6)?,
                    central_path: row.get(7)?,
                    content_hash: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                    last_sync_at: row.get(11)?,
                    last_seen_at: row.get(12)?,
                    status: row.get(13)?,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn delete_skill(&self, skill_id: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM skills WHERE id = ?1", params![skill_id])?;
            Ok(())
        })
    }

    pub fn update_skill_category(&self, skill_id: &str, category: Option<&str>) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE skills SET category = ?1, updated_at = ?2 WHERE id = ?3",
                params![category, now, skill_id],
            )?;
            Ok(())
        })
    }

    pub fn update_skill_description(&self, skill_id: &str, name: String, description: Option<String>) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE skills SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
                params![name, description, now, skill_id],
            )?;
            Ok(())
        })
    }

    pub fn update_skill_timestamp(&self, skill_id: &str, updated_at: i64) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE skills SET updated_at = ?1 WHERE id = ?2",
                params![updated_at, skill_id],
            )?;
            Ok(())
        })
    }

    pub fn list_skill_targets(&self, skill_id: &str) -> Result<Vec<SkillTargetRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, skill_id, tool, target_path, mode, status, last_error, synced_at
         FROM skill_targets
         WHERE skill_id = ?1
         ORDER BY tool ASC",
            )?;
            let rows = stmt.query_map(params![skill_id], |row| {
                Ok(SkillTargetRecord {
                    id: row.get(0)?,
                    skill_id: row.get(1)?,
                    tool: row.get(2)?,
                    target_path: row.get(3)?,
                    mode: row.get(4)?,
                    status: row.get(5)?,
                    last_error: row.get(6)?,
                    synced_at: row.get(7)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn list_all_skill_target_paths(&self) -> Result<Vec<(String, String)>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT tool, target_path
         FROM skill_targets",
            )?;
            let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn get_skill_target(
        &self,
        skill_id: &str,
        tool: &str,
    ) -> Result<Option<SkillTargetRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, skill_id, tool, target_path, mode, status, last_error, synced_at
         FROM skill_targets
         WHERE skill_id = ?1 AND tool = ?2",
            )?;
            let mut rows = stmt.query(params![skill_id, tool])?;
            if let Some(row) = rows.next()? {
                Ok(Some(SkillTargetRecord {
                    id: row.get(0)?,
                    skill_id: row.get(1)?,
                    tool: row.get(2)?,
                    target_path: row.get(3)?,
                    mode: row.get(4)?,
                    status: row.get(5)?,
                    last_error: row.get(6)?,
                    synced_at: row.get(7)?,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn delete_skill_target(&self, skill_id: &str, tool: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM skill_targets WHERE skill_id = ?1 AND tool = ?2",
                params![skill_id, tool],
            )?;
            Ok(())
        })
    }

    // Scan paths management
    pub fn initialize_default_scan_paths(&self) -> Result<()> {
        let default_paths = vec![
            "~/.agents/skills",
            "~/.aone_copilot/skills",
            "~/.claude/skills",
            "~/.cursor/skills",
        ];
        
        for path in default_paths {
            // 检查路径是否已存在
            let exists: i64 = self.with_conn(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM scan_paths WHERE path = ?1",
                    params![path],
                    |row| row.get(0)
                )
                .map_err(|e| anyhow::anyhow!("Failed to check scan path existence: {}", e))
            })?;
            
            // 如果不存在，则添加
            if exists == 0 {
                self.add_scan_path(path)?;
            }
        }
        Ok(())
    }

    pub fn add_scan_path(&self, path: &str) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO scan_paths (id, path, created_at) VALUES (?1, ?2, ?3)",
                params![id, path, now],
            )?;
            Ok(id)
        })
    }

    pub fn remove_scan_path(&self, path: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM scan_paths WHERE path = ?1", params![path])?;
            Ok(())
        })
    }

    pub fn list_scan_paths(&self) -> Result<Vec<String>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT path FROM scan_paths ORDER BY created_at ASC")?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            let mut paths = Vec::new();
            for row in rows {
                paths.push(row?);
            }
            Ok(paths)
        })
    }

    // Categories management
    fn initialize_default_categories(conn: &Connection) -> Result<()> {
        use super::discovery_config::DiscoveryConfig;
        let config = DiscoveryConfig::get_default();
        
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        
        for (category_id, category) in config.categories {
            // Check if category already exists
            let exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM categories WHERE id = ?1",
                params![category_id],
                |row| row.get(0)
            ).unwrap_or(0);
            
            if exists == 0 {
                conn.execute(
                    "INSERT INTO categories (id, name, description, icon, color, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![category.id, category.name, category.description, category.icon, category.color, now],
                )?;
            }
        }
        Ok(())
    }

    pub fn add_category(&self, id: &str, name: &str, description: &str, icon: &str, color: &str) -> Result<String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO categories (id, name, description, icon, color, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, name, description, icon, color, now],
            )?;
            Ok(id.to_string())
        })
    }

    pub fn remove_category(&self, id: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    pub fn list_categories(&self) -> Result<Vec<crate::core::discovery::CategoryInfo>> {
        use super::discovery::CategoryInfo;
        
        self.with_conn(|conn| {
            let mut stmt = conn.prepare("SELECT id, name, description, icon, color FROM categories ORDER BY created_at ASC")?;
            let rows = stmt.query_map([], |row| {
                Ok(CategoryInfo {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    icon: row.get(3)?,
                    color: row.get(4)?,
                })
            })?;
            
            let mut categories = Vec::new();
            for row in rows {
                categories.push(row?);
            }
            Ok(categories)
        })
    }

    // Discovered skills management
    pub fn upsert_discovered_skill(&self, record: &DiscoveredSkillRecord) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO discovered_skills (
                    id, name, description, github_url, category, source, tags, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    github_url = excluded.github_url,
                    category = excluded.category,
                    source = excluded.source,
                    tags = excluded.tags,
                    updated_at = excluded.updated_at",
                params![
                    record.id,
                    record.name,
                    record.description,
                    record.github_url,
                    record.category,
                    record.source,
                    record.tags,
                    record.created_at,
                    record.updated_at
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_discovered_skills(&self) -> Result<Vec<DiscoveredSkillRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, github_url, category, source, tags, created_at, updated_at
                 FROM discovered_skills
                 ORDER BY category ASC, name ASC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(DiscoveredSkillRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    github_url: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    tags: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn list_discovered_skills_by_category(&self, category: &str) -> Result<Vec<DiscoveredSkillRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, github_url, category, source, tags, created_at, updated_at
                 FROM discovered_skills
                 WHERE category = ?1
                 ORDER BY name ASC",
            )?;
            let rows = stmt.query_map(params![category], |row| {
                Ok(DiscoveredSkillRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    github_url: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    tags: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn search_discovered_skills(&self, query: &str) -> Result<Vec<DiscoveredSkillRecord>> {
        self.with_conn(|conn| {
            let search_pattern = format!("%{}%", query.to_lowercase());
            let mut stmt = conn.prepare(
                "SELECT id, name, description, github_url, category, source, tags, created_at, updated_at
                 FROM discovered_skills
                 WHERE LOWER(name) LIKE ?1 OR LOWER(description) LIKE ?1 OR LOWER(tags) LIKE ?1
                 ORDER BY name ASC",
            )?;
            let rows = stmt.query_map(params![search_pattern], |row| {
                Ok(DiscoveredSkillRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    github_url: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    tags: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn clear_discovered_skills(&self) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM discovered_skills", [])?;
            Ok(())
        })
    }

    // AI Agents management
    pub fn add_ai_agent(&self, name: &str, api_key: &str, base_url: &str) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO ai_agents (id, name, api_key, base_url, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, name, api_key, base_url, now, now],
            )?;
            Ok(id)
        })
    }

    pub fn update_ai_agent(&self, id: &str, name: &str, api_key: &str, base_url: &str) -> Result<()> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE ai_agents SET name = ?1, api_key = ?2, base_url = ?3, updated_at = ?4 WHERE id = ?5",
                params![name, api_key, base_url, now, id],
            )?;
            Ok(())
        })
    }

    pub fn remove_ai_agent(&self, id: &str) -> Result<()> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM ai_agents WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    pub fn list_ai_agents(&self) -> Result<Vec<AiAgentRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, api_key, base_url, created_at, updated_at
                 FROM ai_agents
                 ORDER BY created_at ASC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(AiAgentRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    api_key: row.get(2)?,
                    base_url: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?;

            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    #[allow(dead_code)]
    pub fn get_ai_agent_by_id(&self, id: &str) -> Result<Option<AiAgentRecord>> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, api_key, base_url, created_at, updated_at
                 FROM ai_agents
                 WHERE id = ?1
                 LIMIT 1",
            )?;
            let mut rows = stmt.query(params![id])?;
            if let Some(row) = rows.next()? {
                Ok(Some(AiAgentRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    api_key: row.get(2)?,
                    base_url: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                }))
            } else {
                Ok(None)
            }
        })
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = Connection::open(&self.db_path)
            .with_context(|| format!("failed to open db at {:?}", self.db_path))?;
        // Enforce foreign key constraints on every connection (rusqlite PRAGMA is per-connection).
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        f(&conn)
    }
}

pub fn default_db_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf> {
    let app_dir = app
        .path()
        .app_data_dir()
        .context("failed to resolve app data dir")?;
    std::fs::create_dir_all(&app_dir)
        .with_context(|| format!("failed to create app data dir {:?}", app_dir))?;
    Ok(app_dir.join(DB_FILE_NAME))
}

pub fn migrate_legacy_db_if_needed(target_db_path: &Path) -> Result<()> {
    let Some(data_dir) = dirs::data_dir() else {
        return Ok(());
    };

    if let Ok(true) = db_has_any_skills(target_db_path) {
        return Ok(());
    }

    let legacy_db_path = LEGACY_APP_IDENTIFIERS
        .iter()
        .map(|id| data_dir.join(id).join(DB_FILE_NAME))
        .find(|path| path.exists());

    let Some(legacy_db_path) = legacy_db_path else {
        return Ok(());
    };

    if legacy_db_path == target_db_path {
        return Ok(());
    }

    if let Some(parent) = target_db_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("failed to create app data dir {:?}", parent))?;
    }

    if target_db_path.exists() {
        let backup = target_db_path.with_extension(format!(
            "bak-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        ));
        std::fs::rename(target_db_path, &backup).with_context(|| {
            format!(
                "failed to backup existing db {:?} -> {:?}",
                target_db_path, backup
            )
        })?;
    }

    std::fs::copy(&legacy_db_path, target_db_path).with_context(|| {
        format!(
            "failed to migrate legacy db {:?} -> {:?}",
            legacy_db_path, target_db_path
        )
    })?;

    Ok(())
}

fn db_has_any_skills(db_path: &Path) -> Result<bool> {
    if !db_path.exists() {
        return Ok(false);
    }

    let conn =
        Connection::open(db_path).with_context(|| format!("failed to open db at {:?}", db_path))?;
    let has_table: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='skills';",
        [],
        |row| row.get(0),
    )?;
    if has_table == 0 {
        return Ok(false);
    }

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM skills;", [], |row| row.get(0))?;
    Ok(count > 0)
}

#[cfg(test)]
#[path = "tests/skill_store.rs"]
mod tests;
