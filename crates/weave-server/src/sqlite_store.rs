//! SQLite-backed implementation of `weave_engine::MappingStore`.
//!
//! Stores each mapping as a JSON blob keyed by `mapping_id`. A separate
//! `edge_id` column is indexed so the WS handler can cheaply fetch every
//! mapping for a given edge.

use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use sqlx::ConnectOptions;
use std::str::FromStr;

use weave_engine::{Mapping, MappingStore, StoreError};

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
            serde_json::from_str::<Mapping>(&json)
                .map_err(|e| StoreError::Internal(e.to_string()))
        })
        .transpose()
    }

    async fn create_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let json = serde_json::to_string(mapping)
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        sqlx::query(
            "INSERT INTO mappings (mapping_id, edge_id, mapping_json) VALUES (?, ?, ?)",
        )
        .bind(mapping.mapping_id.to_string())
        .bind(&mapping.edge_id)
        .bind(json)
        .execute(&self.pool)
        .await
        .map_err(|e| StoreError::Internal(e.to_string()))?;

        Ok(())
    }

    async fn update_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let json = serde_json::to_string(mapping)
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        let rows = sqlx::query(
            "UPDATE mappings SET edge_id = ?, mapping_json = ? WHERE mapping_id = ?",
        )
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

#[cfg(test)]
mod tests {
    use super::*;
    use weave_engine::{IntentType, InputType, Route, RouteParams};

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
            store.get_mapping(&m.mapping_id).await.unwrap().unwrap().service_target,
            "zone-2"
        );

        assert!(store.delete_mapping(&m.mapping_id).await.unwrap());
    }

    #[tokio::test]
    async fn list_by_edge_filters() {
        let store = fresh_store().await;
        store.create_mapping(&sample_mapping("living-room")).await.unwrap();
        store.create_mapping(&sample_mapping("bedroom")).await.unwrap();

        let living = store.list_by_edge("living-room").await.unwrap();
        assert_eq!(living.len(), 1);
        assert_eq!(living[0].edge_id, "living-room");
    }
}
