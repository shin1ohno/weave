//! SQLite-backed implementation of `weave_engine::MappingStore`.
//!
//! Stores each mapping as a JSON blob keyed by `mapping_id`. A separate
//! `edge_id` column is indexed so the WS handler can cheaply fetch every
//! mapping for a given edge.

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use sqlx::ConnectOptions;
use std::str::FromStr;

use weave_contracts::Glyph;
use weave_engine::mapping::{DeviceCycle, FeedbackRule};
use weave_engine::route::Route;
use weave_engine::{Mapping, MappingStore, StoreError, Template, TemplateStore};

pub struct SqliteStore {
    pool: SqlitePool,
}

impl SqliteStore {
    pub async fn connect(database_url: &str) -> anyhow::Result<Self> {
        let opts = SqliteConnectOptions::from_str(database_url)?
            .create_if_missing(true)
            .disable_statement_logging();
        let pool = SqlitePool::connect_with(opts).await?;
        sqlx::migrate!("./migrations").run(&pool).await?;
        Ok(Self { pool })
    }

    /// List every glyph stored in the registry.
    pub async fn list_glyphs(&self) -> Result<Vec<Glyph>, StoreError> {
        let rows: Vec<(String, String, i64)> =
            sqlx::query_as("SELECT name, pattern, builtin FROM glyphs ORDER BY name")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(rows
            .into_iter()
            .map(|(name, pattern, builtin)| Glyph {
                name,
                pattern,
                builtin: builtin != 0,
            })
            .collect())
    }

    pub async fn get_glyph(&self, name: &str) -> Result<Option<Glyph>, StoreError> {
        let row: Option<(String, String, i64)> =
            sqlx::query_as("SELECT name, pattern, builtin FROM glyphs WHERE name = ?")
                .bind(name)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(row.map(|(name, pattern, builtin)| Glyph {
            name,
            pattern,
            builtin: builtin != 0,
        }))
    }

    pub async fn upsert_glyph(&self, glyph: &Glyph) -> Result<(), StoreError> {
        sqlx::query(
            "INSERT INTO glyphs (name, pattern, builtin) VALUES (?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET pattern = excluded.pattern, builtin = excluded.builtin",
        )
        .bind(&glyph.name)
        .bind(&glyph.pattern)
        .bind(i64::from(glyph.builtin))
        .execute(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_glyph(&self, name: &str) -> Result<bool, StoreError> {
        let rows = sqlx::query("DELETE FROM glyphs WHERE name = ?")
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?
            .rows_affected();
        Ok(rows > 0)
    }

    /// List every device cycle row.
    pub async fn list_cycles(&self) -> Result<Vec<DeviceCycle>, StoreError> {
        let rows: Vec<DeviceCycleRow> = sqlx::query_as(
            "SELECT device_type, device_id, cycle_gesture, active_mapping_id, mapping_ids_json \
             FROM device_cycles",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        rows.into_iter().map(row_to_cycle).collect()
    }

    /// Fetch the cycle row for one device, if any.
    pub async fn get_cycle(
        &self,
        device_type: &str,
        device_id: &str,
    ) -> Result<Option<DeviceCycle>, StoreError> {
        let row: Option<DeviceCycleRow> = sqlx::query_as(
            "SELECT device_type, device_id, cycle_gesture, active_mapping_id, mapping_ids_json \
             FROM device_cycles WHERE device_type = ? AND device_id = ?",
        )
        .bind(device_type)
        .bind(device_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        row.map(row_to_cycle).transpose()
    }

    /// Insert or replace a cycle row.
    pub async fn upsert_cycle(&self, cycle: &DeviceCycle) -> Result<(), StoreError> {
        let mapping_ids_json = serde_json::to_string(&cycle.mapping_ids)
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        sqlx::query(
            "INSERT INTO device_cycles \
             (device_type, device_id, cycle_gesture, active_mapping_id, mapping_ids_json) \
             VALUES (?, ?, ?, ?, ?) \
             ON CONFLICT(device_type, device_id) DO UPDATE SET \
                cycle_gesture = excluded.cycle_gesture, \
                active_mapping_id = excluded.active_mapping_id, \
                mapping_ids_json = excluded.mapping_ids_json",
        )
        .bind(&cycle.device_type)
        .bind(&cycle.device_id)
        .bind(cycle.cycle_gesture.as_deref())
        .bind(cycle.active_mapping_id.map(|u| u.to_string()))
        .bind(mapping_ids_json)
        .execute(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(())
    }

    /// Update only the active mapping ID. Returns false if no row exists
    /// for the given device.
    pub async fn set_cycle_active(
        &self,
        device_type: &str,
        device_id: &str,
        active_mapping_id: uuid::Uuid,
    ) -> Result<bool, StoreError> {
        let rows = sqlx::query(
            "UPDATE device_cycles SET active_mapping_id = ? \
             WHERE device_type = ? AND device_id = ?",
        )
        .bind(active_mapping_id.to_string())
        .bind(device_type)
        .bind(device_id)
        .execute(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?
        .rows_affected();
        Ok(rows > 0)
    }

    /// Delete a cycle row.
    pub async fn delete_cycle(
        &self,
        device_type: &str,
        device_id: &str,
    ) -> Result<bool, StoreError> {
        let rows = sqlx::query("DELETE FROM device_cycles WHERE device_type = ? AND device_id = ?")
            .bind(device_type)
            .bind(device_id)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?
            .rows_affected();
        Ok(rows > 0)
    }

    /// Fetch every mapping belonging to `edge_id`. Used by `/ws/edge` to build
    /// the initial `config_full` frame.
    pub async fn list_by_edge(&self, edge_id: &str) -> Result<Vec<Mapping>, StoreError> {
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT mapping_json FROM mappings WHERE edge_id = ?")
                .bind(edge_id)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| StoreError::Internal(e.to_string()))?;

        rows.into_iter()
            .map(|(json,)| {
                serde_json::from_str::<Mapping>(&json)
                    .map_err(|e| StoreError::Internal(e.to_string()))
            })
            .collect()
    }
}

#[async_trait::async_trait]
impl MappingStore for SqliteStore {
    async fn list_mappings(&self) -> Result<Vec<Mapping>, StoreError> {
        let rows: Vec<(String,)> = sqlx::query_as("SELECT mapping_json FROM mappings")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        rows.into_iter()
            .map(|(json,)| {
                serde_json::from_str::<Mapping>(&json)
                    .map_err(|e| StoreError::Internal(e.to_string()))
            })
            .collect()
    }

    async fn get_mapping(&self, id: &uuid::Uuid) -> Result<Option<Mapping>, StoreError> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT mapping_json FROM mappings WHERE mapping_id = ?")
                .bind(id.to_string())
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| StoreError::Internal(e.to_string()))?;

        row.map(|(json,)| {
            serde_json::from_str::<Mapping>(&json).map_err(|e| StoreError::Internal(e.to_string()))
        })
        .transpose()
    }

    async fn create_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let json =
            serde_json::to_string(mapping).map_err(|e| StoreError::Internal(e.to_string()))?;

        sqlx::query("INSERT INTO mappings (mapping_id, edge_id, mapping_json) VALUES (?, ?, ?)")
            .bind(mapping.mapping_id.to_string())
            .bind(&mapping.edge_id)
            .bind(json)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        Ok(())
    }

    async fn update_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let json =
            serde_json::to_string(mapping).map_err(|e| StoreError::Internal(e.to_string()))?;

        let rows =
            sqlx::query("UPDATE mappings SET edge_id = ?, mapping_json = ? WHERE mapping_id = ?")
                .bind(&mapping.edge_id)
                .bind(json)
                .bind(mapping.mapping_id.to_string())
                .execute(&self.pool)
                .await
                .map_err(|e| StoreError::Internal(e.to_string()))?
                .rows_affected();

        if rows == 0 {
            return Err(StoreError::NotFound(mapping.mapping_id.to_string()));
        }
        Ok(())
    }

    async fn delete_mapping(&self, id: &uuid::Uuid) -> Result<bool, StoreError> {
        let rows = sqlx::query("DELETE FROM mappings WHERE mapping_id = ?")
            .bind(id.to_string())
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?
            .rows_affected();

        Ok(rows > 0)
    }
}

/// (device_type, device_id, cycle_gesture, active_mapping_id, mapping_ids_json)
type DeviceCycleRow = (String, String, Option<String>, Option<String>, String);

fn row_to_cycle(row: DeviceCycleRow) -> Result<DeviceCycle, StoreError> {
    let (device_type, device_id, cycle_gesture, active_mapping_id, mapping_ids_json) = row;
    let mapping_ids: Vec<uuid::Uuid> = serde_json::from_str(&mapping_ids_json)
        .map_err(|e| StoreError::Internal(format!("device_cycles mapping_ids_json: {e}")))?;
    let active_mapping_id = active_mapping_id
        .as_deref()
        .map(uuid::Uuid::parse_str)
        .transpose()
        .map_err(|e| StoreError::Internal(format!("device_cycles active_mapping_id: {e}")))?;
    Ok(DeviceCycle {
        device_type,
        device_id,
        mapping_ids,
        active_mapping_id,
        cycle_gesture,
    })
}

/// Tuple shape returned by every `SELECT … FROM templates` query.
type TemplateRow = (
    String,
    String,
    String,
    String,
    i64,
    String,
    String,
    String,
    String,
);

fn row_to_template(row: TemplateRow) -> Result<Template, StoreError> {
    let (id, label, description, icon, builtin, domain, routes_json, feedback_json, created_at) =
        row;
    let routes: Vec<Route> = serde_json::from_str(&routes_json)
        .map_err(|e| StoreError::Internal(format!("template routes json: {e}")))?;
    let feedback: Vec<FeedbackRule> = serde_json::from_str(&feedback_json)
        .map_err(|e| StoreError::Internal(format!("template feedback json: {e}")))?;
    Ok(Template {
        id,
        label,
        description,
        icon,
        builtin: builtin != 0,
        domain,
        routes,
        feedback,
        created_at,
    })
}

#[async_trait::async_trait]
impl TemplateStore for SqliteStore {
    async fn list_templates(&self) -> Result<Vec<Template>, StoreError> {
        let rows: Vec<TemplateRow> = sqlx::query_as(
            "SELECT id, label, description, icon, builtin, domain, routes_json, feedback_json, created_at \
             FROM templates ORDER BY builtin DESC, label",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        rows.into_iter().map(row_to_template).collect()
    }

    async fn get_template(&self, id: &str) -> Result<Option<Template>, StoreError> {
        let row: Option<TemplateRow> = sqlx::query_as(
            "SELECT id, label, description, icon, builtin, domain, routes_json, feedback_json, created_at \
             FROM templates WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        row.map(row_to_template).transpose()
    }

    async fn upsert_template(&self, t: &Template) -> Result<(), StoreError> {
        let routes_json = serde_json::to_string(&t.routes)
            .map_err(|e| StoreError::Internal(format!("template routes json: {e}")))?;
        let feedback_json = serde_json::to_string(&t.feedback)
            .map_err(|e| StoreError::Internal(format!("template feedback json: {e}")))?;
        sqlx::query(
            "INSERT INTO templates (id, label, description, icon, builtin, domain, routes_json, feedback_json, created_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
             ON CONFLICT(id) DO UPDATE SET \
                label = excluded.label, \
                description = excluded.description, \
                icon = excluded.icon, \
                builtin = excluded.builtin, \
                domain = excluded.domain, \
                routes_json = excluded.routes_json, \
                feedback_json = excluded.feedback_json, \
                created_at = excluded.created_at",
        )
        .bind(&t.id)
        .bind(&t.label)
        .bind(&t.description)
        .bind(&t.icon)
        .bind(i64::from(t.builtin))
        .bind(&t.domain)
        .bind(routes_json)
        .bind(feedback_json)
        .bind(&t.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(())
    }

    async fn delete_template(&self, id: &str) -> Result<bool, StoreError> {
        let rows = sqlx::query("DELETE FROM templates WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Internal(e.to_string()))?
            .rows_affected();
        Ok(rows > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use weave_engine::{InputType, IntentType, Route, RouteParams};

    async fn fresh_store() -> SqliteStore {
        SqliteStore::connect("sqlite::memory:").await.unwrap()
    }

    fn sample_mapping(edge_id: &str) -> Mapping {
        let mut m = Mapping::new(
            "nuimo",
            "C3:81:DF:4E",
            "roon",
            "zone-1",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        );
        m.edge_id = edge_id.to_string();
        m
    }

    #[tokio::test]
    async fn crud_roundtrip() {
        let store = fresh_store().await;
        let m = sample_mapping("living-room");

        store.create_mapping(&m).await.unwrap();
        assert_eq!(store.list_mappings().await.unwrap().len(), 1);

        let got = store.get_mapping(&m.mapping_id).await.unwrap().unwrap();
        assert_eq!(got.edge_id, "living-room");

        let mut updated = got.clone();
        updated.service_target = "zone-2".into();
        store.update_mapping(&updated).await.unwrap();
        assert_eq!(
            store
                .get_mapping(&m.mapping_id)
                .await
                .unwrap()
                .unwrap()
                .service_target,
            "zone-2"
        );

        assert!(store.delete_mapping(&m.mapping_id).await.unwrap());
    }

    #[tokio::test]
    async fn list_by_edge_filters() {
        let store = fresh_store().await;
        store
            .create_mapping(&sample_mapping("living-room"))
            .await
            .unwrap();
        store
            .create_mapping(&sample_mapping("bedroom"))
            .await
            .unwrap();

        let living = store.list_by_edge("living-room").await.unwrap();
        assert_eq!(living.len(), 1);
        assert_eq!(living[0].edge_id, "living-room");
    }

    fn sample_template(id: &str, builtin: bool) -> Template {
        Template {
            id: id.into(),
            label: "Test".into(),
            description: "test template".into(),
            icon: "play".into(),
            builtin,
            domain: "playback".into(),
            routes: vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
            feedback: vec![],
            created_at: "2026-04-26T00:00:00Z".into(),
        }
    }

    #[tokio::test]
    async fn template_crud_roundtrip() {
        let store = fresh_store().await;
        let t = sample_template("playback", true);
        store.upsert_template(&t).await.unwrap();

        let listed = store.list_templates().await.unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, "playback");
        assert_eq!(listed[0].routes.len(), 1);

        let got = store.get_template("playback").await.unwrap().unwrap();
        assert_eq!(got, t);

        assert!(store.delete_template("playback").await.unwrap());
        assert!(store.get_template("playback").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn template_upsert_is_idempotent() {
        let store = fresh_store().await;
        let t = sample_template("playback", true);
        store.upsert_template(&t).await.unwrap();
        store.upsert_template(&t).await.unwrap();
        store.upsert_template(&t).await.unwrap();

        let listed = store.list_templates().await.unwrap();
        assert_eq!(listed.len(), 1);
    }
}
