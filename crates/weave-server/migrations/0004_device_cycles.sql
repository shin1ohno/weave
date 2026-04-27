-- Device-level Connection cycles. Replaces the per-Mapping
-- target_candidates / target_switch_on cross-service mechanism.
--
-- When a row exists for (device_type, device_id), only the mapping
-- identified by `active_mapping_id` routes input for that device — see
-- `weave_engine::engine::RoutingEngine::route` for the filter. Mappings
-- outside `mapping_ids_json` are also dormant when a row exists.
--
-- Migration of existing target_candidates / target_switch_on into rows
-- here happens at server startup via `migrate_target_candidates`
-- (Rust-side, idempotent).

CREATE TABLE IF NOT EXISTS device_cycles (
    device_type        TEXT NOT NULL,
    device_id          TEXT NOT NULL,
    cycle_gesture      TEXT,                 -- nullable when no auto-cycle gesture
    active_mapping_id  TEXT,                 -- nullable when cycle is empty
    mapping_ids_json   TEXT NOT NULL,        -- JSON array of UUIDs in cycle order
    PRIMARY KEY (device_type, device_id)
);

CREATE INDEX IF NOT EXISTS device_cycles_active_idx ON device_cycles (active_mapping_id);
