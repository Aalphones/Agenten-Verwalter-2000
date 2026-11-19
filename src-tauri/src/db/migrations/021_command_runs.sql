CREATE TABLE command_runs (
    id INTEGER PRIMARY KEY,
    project_id TEXT NOT NULL,
    command_key TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    finished_at REAL NOT NULL
);
CREATE INDEX command_runs_key ON command_runs (command_key, project_id, finished_at);
