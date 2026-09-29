CREATE TABLE repositories (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  path     TEXT NOT NULL,
  added_at REAL NOT NULL
);

CREATE TABLE session_repositories (
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  name            TEXT NOT NULL,
  repository_path TEXT NOT NULL,
  folder          TEXT NOT NULL,
  branch          TEXT NOT NULL,
  base_ref        TEXT NOT NULL,
  base_commit     TEXT NOT NULL,
  PRIMARY KEY (session_id, position)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN workspace_dir TEXT;
