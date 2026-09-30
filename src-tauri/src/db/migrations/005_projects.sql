CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  created_at   REAL NOT NULL,
  archived_at  REAL,
  tldr         TEXT,
  tldr_at      REAL,
  tldr_sources INTEGER
);

INSERT INTO projects (id, name, created_at, archived_at)
  SELECT id, name, created_at, archived_at FROM sessions;

ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE sessions ADD COLUMN number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN tldr TEXT;
ALTER TABLE sessions ADD COLUMN tldr_at REAL;
ALTER TABLE sessions ADD COLUMN tldr_seq INTEGER;

UPDATE sessions SET project_id = id;
