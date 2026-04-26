CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    builtin INTEGER NOT NULL,
    domain TEXT NOT NULL,
    routes_json TEXT NOT NULL,
    feedback_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS templates_domain_idx ON templates (domain);
