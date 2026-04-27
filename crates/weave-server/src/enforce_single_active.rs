//! Single-active-per-device invariant enforcement.
//!
//! For every `(device_type, device_id)` group, exactly one mapping must
//! carry `mapping.active = true`. This is the source of truth the routing
//! engine consults — `cycle.active_mapping_id` is informational (cycle
//! navigation order + UI display); routing skips any mapping with
//! `active = false`.
//!
//! Run on startup (after `migrate_target_candidates`). Idempotent: re-runs
//! find nothing to fix when the invariant already holds.
//!
//! Selection rule for which mapping wins active when the invariant is
//! currently violated:
//!  1. If a `DeviceCycle` exists with an `active_mapping_id` that is one
//!     of the device's mappings → pick that.
//!  2. Otherwise, pick the first by `mapping_id` ordering (deterministic,
//!     stable across restarts).

use std::collections::HashMap;

use crate::sqlite_store::SqliteStore;
use weave_engine::mapping::Mapping;
use weave_engine::{MappingStore, StoreError};

pub async fn enforce_single_active_invariant(store: &SqliteStore) -> Result<usize, StoreError> {
    let mappings = store.list_mappings().await?;
    let mut by_device: HashMap<(String, String), Vec<Mapping>> = HashMap::new();
    for m in mappings {
        by_device
            .entry((m.device_type.clone(), m.device_id.clone()))
            .or_default()
            .push(m);
    }

    let mut updated = 0usize;
    for ((device_type, device_id), mut group) in by_device {
        if group.len() < 2 {
            // Single-mapping or empty bucket: nothing to enforce. The
            // lone mapping's active flag is the user's call.
            continue;
        }
        // Stable ordering for fallback active-pick.
        group.sort_by_key(|m| m.mapping_id);

        let active_count = group.iter().filter(|m| m.active).count();
        if active_count == 1 {
            // Invariant already holds — leave whatever the user / prior
            // state chose. We don't second-guess if it disagrees with
            // cycle.active_mapping_id; that's the cycle-switch endpoint's
            // job to keep them aligned.
            continue;
        }

        let cycle = store.get_cycle(&device_type, &device_id).await?;
        let preferred_active = cycle
            .as_ref()
            .and_then(|c| c.active_mapping_id)
            .filter(|id| group.iter().any(|m| m.mapping_id == *id))
            .or_else(|| group.first().map(|m| m.mapping_id));

        for m in &group {
            let should_be_active = preferred_active == Some(m.mapping_id);
            if m.active == should_be_active {
                continue;
            }
            let mut updated_mapping = m.clone();
            updated_mapping.active = should_be_active;
            store.update_mapping(&updated_mapping).await?;
            updated += 1;
        }
    }

    if updated > 0 {
        tracing::info!(
            count = updated,
            "enforced single-active-per-device invariant"
        );
    }
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use weave_engine::mapping::DeviceCycle;
    use weave_engine::route::{Route, RouteParams};
    use weave_engine::{primitives::InputType, IntentType};

    async fn fresh_store() -> SqliteStore {
        SqliteStore::connect("sqlite::memory:").await.unwrap()
    }

    fn mapping_for(device_id: &str, service_type: &str, target: &str) -> Mapping {
        Mapping::new(
            "nuimo",
            device_id,
            service_type,
            target,
            vec![Route {
                input: InputType::Press,
                intent: IntentType::PlayPause,
                params: RouteParams::default(),
            }],
        )
    }

    #[tokio::test]
    async fn no_op_when_invariant_already_holds() {
        let store = fresh_store().await;
        // Two mappings on the same device, one active, one not.
        let m1 = mapping_for("dev-1", "roon", "z1");
        let mut m2 = mapping_for("dev-1", "hue", "l1");
        m2.active = false;
        store.create_mapping(&m1).await.unwrap();
        store.create_mapping(&m2).await.unwrap();

        let updated = enforce_single_active_invariant(&store).await.unwrap();
        assert_eq!(updated, 0);
    }

    #[tokio::test]
    async fn flips_extra_active_to_false() {
        let store = fresh_store().await;
        // Both mappings active=true → invariant violated.
        let m1 = mapping_for("dev-1", "roon", "z1");
        let m2 = mapping_for("dev-1", "hue", "l1");
        // Stable ordering: smaller UUID wins active.
        let (winner, loser) = if m1.mapping_id < m2.mapping_id {
            (m1.mapping_id, m2.mapping_id)
        } else {
            (m2.mapping_id, m1.mapping_id)
        };
        store.create_mapping(&m1).await.unwrap();
        store.create_mapping(&m2).await.unwrap();

        let updated = enforce_single_active_invariant(&store).await.unwrap();
        assert_eq!(updated, 1, "loser flipped to inactive");

        let after = store.list_mappings().await.unwrap();
        for m in after {
            if m.mapping_id == winner {
                assert!(m.active);
            } else {
                assert_eq!(m.mapping_id, loser);
                assert!(!m.active);
            }
        }
    }

    #[tokio::test]
    async fn cycle_active_takes_precedence_over_uuid_order() {
        let store = fresh_store().await;
        let m1 = mapping_for("dev-1", "roon", "z1");
        let m2 = mapping_for("dev-1", "hue", "l1");
        // Pick the larger UUID as cycle's preferred active — ensures the
        // cycle wins over UUID order.
        let cycle_active = if m1.mapping_id > m2.mapping_id {
            m1.mapping_id
        } else {
            m2.mapping_id
        };
        store.create_mapping(&m1).await.unwrap();
        store.create_mapping(&m2).await.unwrap();
        store
            .upsert_cycle(&DeviceCycle {
                device_type: "nuimo".into(),
                device_id: "dev-1".into(),
                mapping_ids: vec![m1.mapping_id, m2.mapping_id],
                active_mapping_id: Some(cycle_active),
                cycle_gesture: None,
            })
            .await
            .unwrap();

        enforce_single_active_invariant(&store).await.unwrap();

        let after = store.list_mappings().await.unwrap();
        let active_count = after.iter().filter(|m| m.active).count();
        assert_eq!(active_count, 1);
        let active_one = after.iter().find(|m| m.active).unwrap();
        assert_eq!(active_one.mapping_id, cycle_active);
    }

    #[tokio::test]
    async fn promotes_when_all_inactive() {
        let store = fresh_store().await;
        let mut m1 = mapping_for("dev-1", "roon", "z1");
        let mut m2 = mapping_for("dev-1", "hue", "l1");
        m1.active = false;
        m2.active = false;
        store.create_mapping(&m1).await.unwrap();
        store.create_mapping(&m2).await.unwrap();

        enforce_single_active_invariant(&store).await.unwrap();

        let after = store.list_mappings().await.unwrap();
        assert_eq!(after.iter().filter(|m| m.active).count(), 1);
    }

    #[tokio::test]
    async fn single_mapping_devices_untouched() {
        let store = fresh_store().await;
        let mut m = mapping_for("dev-1", "roon", "z1");
        m.active = false; // user disabled it
        store.create_mapping(&m).await.unwrap();

        let updated = enforce_single_active_invariant(&store).await.unwrap();
        assert_eq!(updated, 0);

        let after = store.list_mappings().await.unwrap();
        assert!(!after[0].active, "single-mapping bucket left as user set");
    }

    #[tokio::test]
    async fn idempotent_on_repeat() {
        let store = fresh_store().await;
        let m1 = mapping_for("dev-1", "roon", "z1");
        let m2 = mapping_for("dev-1", "hue", "l1");
        store.create_mapping(&m1).await.unwrap();
        store.create_mapping(&m2).await.unwrap();

        enforce_single_active_invariant(&store).await.unwrap();
        let second = enforce_single_active_invariant(&store).await.unwrap();
        assert_eq!(second, 0, "second pass has nothing to fix");
    }
}
