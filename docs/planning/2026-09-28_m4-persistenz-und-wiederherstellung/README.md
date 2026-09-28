# Meilenstein 4 — Persistenz & Wiederherstellung (vor Meilenstein 3)

Ziel: Sessions und ihr Verlauf überleben einen App-Neustart. Nach dem Start stehen alle Sessions wieder in der Sidebar, der Verlauf ist vollständig, und die nächste Nachricht setzt den Agenten mit dem bisherigen Verlauf fort. Sessions lassen sich umbenennen und archivieren; ruhende Agenten geben ihren Speicher frei. Danach folgt Meilenstein 3 (Repositories und Worktrees), der auf dieser Datenbank aufsetzt.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (alle Entscheidungen dieses Plans), [ADR 003](../../decisions/003-claude-anbindung.md), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Datenbank-Grundlage | [phase-1-datenbank.md](phase-1-datenbank.md) | standard | complete |
| 2 | Sessions schreiben mit | [phase-2-schreiben.md](phase-2-schreiben.md) | heikel | complete |
| 3 | Nach dem Neustart wiederherstellen | [phase-3-wiederherstellen.md](phase-3-wiederherstellen.md) | heikel | pending |
| 4 | Umbenennen & Archivieren | [phase-4-umbenennen-archivieren.md](phase-4-umbenennen-archivieren.md) | standard | pending |
| 5 | Ruhende Agenten beenden | [phase-5-ruhende-agenten.md](phase-5-ruhende-agenten.md) | heikel | pending |

Umsetzung direkt auf `main`, ein Commit pro Phase, `pnpm check` vor jedem Commit grün (rustfmt und Clippy brauchen `cargo` im PATH: `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"`). Erkenntnisse während der Umsetzung → [FINDINGS.md](FINDINGS.md).

## Festgelegte Entscheidungen

Begründungen und verworfene Alternativen: [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md). Kurzfassung:

- **Reihenfolge:** Meilenstein 4 vor 3 (PROJECT.md wird in Phase 5 angepasst).
- **Speicherformat:** eine Zeile pro `ChatEntry` (JSON), keine `messages`-/`events`-Tabellen.
- **Sessions überleben, Agent-Prozesse nicht:** Nach dem Start sind aktive Sessions `paused`; der Agent startet mit der nächsten Nachricht (`--resume`, oder `--session-id`, solange die Session nie `system/init` gesehen hat).
- **Ruhende Agenten** (`completed`/`paused`) werden nach 30 Minuten beendet (`VERWALTER_IDLE_SECONDS` überschreibt), die nächste Nachricht startet sie neu.
- **Archivieren** blendet aus, löscht nichts. Kein Archiv-Ansicht in diesem Plan (kein toter Knopf): archivierte Sessions sind in der Oberfläche nicht mehr erreichbar, die Daten bleiben.
- **Beim Start** wird die neueste Session geöffnet, wenn keine gewählt ist (statt des Leerzustands).

## Kontrakt

### Datenbank (`src-tauri/src/db/`)

Datei `<Benutzerordner>\.verwalter\verwalter.db`. Migration 1 (`src-tauri/src/db/migrations/001_sessions_and_chat.sql`):

```sql
CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  status            TEXT NOT NULL,      -- serde-Text von SessionStatus: "running", "paused" …
  model             TEXT NOT NULL,      -- serde-Text von ModelId: "sonnet" …
  effort            TEXT NOT NULL,      -- serde-Text von Effort
  mode              TEXT NOT NULL,      -- serde-Text von Mode
  created_at        REAL NOT NULL,      -- Millisekunden seit 1970
  running_ms        REAL NOT NULL,
  context_used      INTEGER NOT NULL,
  context_window    INTEGER NOT NULL,
  has_agent_history INTEGER NOT NULL,   -- 0/1: system/init mindestens einmal gesehen
  archived_at       REAL                -- NULL = sichtbar
);

CREATE TABLE chat_entries (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  payload    TEXT NOT NULL,             -- ChatEntry als JSON (serde, wie über die Tauri-Grenze)
  PRIMARY KEY (session_id, seq)
) WITHOUT ROWID;
```

`PRAGMA user_version` zählt die angewendeten Migrationen (Migration 1 → Wert 1). Pragmas beim Öffnen: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`.

### Rust-Schnittstellen

```rust
// db/mod.rs
pub struct Database { /* Mutex<Connection> */ }
impl Database {
    pub fn open(path: &Path) -> Result<Database, CommandError>;
    pub fn with<R>(&self, work: impl FnOnce(&mut Connection) -> Result<R, CommandError>) -> Result<R, CommandError>;
}
pub fn enum_to_text<T: Serialize>(value: &T) -> Result<String, CommandError>;
pub fn enum_from_text<T: DeserializeOwned>(text: &str) -> Result<T, CommandError>;

// db/sessions.rs
pub struct SessionRow {
    pub id: String, pub name: String, pub status: SessionStatus,
    pub model: ModelId, pub effort: Effort, pub mode: Mode,
    pub created_at: f64, pub running_ms: f64,
    pub context_used: u32, pub context_window: u32, pub has_agent_history: bool,
}
pub fn upsert(connection: &Connection, row: &SessionRow) -> Result<(), CommandError>;   // lässt created_at und archived_at unberührt
pub fn load_active(connection: &Connection) -> Result<Vec<SessionRow>, CommandError>;   // archived_at IS NULL, neueste zuerst
pub fn archive(connection: &Connection, id: &str, archived_at: f64) -> Result<(), CommandError>;
pub fn delete(connection: &Connection, id: &str) -> Result<(), CommandError>;

// db/chat_entries.rs
pub fn upsert_all(connection: &mut Connection, session_id: &str, entries: &[ChatEntry]) -> Result<(), CommandError>;  // eine Transaktion
pub fn load_all(connection: &Connection, session_id: &str) -> Result<Vec<ChatEntry>, CommandError>;                   // aufsteigend, bis zur ersten Lücke in seq
```

### Fehler (`src-tauri/src/error.rs`)

Neue Variante `Database(String)` (Text „Datenbank: …“), dazu `From<rusqlite::Error>`. Die generierte Datei `src/lib/bindings/CommandError.ts` erhält die Variante `{ "kind": "database", "message": string }`.

### Tauri Commands (neu)

| Command (`commands/sessions.rs`) | Parameter | Rückgabe | Wrapper (`src/lib/sessions.ts`) |
|---|---|---|---|
| `session_rename` | `session_id: String, name: String` | `()` | `renameSession` |
| `session_archive` | `session_id: String` | `()` | `archiveSession` |

Fehler: `SessionNotFound`, beim Umbenennen mit leerem Namen `Internal("Der Name darf nicht leer sein.")`. Namen werden auf 60 Zeichen gekürzt. Es gibt keine neuen Events: eine Umbenennung kommt als `session://changed`, das Archivieren entfernt die Oberfläche selbst aus ihrer Liste.

### Umgebungsvariable

`VERWALTER_IDLE_SECONDS` (ganze Sekunden, Standard 1800): Frist, nach der ein ruhender Agent beendet wird. Steht in [AGENTS.md](../../../AGENTS.md) unter „Befehle“ (Phase 5).

## Finale Abnahmekriterien

1. Session anlegen, ein paar Nachrichten wechseln, App schließen, App starten: die Session steht in der Sidebar, der Verlauf ist vollständig und in derselben Reihenfolge (Nachrichten, Antworten, Werkzeug-Zeilen, Aufgabenliste, Rückfragen mit ihren Antworten); eine vorher aktive Session zeigt „Pausiert“, eine abgeschlossene bleibt „Abgeschlossen“.
2. Nach dem Neustart eine Nachricht senden: der Agent startet und kennt den bisherigen Verlauf.
3. Eine offene Rückfrage vor dem Beenden trägt nach dem Start die Antwort „Nicht beantwortet“; eine laufende Werkzeug-Zeile zeigt „unterbrochen“.
4. Umbenennen per Doppelklick, F2 und Rechtsklick; der Name bleibt nach einem Neustart. Archivieren nimmt die Session aus der Liste (auch nach einem Neustart), beendet ihren Agenten und lässt Daten und Ordner liegen.
5. Ein Agent einer abgeschlossenen oder pausierten Session ist nach der Frist beendet; die nächste Nachricht startet ihn wieder, der Verlauf bleibt.
6. Wird die App hart beendet (Task-Manager), zeigt der Neustart den Verlauf bis zum letzten geschriebenen Eintrag; die Datenbank ist nicht beschädigt.
7. Nach dem Start ist die neueste Session geöffnet, nicht der Leerzustand.
8. `pnpm check` grün; ADR 004, Code-Map, Konventionen, AGENTS.md, PROJECT.md, Glossar und Entwurfs-README beschreiben den tatsächlichen Stand.

## Smoke-Checkliste (macht Sascha am Plan-Ende)

Wackelstellen zuerst:

- [ ] **Neustart mitten in der Arbeit:** Aufgabe „Lies a.txt 30 Mal nacheinander, jedes Mal mit eigenem Read-Aufruf“, während der Agent arbeitet die App im Task-Manager beenden, neu starten → Session „Pausiert“, Verlauf bis dahin da, laufende Zeile „unterbrochen“; „Fortsetzen“ → Agent arbeitet weiter und weiß, wo er war.
- [ ] **Rückfrage überlebt den Neustart nicht offen:** „Frag mich mit dem AskUserQuestion-Tool: Rot oder Blau?“, App beenden bevor du antwortest, neu starten → Rückfrage steht mit „Nicht beantwortet“, keine Knöpfe; danach normal weiterchatten.
- [ ] **Frist der ruhenden Agenten:** App mit `$env:VERWALTER_IDLE_SECONDS = "60"` starten (`starten.cmd` erbt die Variable), Session abschließen lassen, 2 Minuten warten → `claude.exe` der Session ist im Task-Manager weg, Sidebar zeigt weiter „Abgeschlossen“; neue Nachricht → Agent startet, Antwort kennt den Verlauf.
- [ ] Archivieren einer laufenden Session → verschwindet, der `claude.exe` ist beendet; nach Neustart weiter weg.
- [ ] Umbenennen: Doppelklick, F2, Rechtsklick → Enter speichert, Esc bricht ab (und **pausiert dabei nicht** die laufende Session); leerer Name ändert nichts.
- [ ] Zwei Sessions, eine abgeschlossen, eine pausiert, Neustart → beide mit richtigem Status in der richtigen Sidebar-Gruppe.
- [ ] Erststart ohne Datenbank (Datei `%USERPROFILE%\.verwalter\verwalter.db` vorher umbenennen) → App startet, Leerzustand, Datei neu angelegt.
- [ ] Die offene Smoke-Checkliste aus [Meilenstein 2a](../../archive/2026-09/2026-09-28_m2a-durchstich-chat/README.md) (Abschnitt „Smoke-Checkliste“) einmal durchspielen.

## Summary

## Files touched

## Commits

## Deviations from plan

## Follow-ups
