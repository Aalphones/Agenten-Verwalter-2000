CREATE TABLE session_commits (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  commit_id  TEXT NOT NULL,
  PRIMARY KEY (session_id, commit_id)
) WITHOUT ROWID;

CREATE TABLE session_files (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  touched_at REAL NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN changes_tracked_at REAL;
UPDATE sessions SET changes_tracked_at = (julianday('now') - 2440587.5) * 86400000.0;
