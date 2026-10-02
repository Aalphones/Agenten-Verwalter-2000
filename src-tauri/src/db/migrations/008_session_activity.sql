ALTER TABLE sessions ADD COLUMN last_activity_at REAL NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN seen_at REAL NOT NULL DEFAULT 0;

UPDATE sessions SET last_activity_at = COALESCE(
  (SELECT MAX(json_extract(payload, '$.sentAt')) FROM chat_entries
    WHERE chat_entries.session_id = sessions.id
      AND json_extract(payload, '$.kind') = 'user'),
  created_at);

UPDATE sessions SET seen_at = last_activity_at;
