# Meilenstein 4 — Persistenz & Wiederherstellung (vor Meilenstein 3)

Ziel: Sessions und ihr Verlauf überleben einen App-Neustart. Nach dem Start stehen alle Sessions wieder in der Sidebar, der Verlauf ist vollständig, und die nächste Nachricht setzt den Agenten mit dem bisherigen Verlauf fort. Sessions lassen sich umbenennen und archivieren; ruhende Agenten geben ihren Speicher frei. Danach folgt Meilenstein 3 (Repositories und Worktrees), der auf dieser Datenbank aufsetzt.

Kontext für jeden Umsetzer: [AGENTS.md](../../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [ADR 004](../../decisions/004-persistenz-und-wiederherstellung.md) (alle Entscheidungen dieses Plans), [ADR 003](../../decisions/003-claude-anbindung.md), [Design-Entwurf](../../design/2026-09-28_hauptansichten/README.md), die Konventionen unter [docs/conventions/](../../conventions/).

## Phasen

| # | Phase | Datei | Rating | Status |
|---|---|---|---|---|
| 1 | Datenbank-Grundlage | [phase-1-datenbank.md](phase-1-datenbank.md) | standard | complete |
| 2 | Sessions schreiben mit | [phase-2-schreiben.md](phase-2-schreiben.md) | heikel | complete |
| 3 | Nach dem Neustart wiederherstellen | [phase-3-wiederherstellen.md](phase-3-wiederherstellen.md) | heikel | complete |
| 4 | Umbenennen & Archivieren | [phase-4-umbenennen-archivieren.md](phase-4-umbenennen-archivieren.md) | standard | complete |
| 5 | Ruhende Agenten beenden | [phase-5-ruhende-agenten.md](phase-5-ruhende-agenten.md) | heikel | complete |

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

## Smoke-Checkliste

Sascha hat die Ausführung an mich delegiert (2026-09-28/29) — echte App über den WebView2-Debug-Port gesteuert, keine Simulation der Fachlogik. Alle Punkte belegt, zwei Funde dabei (siehe „Deviations from plan“):

- [x] **Neustart mitten in der Arbeit:** bestätigt — pausiert, Verlauf da, „Fortsetzen“ arbeitet weiter. Die laufende Zeile zeigte bei einem harten Absturz korrekt „unterbrochen“; bei Esc auf einen bereits laufenden (erlaubten) Aufruf zeigte sie stattdessen „fehlgeschlagen“ — Fund, siehe Deviations.
- [x] **Rückfrage überlebt den Neustart nicht offen:** bestätigt, „Nicht beantwortet“, keine Knöpfe.
- [x] **Frist der ruhenden Agenten:** bestätigt mit `VERWALTER_IDLE_SECONDS=60`, Prozess eindeutig per Session-ID identifiziert (nicht pauschal `claude.exe`, das träfe auch fremde Sessions).
- [x] Archivieren einer laufenden Session: bestätigt, Prozess beendet, bleibt nach Neustart weg.
- [x] Umbenennen: Doppelklick, F2 (echter Tastendruck), Rechtsklick alle bestätigt; Esc pausiert die Session nicht mit.
- [x] Zwei Sessions nach Neustart, richtige Sidebar-Gruppe: bestätigt.
- [x] Erststart ohne Datenbank: bestätigt, Leerzustand, Datei neu angelegt.
- [x] Die Smoke-Checkliste aus [Meilenstein 2a](../../archive/2026-09/2026-09-28_m2a-durchstich-chat/README.md) durchgespielt — Ergebnis dort eingetragen.

## Summary

Sessions und ihr Chat-Verlauf überleben einen App-Neustart: SQLite mit nummerierten Migrationen, eine Zeile pro Chat-Eintrag, Wiederherstellung mit `--resume` (bzw. `--session-id`, solange Claude die Session nie gesehen hat). Eine vorher aktive Session ist danach pausiert, offene Rückfragen tragen „Nicht beantwortet“. Sessions lassen sich umbenennen (Doppelklick, F2, Rechtsklick) und archivieren (blendet aus, Verlauf und Ordner bleiben). Ein Hintergrund-Thread beendet ruhende Agenten nach einer Frist (`VERWALTER_IDLE_SECONDS`, Standard 30 Minuten) und gibt ihren Speicher frei; die nächste Nachricht startet sie neu. Die komplette Smoke-Checkliste (M4 + die aus M2a nachgezogene) ist durchgespielt, zwei Funde dokumentiert (siehe unten).

## Files touched

- Core: `src-tauri/src/db/` (neu: `mod.rs`, `migrations.rs` + `migrations/001_sessions_and_chat.sql`, `sessions.rs`, `chat_entries.rs`), `src-tauri/src/sessions/registry.rs` (Persistenz, Wiederherstellung, Umbenennen/Archivieren, Reaper), `src-tauri/src/sessions/mod.rs`, `src-tauri/src/commands/sessions.rs`, `src-tauri/src/filesystem/workspace.rs`, `src-tauri/src/error.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`
- Oberfläche: `src/app/{App.tsx,Sidebar.tsx,Sidebar.css}`, `src/app/SidebarItem.{tsx,css}` (neu), `src/features/sessions/useSessionSummaries.ts`, `src/lib/sessions.ts`, `src/lib/bindings/CommandError.ts` (generiert)
- Doku: `AGENTS.md`, `docs/{PROJECT,code-map,glossary}.md`, `docs/conventions/rust.md`, `docs/decisions/{003-claude-anbindung,004-persistenz-und-wiederherstellung}.md`, `docs/design/2026-09-28_hauptansichten/README.md`

## Commits

- Phase 1: `10a6029` feat(db): add sqlite foundation with migrations and session tables
- Phase 2: `36ab5bd` feat(sessions): persist sessions and chat entries in sqlite
- Phase 3: `99624db` feat(sessions): restore sessions and history after an app restart
- Phase 4: `c1d248e` feat(sessions): add rename and archive to the sidebar
- Phase 5: `df35a58` feat(sessions): stop idle agents and resume them on demand

## Deviations from plan

- **Esc auf einen bereits laufenden (erlaubten) Werkzeug-Aufruf markiert die Zeile „fehlgeschlagen“, nicht „unterbrochen“** — abweichend vom Design. Ursache: Der Claude-Prozess meldet den abgewürgten Aufruf selbst als Fehlergebnis (`ToolFinished{failed:true}`), das trifft ein, bevor die App die Zeile beim Turn-Ende auf „Interrupted“ umstellen kann. Beim echten Absturz (Prozess von außen beendet, kein Ergebnis kommt je zurück) funktioniert es korrekt — gegengeprüft. Nicht behoben, da unklar ist, ob sich die Reihenfolge zuverlässig beeinflussen lässt, ohne das Claude-Protokoll genauer zu untersuchen.
- **Der im Plan vorgesehene Lange-Verlauf-Test (80 Reads) erzeugt nur 86 Einträge** — unter der Seitengröße 200 (`chat_history`). Das Nachladen beim Hochscrollen (`hasMore`) wurde dadurch nicht ausgelöst; die Virtualisierung selbst (Bottom-Anchor, Gruppierung) wurde bestätigt, die Pagination-Schleife nicht.
- Smoke-Test wurde nicht von Sascha, sondern von mir über den WebView2-Debug-Port durchgeführt (Delegation, siehe Chat) — echte Interaktionen (CDP `Input.dispatchMouseEvent`, echte Tastendrücke), keine reine API-Simulation.

## Follow-ups

- Die beiden Deviations oben (Failed-statt-Interrupted-Label, Lange-Verlauf-Pagination ungetestet) — Kandidaten für einen eigenen kleinen Fix-Plan oder für M6.
- Offen aus M1: `gen-bindings.exe` im Installer.
- Bündelgröße ~614 kB (Warnung „> 500 kB“), aus M2a — Aufteilen erst bei spürbarer Startzeit.
- `→ Vault`-Einträge aus den FINDINGS von M2a und M4 warten auf `session-review`.
