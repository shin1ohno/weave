CREATE TABLE IF NOT EXISTS mappings (
    mapping_id TEXT PRIMARY KEY NOT NULL,
    edge_id TEXT NOT NULL DEFAULT '',
    mapping_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mappings_edge_id ON mappings (edge_id);
