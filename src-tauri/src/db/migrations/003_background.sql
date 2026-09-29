CREATE TABLE background_items (
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  id               TEXT NOT NULL,
  started_at       REAL NOT NULL,
  payload          TEXT NOT NULL,
  output           TEXT,
  output_truncated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, id)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN scratchpad_dir TEXT;
