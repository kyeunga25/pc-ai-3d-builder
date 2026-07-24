CREATE TABLE IF NOT EXISTS rigstage_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO rigstage_metadata (key, value)
VALUES ('schema_phase', '0');
