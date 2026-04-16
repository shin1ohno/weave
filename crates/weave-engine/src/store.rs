use std::collections::HashMap;
use std::sync::Mutex;

use crate::mapping::Mapping;

/// Trait for persisting mappings.
#[async_trait::async_trait]
pub trait MappingStore: Send + Sync + 'static {
    async fn list_mappings(&self) -> Result<Vec<Mapping>, StoreError>;
    async fn get_mapping(&self, id: &uuid::Uuid) -> Result<Option<Mapping>, StoreError>;
    async fn create_mapping(&self, mapping: &Mapping) -> Result<(), StoreError>;
    async fn update_mapping(&self, mapping: &Mapping) -> Result<(), StoreError>;
    async fn delete_mapping(&self, id: &uuid::Uuid) -> Result<bool, StoreError>;
}

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("storage error: {0}")]
    Internal(String),
    #[error("not found: {0}")]
    NotFound(String),
}

/// In-memory store for testing and development.
#[derive(Default)]
pub struct MemoryStore {
    mappings: Mutex<HashMap<uuid::Uuid, Mapping>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait::async_trait]
impl MappingStore for MemoryStore {
    async fn list_mappings(&self) -> Result<Vec<Mapping>, StoreError> {
        let mappings = self.mappings.lock().unwrap();
        Ok(mappings.values().cloned().collect())
    }

    async fn get_mapping(&self, id: &uuid::Uuid) -> Result<Option<Mapping>, StoreError> {
        let mappings = self.mappings.lock().unwrap();
        Ok(mappings.get(id).cloned())
    }

    async fn create_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let mut mappings = self.mappings.lock().unwrap();
        mappings.insert(mapping.mapping_id, mapping.clone());
        Ok(())
    }

    async fn update_mapping(&self, mapping: &Mapping) -> Result<(), StoreError> {
        let mut mappings = self.mappings.lock().unwrap();
        if mappings.contains_key(&mapping.mapping_id) {
            mappings.insert(mapping.mapping_id, mapping.clone());
            Ok(())
        } else {
            Err(StoreError::NotFound(mapping.mapping_id.to_string()))
        }
    }

    async fn delete_mapping(&self, id: &uuid::Uuid) -> Result<bool, StoreError> {
        let mut mappings = self.mappings.lock().unwrap();
        Ok(mappings.remove(id).is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mapping::Mapping;
    use crate::primitives::InputType;
    use crate::intents::IntentType;
    use crate::route::{Route, RouteParams};

    fn test_mapping() -> Mapping {
        Mapping::new(
            "nuimo",
            "C3:81:DF:4E",
            "roon",
            "zone-1",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        )
    }

    #[tokio::test]
    async fn test_crud() {
        let store = MemoryStore::new();

        // Create
        let m = test_mapping();
        store.create_mapping(&m).await.unwrap();

        // List
        let all = store.list_mappings().await.unwrap();
        assert_eq!(all.len(), 1);

        // Get
        let got = store.get_mapping(&m.mapping_id).await.unwrap().unwrap();
        assert_eq!(got.device_id, "C3:81:DF:4E");

        // Update
        let mut updated = m.clone();
        updated.service_target = "zone-2".to_string();
        store.update_mapping(&updated).await.unwrap();
        let got = store.get_mapping(&m.mapping_id).await.unwrap().unwrap();
        assert_eq!(got.service_target, "zone-2");

        // Delete
        assert!(store.delete_mapping(&m.mapping_id).await.unwrap());
        assert!(store.list_mappings().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_update_not_found() {
        let store = MemoryStore::new();
        let m = test_mapping();
        let result = store.update_mapping(&m).await;
        assert!(matches!(result, Err(StoreError::NotFound(_))));
    }
}
