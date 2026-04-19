use std::sync::Arc;
use tokio::sync::RwLock;

use crate::intents::Intent;
use crate::mapping::Mapping;
use crate::primitives::InputPrimitive;

/// Output of the routing engine: an intent bound to a specific service target.
#[derive(Debug, Clone)]
pub struct RoutedIntent {
    pub service_type: String,
    pub service_target: String,
    pub intent: Intent,
    /// Source device info (for feedback routing).
    pub device_type: String,
    pub device_id: String,
}

/// The core routing engine. Holds mappings in memory and routes input events to intents.
pub struct RoutingEngine {
    mappings: Arc<RwLock<Vec<Mapping>>>,
}

impl RoutingEngine {
    pub fn new() -> Self {
        Self {
            mappings: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Load mappings (e.g., from DB on startup).
    pub async fn load_mappings(&self, mappings: Vec<Mapping>) {
        *self.mappings.write().await = mappings;
    }

    /// Add or update a mapping.
    pub async fn upsert_mapping(&self, mapping: Mapping) {
        let mut mappings = self.mappings.write().await;
        if let Some(pos) = mappings
            .iter()
            .position(|m| m.mapping_id == mapping.mapping_id)
        {
            mappings[pos] = mapping;
        } else {
            mappings.push(mapping);
        }
    }

    /// Remove a mapping by ID.
    pub async fn remove_mapping(&self, mapping_id: uuid::Uuid) -> bool {
        let mut mappings = self.mappings.write().await;
        let len_before = mappings.len();
        mappings.retain(|m| m.mapping_id != mapping_id);
        mappings.len() < len_before
    }

    /// Get all mappings.
    pub async fn list_mappings(&self) -> Vec<Mapping> {
        self.mappings.read().await.clone()
    }

    /// Route an input event from a device. Returns all matching intents.
    pub async fn route(
        &self,
        device_type: &str,
        device_id: &str,
        input: &InputPrimitive,
    ) -> Vec<RoutedIntent> {
        let mappings = self.mappings.read().await;
        let mut results = Vec::new();

        for mapping in mappings.iter() {
            if mapping.device_type != device_type || mapping.device_id != device_id {
                continue;
            }
            if let Some(intent) = mapping.route(input) {
                results.push(RoutedIntent {
                    service_type: mapping.service_type.clone(),
                    service_target: mapping.service_target.clone(),
                    intent,
                    device_type: mapping.device_type.clone(),
                    device_id: mapping.device_id.clone(),
                });
            }
        }

        results
    }

    /// Update the service_target for a mapping (zone/target switch).
    pub async fn switch_target(&self, mapping_id: uuid::Uuid, new_target: &str) -> bool {
        let mut mappings = self.mappings.write().await;
        if let Some(mapping) = mappings.iter_mut().find(|m| m.mapping_id == mapping_id) {
            mapping.service_target = new_target.to_string();
            true
        } else {
            false
        }
    }
}

impl Default for RoutingEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::intents::IntentType;
    use crate::primitives::{Direction, InputType};
    use crate::route::{Route, RouteParams};

    fn test_mapping() -> Mapping {
        Mapping::new(
            "nuimo",
            "C3:81:DF:4E:FF:6A",
            "roon",
            "zone-living",
            vec![
                Route {
                    input: InputType::Rotate,
                    intent: IntentType::VolumeChange,
                    params: RouteParams { damping: 80.0 },
                },
                Route {
                    input: InputType::Press,
                    intent: IntentType::PlayPause,
                    params: RouteParams::default(),
                },
                Route {
                    input: InputType::SwipeRight,
                    intent: IntentType::Next,
                    params: RouteParams::default(),
                },
                Route {
                    input: InputType::SwipeLeft,
                    intent: IntentType::Previous,
                    params: RouteParams::default(),
                },
            ],
        )
    }

    #[tokio::test]
    async fn test_route_rotate_to_volume() {
        let engine = RoutingEngine::new();
        engine.load_mappings(vec![test_mapping()]).await;

        let results = engine
            .route(
                "nuimo",
                "C3:81:DF:4E:FF:6A",
                &InputPrimitive::Rotate { delta: 0.05 },
            )
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].service_type, "roon");
        match &results[0].intent {
            Intent::VolumeChange { delta } => assert!((delta - 4.0).abs() < 0.001),
            _ => panic!("expected VolumeChange"),
        }
    }

    #[tokio::test]
    async fn test_route_press_to_playpause() {
        let engine = RoutingEngine::new();
        engine.load_mappings(vec![test_mapping()]).await;

        let results = engine
            .route("nuimo", "C3:81:DF:4E:FF:6A", &InputPrimitive::Press)
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].intent, Intent::PlayPause);
    }

    #[tokio::test]
    async fn test_route_swipe_to_next() {
        let engine = RoutingEngine::new();
        engine.load_mappings(vec![test_mapping()]).await;

        let results = engine
            .route(
                "nuimo",
                "C3:81:DF:4E:FF:6A",
                &InputPrimitive::Swipe {
                    direction: Direction::Right,
                },
            )
            .await;

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].intent, Intent::Next);
    }

    #[tokio::test]
    async fn test_no_match_wrong_device() {
        let engine = RoutingEngine::new();
        engine.load_mappings(vec![test_mapping()]).await;

        let results = engine
            .route("streamdeck", "sd-1", &InputPrimitive::Press)
            .await;

        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_inactive_mapping_skipped() {
        let engine = RoutingEngine::new();
        let mut mapping = test_mapping();
        mapping.active = false;
        engine.load_mappings(vec![mapping]).await;

        let results = engine
            .route("nuimo", "C3:81:DF:4E:FF:6A", &InputPrimitive::Press)
            .await;

        assert!(results.is_empty());
    }

    #[tokio::test]
    async fn test_switch_target() {
        let engine = RoutingEngine::new();
        let mapping = test_mapping();
        let id = mapping.mapping_id;
        engine.load_mappings(vec![mapping]).await;

        assert!(engine.switch_target(id, "zone-kitchen").await);

        let results = engine
            .route("nuimo", "C3:81:DF:4E:FF:6A", &InputPrimitive::Press)
            .await;

        assert_eq!(results[0].service_target, "zone-kitchen");
    }

    #[tokio::test]
    async fn test_multiple_mappings_same_device() {
        let engine = RoutingEngine::new();
        let m1 = Mapping::new(
            "nuimo",
            "C3:81:DF:4E:FF:6A",
            "roon",
            "zone-1",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        );
        let m2 = Mapping::new(
            "nuimo",
            "C3:81:DF:4E:FF:6A",
            "hue",
            "living-room",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PowerToggle,
                params: RouteParams::default(),
            }],
        );
        engine.load_mappings(vec![m1, m2]).await;

        let results = engine
            .route("nuimo", "C3:81:DF:4E:FF:6A", &InputPrimitive::Press)
            .await;

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].intent, Intent::PlayPause);
        assert_eq!(results[1].intent, Intent::PowerToggle);
    }
}
