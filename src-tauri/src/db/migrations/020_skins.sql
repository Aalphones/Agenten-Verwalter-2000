CREATE TABLE skin_packs (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('figures', 'style')),
  name       TEXT NOT NULL,
  data       TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT,
  deleted_at TEXT
);
