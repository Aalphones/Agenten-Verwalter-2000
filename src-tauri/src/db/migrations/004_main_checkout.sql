ALTER TABLE session_repositories ADD COLUMN checkout TEXT NOT NULL DEFAULT 'app_worktree';

CREATE TABLE session_ticket_worktrees (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  folder     TEXT NOT NULL,
  PRIMARY KEY (session_id, position, folder)
) WITHOUT ROWID;
