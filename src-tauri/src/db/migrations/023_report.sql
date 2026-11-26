CREATE TABLE report_entries (
  id                INTEGER PRIMARY KEY,
  implementation_id TEXT NOT NULL REFERENCES implementations(id) ON DELETE CASCADE,
  phase_id          TEXT NOT NULL REFERENCES implementation_phases(id) ON DELETE CASCADE,
  station_id        TEXT NOT NULL,
  session_id        TEXT NOT NULL,
  number            INTEGER NOT NULL,
  tool              TEXT NOT NULL,          -- 'note' | 'figure' | 'screen'
  note_kind         TEXT,                   -- 'why' | 'risk' | 'finding' (nur note)
  resolves          INTEGER,                -- Nummer des behobenen Befunds derselben Phase
  text              TEXT NOT NULL DEFAULT '',
  caption           TEXT,
  mermaid           TEXT,
  image_file        TEXT,                   -- Dateiname im Bericht-Ordner der Phase
  image_width       INTEGER,
  image_height      INTEGER,
  marks             TEXT,                   -- JSON [{"n":1,"x":10,"y":20,"w":120,"h":30,"text":"…"}], Rechtecke in Bildpixeln
  screen            TEXT,                   -- JSON ScreenRow (nur screen): name, deviation, shots, steps
  repository_key    TEXT,
  path              TEXT,                   -- relativ zum Repository, mit /
  line_from         INTEGER,
  line_to           INTEGER,
  anchor_text       TEXT,                   -- die Zeilen line_from..line_to beim Aufruf
  created_at        REAL NOT NULL,
  UNIQUE (phase_id, number)
);
CREATE INDEX report_entries_impl ON report_entries (implementation_id, phase_id, number);
CREATE TABLE report_phases (
  phase_id          TEXT PRIMARY KEY REFERENCES implementation_phases(id) ON DELETE CASCADE,
  implementation_id TEXT NOT NULL REFERENCES implementations(id) ON DELETE CASCADE,
  tidy              TEXT,                   -- geordnete Fassung (Markdown)
  tidy_json         TEXT,                   -- Antwort von Haiku, geprüft
  tidy_at           REAL,
  tidy_entries      INTEGER,                -- höchste Nummer, die die Ordnung kennt
  tidy_error        TEXT,
  checks            TEXT,                   -- JSON PhaseChecks
  checks_at         REAL
);
