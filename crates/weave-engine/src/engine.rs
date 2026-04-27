use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::intents::Intent;
use crate::mapping::{DeviceCycle, Mapping};
use crate::primitives::{Direction, InputPrimitive, TouchArea};

/// Output of `RoutingEngine::route`. `Dispatch` carries an intent bound to
/// a service target; `CycleSwitch` is a sentinel emitted when an input
/// matches the device's `cycle_gesture` — the dispatcher acts on it by
/// advancing `DeviceCycle.active_mapping_id` and broadcasting the change
/// rather than executing an adapter intent.
#[derive(Debug, Clone)]
pub enum RoutedIntent {
    Dispatch {
        service_type: String,
        service_target: String,
        intent: Intent,
        /// Source device info (for feedback routing).
        device_type: String,
        device_id: String,
    },
    /// The input matched a device's `cycle_gesture`. The dispatcher
    /// should advance the cycle's active mapping (using
    /// `DeviceCycle::next_active`), persist + broadcast, and NOT route
    /// the input through any mapping's intents.
    CycleSwitch {
        device_type: String,
        device_id: String,
        /// The mapping ID that should become active after the switch.
        next_active_mapping_id: uuid::Uuid,
    },
}

impl RoutedIntent {
    /// Convenience accessor for the legacy `service_type` field. Returns
    /// `None` for `CycleSwitch` (which has no associated service).
    pub fn service_type(&self) -> Option<&str> {
        match self {
            RoutedIntent::Dispatch { service_type, .. } => Some(service_type.as_str()),
            RoutedIntent::CycleSwitch { .. } => None,
        }
    }

    /// Convenience accessor for the legacy `service_target` field.
    pub fn service_target(&self) -> Option<&str> {
        match self {
            RoutedIntent::Dispatch { service_target, .. } => Some(service_target.as_str()),
            RoutedIntent::CycleSwitch { .. } => None,
        }
    }
}

/// The core routing engine. Holds mappings + device cycles in memory and
/// routes input events.
pub struct RoutingEngine {
    mappings: Arc<RwLock<Vec<Mapping>>>,
    cycles: Arc<RwLock<HashMap<(String, String), DeviceCycle>>>,
}

impl RoutingEngine {
    pub fn new() -> Self {
        Self {
            mappings: Arc::new(RwLock::new(Vec::new())),
            cycles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Load mappings (e.g., from DB on startup).
    pub async fn load_mappings(&self, mappings: Vec<Mapping>) {
        *self.mappings.write().await = mappings;
    }

    /// Load device cycles (e.g., from DB on startup).
    pub async fn load_cycles(&self, cycles: Vec<DeviceCycle>) {
        let mut map = self.cycles.write().await;
        map.clear();
        for c in cycles {
            map.insert((c.device_type.clone(), c.device_id.clone()), c);
        }
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

    /// Insert or replace a device cycle.
    pub async fn upsert_cycle(&self, cycle: DeviceCycle) {
        let key = (cycle.device_type.clone(), cycle.device_id.clone());
        self.cycles.write().await.insert(key, cycle);
    }

    /// Remove a device's cycle. Returns true if a cycle row existed.
    pub async fn remove_cycle(&self, device_type: &str, device_id: &str) -> bool {
        let key = (device_type.to_string(), device_id.to_string());
        self.cycles.write().await.remove(&key).is_some()
    }

    /// Update only the active mapping ID of an existing cycle. Returns
    /// false if no cycle exists for the device or `active_mapping_id`
    /// is not in `mapping_ids`.
    pub async fn set_active(
        &self,
        device_type: &str,
        device_id: &str,
        active_mapping_id: uuid::Uuid,
    ) -> bool {
        let key = (device_type.to_string(), device_id.to_string());
        let mut cycles = self.cycles.write().await;
        let Some(cycle) = cycles.get_mut(&key) else {
            return false;
        };
        if !cycle.mapping_ids.contains(&active_mapping_id) {
            return false;
        }
        cycle.active_mapping_id = Some(active_mapping_id);
        true
    }

    /// Get all device cycles.
    pub async fn list_cycles(&self) -> Vec<DeviceCycle> {
        self.cycles.read().await.values().cloned().collect()
    }

    /// Route an input event from a device. Returns all matching intents.
    ///
    /// When the device has a `DeviceCycle`:
    ///   - If the input matches `cycle_gesture`, returns a single
    ///     `CycleSwitch` sentinel and routes nothing else.
    ///   - Otherwise, only the mapping whose `mapping_id == active_mapping_id`
    ///     gets a chance to route. Other cycle members and non-cycle mappings
    ///     for the same device sit dormant.
    ///
    /// When the device has no cycle, all matching mappings fire (existing
    /// "all-fire" behavior preserved for backward compatibility).
    pub async fn route(
        &self,
        device_type: &str,
        device_id: &str,
        input: &InputPrimitive,
    ) -> Vec<RoutedIntent> {
        let cycles = self.cycles.read().await;
        let cycle = cycles.get(&(device_type.to_string(), device_id.to_string()));

        // Cycle-gesture short-circuit: input matches the gesture → switch
        // sentinel, no routing. Caller (the dispatcher) acts on the
        // sentinel by advancing active and broadcasting.
        if let Some(cycle) = cycle {
            if let Some(gesture) = cycle.cycle_gesture.as_deref() {
                if gesture_tag(input) == gesture {
                    if let Some(next) = cycle.next_active() {
                        return vec![RoutedIntent::CycleSwitch {
                            device_type: device_type.to_string(),
                            device_id: device_id.to_string(),
                            next_active_mapping_id: next,
                        }];
                    }
                }
            }
        }

        let active_filter: Option<uuid::Uuid> = cycle.and_then(|c| c.active_mapping_id);

        let mappings = self.mappings.read().await;
        let mut results = Vec::new();

        for mapping in mappings.iter() {
            if mapping.device_type != device_type || mapping.device_id != device_id {
                continue;
            }
            // When the device has a cycle, only the active mapping fires
            // (and only if it's a cycle member). Mappings not in the
            // cycle's mapping_ids list are also dormant — the cycle
            // claims the device.
            if let Some(cycle) = cycle {
                if !cycle.mapping_ids.contains(&mapping.mapping_id) {
                    continue;
                }
                match active_filter {
                    Some(active_id) if active_id == mapping.mapping_id => {}
                    _ => continue,
                }
            }
            if let Some(intent) = mapping.route(input) {
                results.push(RoutedIntent::Dispatch {
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
    /// Retained for callers that still drive the legacy in-mapping
    /// target switch path; cycle-based switching uses `set_active`.
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

/// Snake-case wire tag for an `InputPrimitive` variant. Matches
/// `weave_engine::primitives::InputType`'s serde representation so the
/// `cycle_gesture` string set by the user lines up with what the runtime
/// observes. Note: `KeyPress { key }` collapses to just `"key_press"` —
/// per-key cycle gestures aren't supported and would need a richer
/// `cycle_gesture` shape.
fn gesture_tag(input: &InputPrimitive) -> &'static str {
    match input {
        InputPrimitive::Rotate { .. } => "rotate",
        InputPrimitive::Press => "press",
        InputPrimitive::Release => "release",
        InputPrimitive::LongPress => "long_press",
        InputPrimitive::Swipe {
            direction: Direction::Up,
        } => "swipe_up",
        InputPrimitive::Swipe {
            direction: Direction::Down,
        } => "swipe_down",
        InputPrimitive::Swipe {
            direction: Direction::Left,
        } => "swipe_left",
        InputPrimitive::Swipe {
            direction: Direction::Right,
        } => "swipe_right",
        InputPrimitive::Slide { .. } => "slide",
        InputPrimitive::Hover { .. } => "hover",
        InputPrimitive::Touch {
            area: TouchArea::Top,
        } => "touch_top",
        InputPrimitive::Touch {
            area: TouchArea::Bottom,
        } => "touch_bottom",
        InputPrimitive::Touch {
            area: TouchArea::Left,
        } => "touch_left",
        InputPrimitive::Touch {
            area: TouchArea::Right,
        } => "touch_right",
        InputPrimitive::LongTouch {
            area: TouchArea::Top,
        } => "long_touch_top",
        InputPrimitive::LongTouch {
            area: TouchArea::Bottom,
        } => "long_touch_bottom",
        InputPrimitive::LongTouch {
            area: TouchArea::Left,
        } => "long_touch_left",
        InputPrimitive::LongTouch {
            area: TouchArea::Right,
        } => "long_touch_right",
        InputPrimitive::KeyPress { .. } => "key_press",
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

    /// Pattern-match helper: extract the Dispatch tuple, panic on
    /// CycleSwitch (caller asserts behavior class first).
    fn dispatch_of(r: &RoutedIntent) -> (&str, &str, &Intent) {
        match r {
            RoutedIntent::Dispatch {
                service_type,
                service_target,
                intent,
                ..
            } => (service_type.as_str(), service_target.as_str(), intent),
            RoutedIntent::CycleSwitch { .. } => panic!("expected Dispatch, got CycleSwitch"),
        }
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
        let (service_type, _, intent) = dispatch_of(&results[0]);
        assert_eq!(service_type, "roon");
        match intent {
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
        let (_, _, intent) = dispatch_of(&results[0]);
        assert_eq!(intent, &Intent::PlayPause);
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
        let (_, _, intent) = dispatch_of(&results[0]);
        assert_eq!(intent, &Intent::Next);
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

        let (_, target, _) = dispatch_of(&results[0]);
        assert_eq!(target, "zone-kitchen");
    }

    #[tokio::test]
    async fn test_multiple_mappings_same_device_no_cycle_all_fire() {
        // Backward-compat: a device without a DeviceCycle still fires
        // every matching mapping. Preserves existing behavior for users
        // who set up parallel mappings deliberately.
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
        let (_, _, intent_a) = dispatch_of(&results[0]);
        let (_, _, intent_b) = dispatch_of(&results[1]);
        assert_eq!(intent_a, &Intent::PlayPause);
        assert_eq!(intent_b, &Intent::PowerToggle);
    }

    #[tokio::test]
    async fn cycle_filter_routes_only_to_active() {
        // With a DeviceCycle in place, Press should fire only the active
        // mapping (Roon zone-1), not the cycle's other entry (Hue) or any
        // unrelated mapping.
        let engine = RoutingEngine::new();
        let m1 = Mapping::new(
            "nuimo",
            "dev-1",
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
            "dev-1",
            "hue",
            "light-living",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PowerToggle,
                params: RouteParams::default(),
            }],
        );
        let id1 = m1.mapping_id;
        let id2 = m2.mapping_id;
        engine.load_mappings(vec![m1, m2]).await;
        engine
            .upsert_cycle(DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![id1, id2],
                active_mapping_id: Some(id1),
                cycle_gesture: Some("swipe_up".into()),
            })
            .await;

        let results = engine.route("nuimo", "dev-1", &InputPrimitive::Press).await;
        assert_eq!(results.len(), 1, "only active mapping should fire");
        let (service_type, _, intent) = dispatch_of(&results[0]);
        assert_eq!(service_type, "roon");
        assert_eq!(intent, &Intent::PlayPause);

        // After switching active to m2, Press should fire Hue power_toggle
        // and NOT Roon play_pause.
        assert!(engine.set_active("nuimo", "dev-1", id2).await);
        let results = engine.route("nuimo", "dev-1", &InputPrimitive::Press).await;
        assert_eq!(results.len(), 1);
        let (service_type, _, intent) = dispatch_of(&results[0]);
        assert_eq!(service_type, "hue");
        assert_eq!(intent, &Intent::PowerToggle);
    }

    #[tokio::test]
    async fn cycle_gesture_returns_switch_sentinel_and_advances() {
        // Input matching the cycle_gesture should return CycleSwitch with
        // the next mapping id, not Dispatch.
        let engine = RoutingEngine::new();
        let m1 = Mapping::new(
            "nuimo",
            "dev-1",
            "roon",
            "zone-1",
            vec![Route {
                input: InputType::SwipeUp,
                intent: IntentType::Next,
                params: RouteParams::default(),
            }],
        );
        let m2 = Mapping::new("nuimo", "dev-1", "hue", "light-1", vec![]);
        let m3 = Mapping::new("nuimo", "dev-1", "ios_media", "now-playing", vec![]);
        let (id1, id2, id3) = (m1.mapping_id, m2.mapping_id, m3.mapping_id);
        engine.load_mappings(vec![m1, m2, m3]).await;
        engine
            .upsert_cycle(DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![id1, id2, id3],
                active_mapping_id: Some(id1),
                cycle_gesture: Some("swipe_up".into()),
            })
            .await;

        let results = engine
            .route(
                "nuimo",
                "dev-1",
                &InputPrimitive::Swipe {
                    direction: Direction::Up,
                },
            )
            .await;
        assert_eq!(results.len(), 1);
        match &results[0] {
            RoutedIntent::CycleSwitch {
                next_active_mapping_id,
                ..
            } => assert_eq!(*next_active_mapping_id, id2),
            _ => panic!("expected CycleSwitch sentinel for cycle_gesture input"),
        }

        // Cycle wraps: from id3, next is id1.
        assert!(engine.set_active("nuimo", "dev-1", id3).await);
        let results = engine
            .route(
                "nuimo",
                "dev-1",
                &InputPrimitive::Swipe {
                    direction: Direction::Up,
                },
            )
            .await;
        match &results[0] {
            RoutedIntent::CycleSwitch {
                next_active_mapping_id,
                ..
            } => assert_eq!(*next_active_mapping_id, id1),
            _ => panic!("expected CycleSwitch sentinel"),
        }
    }

    #[tokio::test]
    async fn cycle_excludes_non_member_mappings() {
        // A mapping NOT in cycle.mapping_ids should still be dormant when
        // its device has a cycle row — the cycle claims the device. (If
        // users want to keep extra always-on mappings on a cycle device,
        // they explicitly remove the cycle row.)
        let engine = RoutingEngine::new();
        let in_cycle = Mapping::new(
            "nuimo",
            "dev-1",
            "roon",
            "zone-1",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        );
        let outside_cycle = Mapping::new(
            "nuimo",
            "dev-1",
            "hue",
            "light-1",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PowerToggle,
                params: RouteParams::default(),
            }],
        );
        let id_in = in_cycle.mapping_id;
        engine.load_mappings(vec![in_cycle, outside_cycle]).await;
        engine
            .upsert_cycle(DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![id_in], // outside_cycle.mapping_id NOT included
                active_mapping_id: Some(id_in),
                cycle_gesture: None,
            })
            .await;

        let results = engine.route("nuimo", "dev-1", &InputPrimitive::Press).await;
        assert_eq!(results.len(), 1, "only the cycle's active fires");
        let (service_type, _, _) = dispatch_of(&results[0]);
        assert_eq!(service_type, "roon");
    }

    #[tokio::test]
    async fn set_active_rejects_id_outside_cycle() {
        let engine = RoutingEngine::new();
        let m1 = Mapping::new("nuimo", "dev-1", "roon", "z", vec![]);
        let id1 = m1.mapping_id;
        let stranger = uuid::Uuid::new_v4();
        engine.load_mappings(vec![m1]).await;
        engine
            .upsert_cycle(DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![id1],
                active_mapping_id: Some(id1),
                cycle_gesture: None,
            })
            .await;

        assert!(!engine.set_active("nuimo", "dev-1", stranger).await);
        // Active stays at id1.
        let cycles = engine.list_cycles().await;
        assert_eq!(cycles[0].active_mapping_id, Some(id1));
    }

    #[tokio::test]
    async fn remove_cycle_restores_all_fire() {
        let engine = RoutingEngine::new();
        let m1 = Mapping::new(
            "nuimo",
            "dev-1",
            "roon",
            "z",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        );
        let m2 = Mapping::new(
            "nuimo",
            "dev-1",
            "hue",
            "l",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PowerToggle,
                params: RouteParams::default(),
            }],
        );
        let (id1, id2) = (m1.mapping_id, m2.mapping_id);
        engine.load_mappings(vec![m1, m2]).await;
        engine
            .upsert_cycle(DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![id1, id2],
                active_mapping_id: Some(id1),
                cycle_gesture: None,
            })
            .await;

        let with_cycle = engine.route("nuimo", "dev-1", &InputPrimitive::Press).await;
        assert_eq!(with_cycle.len(), 1, "cycle filters to active");

        assert!(engine.remove_cycle("nuimo", "dev-1").await);
        let after_remove = engine.route("nuimo", "dev-1", &InputPrimitive::Press).await;
        assert_eq!(after_remove.len(), 2, "removing cycle restores all-fire");
    }
}
