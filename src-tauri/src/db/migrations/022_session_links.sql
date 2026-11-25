CREATE TABLE session_links (
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  first_seen_at REAL NOT NULL,
  last_seen_at  REAL NOT NULL,
  PRIMARY KEY (session_id, path)
) WITHOUT ROWID;

ALTER TABLE sessions ADD COLUMN cli_scratchpad_dir TEXT;
ALTER TABLE sessions ADD COLUMN links_scanned INTEGER NOT NULL DEFAULT 0;
