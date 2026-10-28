CREATE TABLE tool_details (
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tool_use_id      TEXT NOT NULL,
  input            TEXT NOT NULL DEFAULT '',
  input_truncated  INTEGER NOT NULL DEFAULT 0,
  output           TEXT NOT NULL DEFAULT '',
  output_truncated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, tool_use_id)
) WITHOUT ROWID;
