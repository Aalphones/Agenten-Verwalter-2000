CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  status            TEXT NOT NULL,
  model             TEXT NOT NULL,
  effort            TEXT NOT NULL,
  mode              TEXT NOT NULL,
  created_at        REAL NOT NULL,
  running_ms        REAL NOT NULL,
  context_used      INTEGER NOT NULL,
  context_window    INTEGER NOT NULL,
  has_agent_history INTEGER NOT NULL,
  archived_at       REAL
);

CREATE TABLE chat_entries (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  payload    TEXT NOT NULL,
  PRIMARY KEY (session_id, seq)
) WITHOUT ROWID;
