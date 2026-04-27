//! One-shot startup migration: expand legacy `target_candidates` /
//! `target_switch_on` into a DeviceCycle row + separate Mapping rows
//! per candidate.
//!
//! Each candidate becomes its own first-class Mapping (preserving
//! `service_type` / `routes` overrides as the new mapping's own fields,
//! so cross-service candidates land on their adapters natively without
//! `effective_for` lookup). The original mapping keeps its identity but
//! has its `target_candidates` / `target_switch_on` cleared.
//!
//! Idempotent: skips mappings whose `target_switch_on` is None (the
//! post-migration state). If a cycle already exists for the device but
//! the original mapping somehow still carries legacy fields (interrupted
//! prior run), the legacy fields are cleared.

use crate::sqlite_store::SqliteStore;
use weave_engine::mapping::{DeviceCycle, Mapping};
use weave_engine::{MappingStore, StoreError};

pub async fn migrate_target_candidates(store: &SqliteStore) -> Result<usize, StoreError> {
    let mappings = store.list_mappings().await?;
    let mut migrated = 0usize;
    for m in mappings {
        let Some(gesture) = m.target_switch_on.clone() else {
            continue;
        };
        // Idempotency: if a cycle already exists for this device, the
        // candidate-expansion has already happened. Just clean up legacy
        // fields on the origin (no-op when already cleared).
        if store
            .get_cycle(&m.device_type, &m.device_id)
            .await?
            .is_some()
        {
            if !m.target_candidates.is_empty() || m.target_switch_on.is_some() {
                let mut cleared = m.clone();
                cleared.target_candidates.clear();
                cleared.target_switch_on = None;
                store.update_mapping(&cleared).await?;
            }
            continue;
        }
        let mut new_ids = vec![m.mapping_id];
        for cand in &m.target_candidates {
            let new_mapping = Mapping {
                mapping_id: uuid::Uuid::new_v4(),
                edge_id: m.edge_id.clone(),
                device_type: m.device_type.clone(),
                device_id: m.device_id.clone(),
                service_type: cand
                    .service_type
                    .clone()
                    .unwrap_or_else(|| m.service_type.clone()),
                service_target: cand.target.clone(),
                routes: cand.routes.clone().unwrap_or_else(|| m.routes.clone()),
                feedback: m.feedback.clone(),
                // Single-active invariant: the origin mapping (m) carries
                // the cycle's initial active state. Newly expanded
                // siblings start dormant; cycle gesture / web switch
                // promotes them later.
                active: false,
                target_candidates: Vec::new(),
                target_switch_on: None,
            };
            store.create_mapping(&new_mapping).await?;
            new_ids.push(new_mapping.mapping_id);
        }
        let cycle = DeviceCycle {
            device_type: m.device_type.clone(),
            device_id: m.device_id.clone(),
            mapping_ids: new_ids,
            active_mapping_id: Some(m.mapping_id),
            cycle_gesture: Some(gesture),
        };
        store.upsert_cycle(&cycle).await?;
        let mut cleared = m.clone();
        cleared.target_candidates.clear();
        cleared.target_switch_on = None;
        store.update_mapping(&cleared).await?;
        migrated += 1;
    }
    if migrated > 0 {
        tracing::info!(
            count = migrated,
            "migrated target_candidates into device_cycles"
        );
    }
    Ok(migrated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use weave_engine::mapping::TargetCandidate;
    use weave_engine::route::{Route, RouteParams};
    use weave_engine::{primitives::InputType, IntentType};

    async fn fresh_store() -> SqliteStore {
        SqliteStore::connect("sqlite::memory:").await.unwrap()
    }

    fn legacy_mapping_with_candidates() -> Mapping {
        let mut m = Mapping::new(
            "nuimo",
            "dev-1",
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
            ],
        );
        m.edge_id = "pro".into();
        m.target_switch_on = Some("swipe_up".into());
        m.target_candidates = vec![
            TargetCandidate {
                target: "light-ann".into(),
                label: "Ann".into(),
                glyph: "bulb".into(),
                service_type: Some("hue".into()),
                routes: Some(vec![Route {
                    input: InputType::Rotate,
                    intent: IntentType::BrightnessChange,
                    params: RouteParams { damping: 80.0 },
                }]),
            },
            TargetCandidate {
                target: "now-playing".into(),
                label: "Apple Music".into(),
                glyph: "play".into(),
                service_type: Some("ios_media".into()),
                routes: None,
            },
        ];
        m
    }

    #[tokio::test]
    async fn expands_candidates_to_cycle() {
        let store = fresh_store().await;
        let m = legacy_mapping_with_candidates();
        let origin_id = m.mapping_id;
        store.create_mapping(&m).await.unwrap();

        let migrated = migrate_target_candidates(&store).await.unwrap();
        assert_eq!(migrated, 1);

        let mappings = store.list_mappings().await.unwrap();
        assert_eq!(mappings.len(), 3, "origin + 2 candidates expanded");

        let origin = mappings
            .iter()
            .find(|m| m.mapping_id == origin_id)
            .expect("origin mapping retained");
        assert!(
            origin.target_candidates.is_empty(),
            "origin's target_candidates cleared"
        );
        assert!(origin.target_switch_on.is_none());

        let hue = mappings
            .iter()
            .find(|m| m.service_type == "hue")
            .expect("hue mapping created");
        assert_eq!(hue.service_target, "light-ann");
        assert_eq!(hue.routes.len(), 1);
        assert_eq!(hue.edge_id, "pro");
        assert!(hue.target_candidates.is_empty());
        assert!(hue.target_switch_on.is_none());
        assert!(!hue.active, "expanded sibling starts dormant");

        let ios = mappings
            .iter()
            .find(|m| m.service_type == "ios_media")
            .expect("ios_media mapping created");
        // Inherited routes from origin since cand.routes was None.
        assert_eq!(ios.routes.len(), 2);
        assert!(!ios.active, "expanded sibling starts dormant");

        // Origin keeps active=true (the cycle's initial active member).
        assert!(origin.active);

        let cycle = store
            .get_cycle("nuimo", "dev-1")
            .await
            .unwrap()
            .expect("cycle row created");
        assert_eq!(cycle.mapping_ids.len(), 3);
        assert_eq!(cycle.mapping_ids[0], origin_id);
        assert_eq!(cycle.active_mapping_id, Some(origin_id));
        assert_eq!(cycle.cycle_gesture.as_deref(), Some("swipe_up"));
    }

    #[tokio::test]
    async fn migration_is_idempotent() {
        let store = fresh_store().await;
        store
            .create_mapping(&legacy_mapping_with_candidates())
            .await
            .unwrap();

        let first = migrate_target_candidates(&store).await.unwrap();
        let mappings_after_first = store.list_mappings().await.unwrap().len();
        assert_eq!(first, 1);

        let second = migrate_target_candidates(&store).await.unwrap();
        assert_eq!(second, 0, "second run finds nothing to migrate");
        let mappings_after_second = store.list_mappings().await.unwrap().len();
        assert_eq!(
            mappings_after_first, mappings_after_second,
            "no new rows on second run"
        );
    }

    #[tokio::test]
    async fn skips_mappings_without_target_switch_on() {
        let store = fresh_store().await;
        let m = Mapping::new(
            "nuimo",
            "dev-2",
            "roon",
            "zone-x",
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        );
        store.create_mapping(&m).await.unwrap();

        let migrated = migrate_target_candidates(&store).await.unwrap();
        assert_eq!(migrated, 0);
        assert_eq!(store.list_mappings().await.unwrap().len(), 1);
        assert!(store.get_cycle("nuimo", "dev-2").await.unwrap().is_none());
    }
}
